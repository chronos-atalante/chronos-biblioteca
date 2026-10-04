import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveStatus } from '@zero/types';
import {
  authorize,
  backupInfo,
  backupNow,
  disconnect,
  getStatus,
  initDrive,
  onStatus,
  restoreNow,
} from '@zero/main/drive';
import { loadLibrary, saveLibrary } from '@zero/main/library';
import { saveSettings } from '@zero/main/settings';
import { shell } from '../mocks/electron';
import { makeWork } from '../helpers/fixtures';
import { resetSandbox, sandboxPath } from '../helpers/sandbox';

const CLIENT_ID = 'id.apps.googleusercontent.com';
const SECRET = 'GOCSPX-segredo';
const PASSPHRASE = 'frase-secreta';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_API_PATH = '/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const FOLDER_ID = 'pasta-backup';

interface FetchCall {
  url: string;
  init: RequestInit;
}

type FetchHandler = (call: FetchCall) => Response | Promise<Response>;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(handler: FetchHandler): FetchCall[] {
  const calls: FetchCall[] = [];
  const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input, init) => {
      const call: FetchCall = { url: String(input), init: init ?? {} };
      calls.push(call);
      return handler(call);
    },
  );
  vi.stubGlobal('fetch', mock);
  return calls;
}

function configPath(name: string): string {
  return path.join(sandboxPath('XDG_CONFIG_HOME'), 'webtoons-biblioteca', name);
}

function tokensPath(): string {
  return configPath('drive-tokens.json');
}

function coversPath(name: string): string {
  return path.join(sandboxPath('XDG_DATA_HOME'), 'webtoons-biblioteca', 'covers', name);
}

/** Reproduz o formato WTENC1 usado pelo backup (AES-256-GCM + scrypt). */
function encryptForTest(data: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([Buffer.from('WTENC1'), salt, iv, cipher.getAuthTag(), encrypted]);
}

function defer(): { promise: Promise<Response>; resolve: (value: Response) => void } {
  let resolve: (value: Response) => void = () => undefined;
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function toBuffer(body: RequestInit['body']): Buffer {
  if (body === null || body === undefined) return Buffer.alloc(0);
  if (typeof body === 'string') return Buffer.from(body, 'utf-8');
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString(), 'utf-8');
  return Buffer.alloc(0);
}

interface RemoteFile {
  id: string;
  content: Buffer;
  modifiedTime: string;
  size?: string;
}

/** Drive falso: entende as rotas REST usadas pelo backup/restauração. */
class FakeDrive {
  public folderId: string | null = null;
  public readonly files = new Map<string, RemoteFile>();
  private seq = 0;

  public seed(name: string, content: Buffer, size?: string): string {
    const id = `remote-${name}`;
    this.files.set(id, {
      id,
      content,
      modifiedTime: '2026-02-03T04:05:06.000Z',
      ...(size !== undefined ? { size } : {}),
    });
    return id;
  }

  public handle(call: FetchCall): Response {
    const method = (call.init.method ?? 'GET').toUpperCase();
    const url = new URL(call.url);

    if (call.url.startsWith(UPLOAD_API)) {
      return this.upload(call, method);
    }

    if (url.pathname === DRIVE_API_PATH) {
      if (method === 'POST') {
        this.folderId = FOLDER_ID;
        return json({ id: FOLDER_ID });
      }
      if (url.searchParams.get('pageSize') === '1') {
        return json({
          files: this.folderId === null ? [] : [{ id: this.folderId, name: '.webtoons-backup' }],
        });
      }
      return json({
        files: [...this.files.values()].map((file) => ({
          id: file.id,
          name: nameOf(file.id),
          modifiedTime: file.modifiedTime,
          ...(file.size !== undefined ? { size: file.size } : {}),
        })),
      });
    }

    const idMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
    if (idMatch?.[1] !== undefined) {
      const id = idMatch[1];
      const file = this.files.get(id);
      if (file === undefined) return json({ error: { message: 'Arquivo não encontrado.' } }, 404);
      if (method === 'DELETE') {
        this.files.delete(id);
        return new Response(null, { status: 204 });
      }
      if (url.searchParams.get('alt') === 'media') {
        return new Response(new Uint8Array(file.content), { status: 200 });
      }
      return json({ id, name: nameOf(id) });
    }

    return json({ error: { message: `rota desconhecida: ${call.url}` } }, 500);
  }

