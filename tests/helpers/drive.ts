import crypto from 'crypto';
import http from 'http';
import path from 'path';
import { vi } from 'vitest';
import { authorize, disconnect, initDrive } from '@zero/main/drive';
import { saveSettings } from '@zero/main/settings';
import { shell } from '../mocks/electron.ts';
import { resetSandbox, sandboxPath } from './sandbox.ts';

export const CLIENT_ID = 'id.apps.googleusercontent.com';
export const SECRET = 'GOCSPX-segredo';
export const PASSPHRASE = 'frase-secreta';

export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_API_PATH = '/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

export const LEGACY_FOLDER_ID = `id'com\\barra`;

export interface FetchCall {
  url: string;
  init: RequestInit;
}

type FetchHandler = (call: FetchCall) => Response | Promise<Response>;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Normaliza o primeiro argumento de `fetch` sem passar por `String()` em objetos. */
function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Corpo textual de uma chamada (o app envia string ou URLSearchParams). */
export function bodyText(call: FetchCall | undefined): string {
  const body = call?.init.body;
  return typeof body === 'string' ? body : '';
}

export function stubFetch(handler: FetchHandler): FetchCall[] {
  const calls: FetchCall[] = [];
  const mock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    (input, init) => {
      const call: FetchCall = { url: requestUrl(input), init: init ?? {} };
      calls.push(call);
      return Promise.resolve(handler(call));
    },
  );
  vi.stubGlobal('fetch', mock);
  return calls;
}

function configPath(name: string): string {
  return path.join(sandboxPath('XDG_CONFIG_HOME'), 'chronos-biblioteca', name);
}

export function tokensPath(): string {
  return configPath('drive-tokens.json');
}

export function coversPath(name: string): string {
  return path.join(sandboxPath('XDG_DATA_HOME'), 'chronos-biblioteca', 'covers', name);
}

/** Reproduz o formato legado WTENC1 (scrypt padrão) para testar restauração antiga. */
export function encryptForTest(data: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([Buffer.from('WTENC1'), salt, iv, cipher.getAuthTag(), encrypted]);
}

export function defer(): { promise: Promise<Response>; resolve: (value: Response) => void } {
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
export class FakeDrive {
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

    if (url.pathname === DRIVE_API_PATH && method === 'GET') {
      // pageSize=1 é a busca da pasta legada ".webtoons-backup" (migração).
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
      const id = decodeURIComponent(idMatch[1]);
      if (method === 'DELETE' && id === this.folderId) {
        this.folderId = null;
        return new Response(null, { status: 204 });
      }
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
    const id = idMatch?.[1] === undefined ? '' : decodeURIComponent(idMatch[1]);
    const raw = toBuffer(call.init.body);
    const content = extractMedia(raw);
    if (method === 'PATCH' && id !== '') {
      const existing = this.files.get(id);
      if (existing === undefined) return json({ error: { message: 'inexistente' } }, 404);
      existing.content = content;
      return json({ id: existing.id, name: nameOf(id) });
    }
    const metaName = extractName(raw);
    const newId = `remote-${++this.seq}-${metaName}`;
    this.files.set(newId, { id: newId, content, modifiedTime: new Date().toISOString() });
    return json({ id: newId, name: metaName });
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

/**
 * O Drive real guarda só a parte de mídia do `multipart/related`; o falso
 * faz o mesmo (antes guardava o envelope inteiro, e o conteúdo baixado não
 * correspondia ao que foi cifrado).
 */
function extractMedia(body: Buffer): Buffer {
  const sep = Buffer.from('\r\n\r\n');
  const first = body.indexOf(sep);
  if (first === -1) return body;
  const second = body.indexOf(sep, first + sep.length);
  if (second === -1) return body;
  const start = second + sep.length;
  const end = body.lastIndexOf(Buffer.from('\r\n--'));
  if (end === -1 || end < start) return body;
  return body.subarray(start, end);
}

/** Zera o estado em memória e em disco entre os testes. */
export function resetDrive(): void {
  resetSandbox();
  vi.clearAllMocks();
  disconnect();
  initDrive();
}

/** Faz o fluxo OAuth real do módulo completar contra o callback local. */
export async function connect(passphrase = PASSPHRASE): Promise<void> {
  saveSettings({
    driveClientId: CLIENT_ID,
    driveClientSecret: SECRET,
    drivePassphrase: passphrase,
  });
  shell.openExternal.mockImplementationOnce((url: string): Promise<void> => {
    const redirect = new URL(url).searchParams.get('redirect_uri');
    if (redirect !== null) {
      const request = http.get(`${redirect}?code=codigo-valido`);
      request.on('error', () => undefined);
    }
    return Promise.resolve();
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
  if (!result.ok) throw new Error(`Falha ao conectar no teste: ${result.error ?? 'desconhecida'}`);
}