  private upload(call: FetchCall, method: string): Response {
    const idMatch = /\/files\/([^?]+)\?/.exec(call.url);
    const id = idMatch?.[1] ?? '';
    const content = toBuffer(call.init.body);
    if (method === 'PATCH' && id !== '') {
      const existing = this.files.get(id);
      if (existing === undefined) return json({ error: { message: 'inexistente' } }, 404);
      existing.content = content;
      return json({ id: existing.id, name: nameOf(id) });
    }
    const newId = `remote-${++this.seq}-${extractName(content)}`;
    this.files.set(newId, { id: newId, content, modifiedTime: new Date().toISOString() });
    return json({ id: newId, name: extractName(content) });
  }
}

function nameOf(id: string): string {
  const match = /^remote-(?:\d+-)?(.+)$/.exec(id);
  return match?.[1] ?? id;
}

function extractName(content: Buffer): string {
  const match = /"name":"([^"]+)"/.exec(content.toString('utf-8'));
  return match?.[1] ?? 'desconhecido';
}

/** Zera o estado em memória e em disco entre os testes. */
function resetDrive(): void {
  resetSandbox();
  vi.clearAllMocks();
  disconnect();
  initDrive();
}

/** Faz o fluxo OAuth real do módulo completar contra o callback local. */
async function connect(passphrase = PASSPHRASE): Promise<void> {
  saveSettings({
    driveClientId: CLIENT_ID,
    driveClientSecret: SECRET,
    drivePassphrase: passphrase,
  });
  shell.openExternal.mockImplementationOnce(async (url: string) => {
    const redirect = new URL(url).searchParams.get('redirect_uri');
    if (redirect === null) return;
    const request = http.get(`${redirect}?code=codigo-valido`);
    request.on('error', () => undefined);
  });
  stubFetch((call) => {
    if (call.url === TOKEN_ENDPOINT) {
      return json({
        access_token: 'token-inicial',
        refresh_token: 'refresh-inicial',
        expires_in: 3600,
      });
    }
    if (call.url.startsWith(USERINFO_ENDPOINT)) return json({ email: 'leitor@example.com' });
    return json({ error: { message: `rota desconhecida: ${call.url}` } }, 500);
  });
  const result = await authorize();
  expect(result.ok).toBe(true);
}

describe('estado do Drive', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('inicia desconectado e sem erros', () => {
    const status = getStatus();
    expect(status.connected).toBe(false);
    expect(status.syncing).toBe(false);
    expect(status.lastSync).toBeNull();
    expect(status.lastError).toBeNull();
    expect(status.accountEmail).toBeNull();
    disconnect();
    expect(getStatus().connected).toBe(false);
  });

  it('onStatus recebe o status a cada transição', async () => {
    const listener = vi.fn<(status: DriveStatus) => void>();
    onStatus(listener);
    await connect();
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls.at(-1)?.[0].connected).toBe(true);
    disconnect();
    expect(listener.mock.calls.at(-1)?.[0].connected).toBe(false);
  });

  it('initDrive recarrega os tokens persistidos', async () => {
    await connect();
    expect(fs.existsSync(tokensPath())).toBe(true);
    expect(fs.statSync(tokensPath()).mode & 0o777).toBe(0o600);
    disconnect();
    expect(fs.existsSync(tokensPath())).toBe(false);

    fs.writeFileSync(
      tokensPath(),
      JSON.stringify({
        accessToken: 'renovado',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 3_600_000,
        accountEmail: 'outra@x.com',
        lastSync: '2026-01-05T00:00:00.000Z',
      }),
      'utf-8',
    );
    initDrive();
    const status = getStatus();
    expect(status.connected).toBe(true);
    expect(status.accountEmail).toBe('outra@x.com');
    expect(status.lastSync).toBe('2026-01-05T00:00:00.000Z');
    expect(status.lastError).toBeNull();
  });

  it('initDrive ignora arquivo de tokens corrompido', () => {
    fs.mkdirSync(path.dirname(tokensPath()), { recursive: true });
    fs.writeFileSync(tokensPath(), '{ corrompido', 'utf-8');
    initDrive();
    expect(getStatus().connected).toBe(false);
  });
});

describe('authorize', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('falha quando as credenciais OAuth não estão configuradas', async () => {
    const result = await authorize();
    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'Configure o Client ID e o Client Secret do Google nas configurações.',
    );
    expect(getStatus().lastError).toBeNull();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('conclui o OAuth pelo callback local e grava o e-mail da conta', async () => {
    await connect();
    const status = getStatus();
    expect(status.connected).toBe(true);
    expect(status.accountEmail).toBe('leitor@example.com');
    expect(status.lastError).toBeNull();
    expect(shell.openExternal).toHaveBeenCalledTimes(1);
  });

  it('propaga o erro quando o usuário recusa a autorização', async () => {
    saveSettings({ driveClientId: CLIENT_ID, driveClientSecret: SECRET, drivePassphrase: '' });
    shell.openExternal.mockImplementationOnce(async (url: string) => {
      const redirect = new URL(url).searchParams.get('redirect_uri');
      if (redirect === null) return;
      const request = http.get(`${redirect}?error=access_denied`);
      request.on('error', () => undefined);
    });
    const result = await authorize();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('access_denied');
    expect(getStatus().lastError).toBe('access_denied');
  });

  it('reporta falha na troca do código por tokens', async () => {
    saveSettings({ driveClientId: CLIENT_ID, driveClientSecret: SECRET, drivePassphrase: '' });
    shell.openExternal.mockImplementationOnce(async (url: string) => {
      const redirect = new URL(url).searchParams.get('redirect_uri');
      if (redirect === null) return;
      const request = http.get(`${redirect}?code=codigo-valido`);
      request.on('error', () => undefined);
    });
    stubFetch(() => json({ error: 'invalid_grant' }, 400));
    const result = await authorize();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Falha ao obter tokens (400).');
    expect(getStatus().lastError).toBe('Falha ao obter tokens (400).');
  });
});

describe('backupNow', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('exige conta conectada', async () => {
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Conecte a conta Google primeiro.',
    });
  });

  it('exige uma biblioteca local', async () => {
    await connect();
    stubFetch(() => json({ files: [] }));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Nenhuma biblioteca local para backup. Adicione ao menos uma obra.',
    });
    expect(getStatus().syncing).toBe(false);
  });

  it('recusa execução paralela enquanto sincroniza', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-1' })]);
    const gate = defer();
    stubFetch((call) => {
      if (call.url.includes('pageSize=1')) return gate.promise;
      return json({});
    });
    const first = backupNow();
    await vi.waitFor(() => expect(getStatus().syncing).toBe(true));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Sincronização já em andamento.',
    });
    gate.resolve(json({ error: { message: 'cancelado' } }, 500));
    const outcome = await first;
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('cancelado');
    expect(getStatus().syncing).toBe(false);
  });

  it('exige senha de criptografia antes de enviar', async () => {
    await connect('');
    saveLibrary([makeWork({ id: 'obra-2' })]);
    const drive = new FakeDrive();
    stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Defina uma senha de criptografia do backup nas configurações.');
    expect(getStatus().lastError).toBe(
      'Defina uma senha de criptografia do backup nas configurações.',
    );
    expect(getStatus().syncing).toBe(false);
  });

  it('cria a pasta oculta, envia cifrado e registra o resumo', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-3', title: 'Título Sigiloso' })]);
    const drive = new FakeDrive();
    stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(true);
    expect(result.summary?.name).toBe('library.json');
    expect(result.summary?.id).toBe('novo');
    expect(result.summary?.works).toBe(1);
    expect(result.summary?.size ?? 0).toBeGreaterThan(0);
    expect(getStatus().lastSync).not.toBeNull();
    expect(drive.folderId).toBe(FOLDER_ID);

    const uploads = [...drive.files.values()].map((file) => file.content);
    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads.some((body) => body.includes(Buffer.from('WTENC1')))).toBe(true);
    expect(uploads.some((body) => body.includes(Buffer.from('Título Sigiloso')))).toBe(false);
  });

  it('atualiza arquivos existentes e apaga remotos órfãos', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-4' })]);
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from('[]'));
    drive.seed('capa-antiga.png', Buffer.from('png'));
    const deleted: string[] = [];
    const original = drive.handle.bind(drive);
    stubFetch((call) => {
      if ((call.init.method ?? 'GET').toUpperCase() === 'DELETE') {
        const id = /\/files\/([^/]+)$/.exec(new URL(call.url).pathname)?.[1] ?? '';
        deleted.push(id);
      }
      return original(call);
    });

    const result = await backupNow();
    expect(result.ok).toBe(true);
    expect(result.summary?.id).toBe('remote-library.json');
    expect(deleted).toContain('remote-capa-antiga.png');
    expect(drive.files.has('remote-capa-antiga.png')).toBe(false);
    expect(drive.files.has('remote-library.json')).toBe(true);
  });

  it('escapa aspas na pasta e nos ids consultados', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-7' })]);
    const drive = new FakeDrive();
    drive.folderId = `id'com\\barra`;
    drive.seed('library.json', Buffer.from('[]'));
    const calls = stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(true);
    const listCall = calls.find((call) => call.url.includes('pageSize=1000'));
    expect(listCall).toBeDefined();
    const decoded = decodeURIComponent(String(listCall?.url ?? ''));
    expect(decoded).toContain("\\'");
    expect(decoded).toContain('\\\\barra');
  });

  it('reporta erro vindo da API do Drive', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-5' })]);
    stubFetch(() => json({ error: { message: 'Cota excedida.' } }, 403));
    const result = await backupNow();
    expect(result).toEqual({ ok: false, error: 'Cota excedida.' });
    expect(getStatus().lastError).toBe('Cota excedida.');
    expect(getStatus().syncing).toBe(false);
  });

  it('reporta erro sem corpo JSON aproveitável', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-6' })]);
    stubFetch(() => new Response('erro interno', { status: 500 }));
    const result = await backupNow();
    expect(result).toEqual({ ok: false, error: 'Erro do Google Drive (HTTP 500).' });
  });
});

describe('restoreNow', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('exige conta conectada', async () => {
    expect(await restoreNow()).toEqual({
      ok: false,
      error: 'Conecte a conta Google primeiro.',
    });
  });

  it('restaura biblioteca e capas a partir do backup', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    const works = [makeWork({ id: 'restaurada', coverFile: 'capa.png' })];
    drive.seed('library.json', Buffer.from(JSON.stringify(works)));
    drive.seed('capa.png', Buffer.from('bytes-da-capa'));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow();
    expect(result).toEqual({ ok: true, works: 1 });
    expect(loadLibrary().map((work) => work.id)).toEqual(['restaurada']);
    expect(fs.readFileSync(coversPath('capa.png')).toString('utf-8')).toBe('bytes-da-capa');
  });

  it('descriptografa o backup com a senha configurada', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    const payload = [makeWork({ id: 'cifrada' })];
    drive.seed('library.json', encryptForTest(Buffer.from(JSON.stringify(payload)), PASSPHRASE));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow();
    expect(result).toEqual({ ok: true, works: 1 });
    expect(loadLibrary()[0]?.id).toBe('cifrada');
  });

  it('recusa senha de criptografia errada', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    const payload = [makeWork({ id: 'cifrada' })];
    drive.seed('library.json', encryptForTest(Buffer.from(JSON.stringify(payload)), 'outra-senha'));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow();
    expect(result).toEqual({
      ok: false,
      error: 'Senha de criptografia incorreta ou backup corrompido.',
    });
  });

  it('falha quando não há library.json no Drive', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow()).toEqual({
      ok: false,
      error: 'Nenhum backup encontrado na pasta oculta do Drive.',
    });
  });

  it('falha quando o backup não é uma lista de obras válida', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from(JSON.stringify([{ id: 42 }])));
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow()).toEqual({
      ok: false,
      error: 'Backup inválido (library.json corrompido).',
    });
  });

  it('falha quando o conteúdo nem é uma lista', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from(JSON.stringify({ obras: [] })));
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow()).toEqual({
      ok: false,
      error: 'Backup inválido (library.json corrompido).',
    });
  });

  it('reporta erro da API durante a restauração', async () => {
    await connect();
    stubFetch(() => json({ error: { message: 'Sem permissão.' } }, 403));
    const result = await restoreNow();
    expect(result).toEqual({ ok: false, error: 'Sem permissão.' });
    expect(getStatus().lastError).toBe('Sem permissão.');
  });
});

describe('backupInfo', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('devolve null quando não há conta conectada', async () => {
    expect(await backupInfo()).toBeNull();
  });

  it('devolve null quando ainda não existe pasta de backup', async () => {
    await connect();
    stubFetch(() => json({ files: [] }));
    expect(await backupInfo()).toBeNull();
  });

  it('devolve null quando não há library.json remoto', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    stubFetch((call) => drive.handle(call));
    expect(await backupInfo()).toBeNull();
  });

  it('resume o backup remoto com o tamanho informado pelo Drive', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed(
      'library.json',
      Buffer.from(JSON.stringify([makeWork(), makeWork({ id: 'b' })])),
      '2048',
    );
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info).toEqual({
      id: 'remote-library.json',
      name: 'library.json',
      modifiedTime: '2026-02-03T04:05:06.000Z',
      size: 2048,
      works: 2,
    });
  });

  it('usa o tamanho do buffer quando o Drive não informa', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from('[]'));
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info?.size).toBe(2);
    expect(info?.works).toBe(0);
  });

  it('conta zero obras quando o backup remoto não é uma lista', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from('{"x":1}'), '9');
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info?.works).toBe(0);
    expect(info?.size).toBe(9);
  });

  it('devolve null quando o backup remoto é inválido', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from('não é json'));
    stubFetch((call) => drive.handle(call));
    expect(await backupInfo()).toBeNull();
  });
});

describe('renovação de sessão', () => {
  beforeEach(() => {
    resetDrive();
  });

  async function seedExpiredTokens(refreshToken: string | undefined): Promise<void> {
    fs.mkdirSync(path.dirname(tokensPath()), { recursive: true });
    fs.writeFileSync(
      tokensPath(),
      JSON.stringify({
        accessToken: 'antigo',
        refreshToken,
        expiresAt: Date.now() - 1000,
        accountEmail: 'leitor@example.com',
        lastSync: null,
      }),
      'utf-8',
    );
    saveSettings({
      driveClientId: CLIENT_ID,
      driveClientSecret: SECRET,
      drivePassphrase: PASSPHRASE,
    });
    initDrive();
  }

  it('renova o access token expirado antes de chamar a API', async () => {
    await seedExpiredTokens('refresh-legal');
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from('[]'));
    const calls = stubFetch((call) =>
      call.url === TOKEN_ENDPOINT
        ? json({ access_token: 'renovado', expires_in: 3600 })
        : drive.handle(call),
    );

    expect(await backupInfo()).not.toBeNull();
    const refresh = calls.find((call) => call.url === TOKEN_ENDPOINT);
    expect(refresh).toBeDefined();
    const body = String(refresh?.init.body ?? '');
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=refresh-legal');
    expect(getStatus().connected).toBe(true);
  });

  it('sem refresh token, orienta reconectar a conta', async () => {
    await seedExpiredTokens(undefined);
    saveLibrary([makeWork({ id: 'obra-8' })]);
    stubFetch(() => json({}));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Sessão expirada. Conecte a conta Google novamente.',
    });
    expect(getStatus().lastError).toBe('Sessão expirada. Conecte a conta Google novamente.');
  });

  it('sem credenciais OAuth, orienta reconectar a conta', async () => {
    await seedExpiredTokens('refresh-legal');
    saveSettings({ driveClientId: '', driveClientSecret: '', drivePassphrase: PASSPHRASE });
    saveLibrary([makeWork({ id: 'obra-9' })]);
    stubFetch(() => json({}));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Sessão expirada. Conecte a conta Google novamente.',
    });
  });

  it('reporta falha quando a renovação é recusada', async () => {
    await seedExpiredTokens('refresh-legal');
    saveLibrary([makeWork({ id: 'obra-10' })]);
    stubFetch(() => json({ error: 'invalid_grant' }, 400));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Não foi possível renovar a sessão do Google Drive.',
    });
    expect(getStatus().lastError).toBe('Não foi possível renovar a sessão do Google Drive.');
  });
});

describe('retry após 401', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('renova o token e repete a chamada', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.folderId = FOLDER_ID;
    drive.seed('library.json', Buffer.from('[]'));
    let unauthorized = true;
    const calls = stubFetch((call) => {
      if (call.url === TOKEN_ENDPOINT) {
        return json({ access_token: 'renovado', expires_in: 3600 });
      }
      if (unauthorized && call.url.includes('pageSize=1000')) {
        unauthorized = false;
        return json({}, 401);
      }
      return drive.handle(call);
    });

    expect(await backupInfo()).not.toBeNull();
    expect(calls.filter((call) => call.url.includes('pageSize=1000'))).toHaveLength(2);
  });
});

afterEach(() => {
  onStatus(() => undefined);
});
