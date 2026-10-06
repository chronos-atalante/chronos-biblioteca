import http from 'http';
import path from 'path';
import { vi } from 'vitest';
import { authorize, disconnect, initDrive } from '@zero/main/drive';
import { saveSettings } from '@zero/main/settings';
import { shell } from '../mocks/electron.ts';
import { resetSandbox, sandboxPath } from './sandbox.ts';

export const APP_KEY = 'app-key-do-teste';
export const PASSPHRASE = 'frase-secreta';

export const TOKEN_ENDPOINT = 'https://api.dropboxapi.com/oauth2/token';
export const ACCOUNT_ENDPOINT = 'https://api.dropboxapi.com/2/users/get_current_account';
export const LIST_FOLDER_ENDPOINT = 'https://api.dropboxapi.com/2/files/list_folder';
export const UPLOAD_ENDPOINT = 'https://content.dropboxapi.com/2/files/upload';
export const DOWNLOAD_ENDPOINT = 'https://content.dropboxapi.com/2/files/download';

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
  const body: unknown = call?.init.body;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  return '';
}

/** Lê um header da chamada, seja `Headers` ou objeto simples. */
export function headerOf(call: FetchCall, name: string): string {
  try {
    return new Headers(call.init.headers).get(name) ?? '';
  } catch {
    return '';
  }
}

/** JSON do corpo quando a chamada enviou string ou URLSearchParams. */
export function jsonBody(call: FetchCall): Record<string, unknown> {
  try {
    return JSON.parse(bodyText(call)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Lê um campo string do JSON do corpo ('' se ausente ou de outro tipo). */
export function bodyField(call: FetchCall, name: string): string {
  const value: unknown = jsonBody(call)[name];
  return typeof value === 'string' ? value : '';
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
  return configPath('dropbox-tokens.json');
}

export function coversPath(name: string): string {
  return path.join(sandboxPath('XDG_DATA_HOME'), 'chronos-biblioteca', 'covers', name);
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

export interface FakeRemoteFile {
  id: string;
  name: string;
  content: Buffer;
  modifiedTime: string;
  size?: number | undefined;
}

/** Dropbox falso: entende as rotas usadas pelo backup/restauração. */
export class FakeDropbox {
  public readonly files = new Map<string, FakeRemoteFile>();
  /** Tamanho da página de `list_folder`; `Infinity` desliga a paginação. */
  public pageSize = Number.POSITIVE_INFINITY;
  private seq = 0;

  public seed(name: string, content: Buffer, size?: number): string {
    const id = `id:arquivo-${++this.seq}`;
    this.files.set(id, {
      id,
      name,
      content,
      modifiedTime: '2026-02-03T04:05:06.000Z',
      size: size ?? content.byteLength,
    });
    return id;
  }

  public seedWithoutSize(name: string, content: Buffer): string {
    const id = this.seed(name, content);
    const file = this.files.get(id);
    if (file !== undefined) delete file.size;
    return id;
  }

  public findByName(name: string): FakeRemoteFile | undefined {
    for (const file of this.files.values()) {
      if (file.name === name) return file;
    }
    return undefined;
  }

  public handle(call: FetchCall): Response {
    const method = (call.init.method ?? 'GET').toUpperCase();

    if (call.url === LIST_FOLDER_ENDPOINT && method === 'POST') {
      const entries = [...this.files.values()].map((file) => ({
        '.tag': 'file',
        id: file.id,
        name: file.name,
        server_modified: file.modifiedTime,
        size: file.size,
      }));
      if (entries.length <= this.pageSize) {
        return json({ entries, cursor: 'cursor-fim', has_more: false });
      }
      return json({
        entries: entries.slice(0, this.pageSize),
        cursor: `cursor-${this.pageSize}`,
        has_more: true,
      });
    }

    if (call.url === `${LIST_FOLDER_ENDPOINT}/continue` && method === 'POST') {
      const rawOffset = Number(bodyField(call, 'cursor').replace(/^cursor-/, ''));
      const offset = Number.isNaN(rawOffset) ? 0 : rawOffset;
      const entries = [...this.files.values()]
        .map((file) => ({
          '.tag': 'file',
          id: file.id,
          name: file.name,
          server_modified: file.modifiedTime,
          size: file.size,
        }))
        .slice(offset, offset + this.pageSize);
      const rest = offset + this.pageSize;
      const total = this.files.size;
      return json({
        entries,
        cursor: rest >= total ? 'cursor-fim' : `cursor-${rest}`,
        has_more: rest < total,
      });
    }

    if (call.url === 'https://api.dropboxapi.com/2/files/delete_v2' && method === 'POST') {
      const id = bodyField(call, 'path');
      if (id === '' || !this.files.has(id)) return json({ error_summary: 'not_found' }, 409);
      this.files.delete(id);
      return json({ metadata: { '.tag': 'file', id } });
    }

    if (call.url === ACCOUNT_ENDPOINT && method === 'POST') {
      return json({ account_id: 'conta-1', email: 'leitor@example.com' });
    }

    if (call.url === UPLOAD_ENDPOINT && method === 'POST') {
      const arg = JSON.parse(headerOf(call, 'Dropbox-API-Arg')) as {
        path?: unknown;
        mode?: unknown;
        autorename?: unknown;
        mute?: unknown;
      };
      // A API real rejeita (HTTP 400) tipos fora do contrato.
      if (typeof arg.path !== 'string' || arg.mode !== 'overwrite') {
        return json({ error_summary: 'invalid_argument' }, 400);
      }
      if (typeof arg.autorename !== 'boolean' || typeof arg.mute !== 'boolean') {
        return json({ error_summary: 'invalid_argument' }, 400);
      }
      const name = arg.path.replace(/^\//, '');
      const content = toBuffer(call.init.body);
      const existing = this.findByName(name);
      if (existing !== undefined) {
        existing.content = content;
        existing.size = content.byteLength;
        existing.modifiedTime = new Date().toISOString();
        return json({ '.tag': 'file', id: existing.id, name });
      }
      const id = `id:arquivo-${++this.seq}`;
      this.files.set(id, {
        id,
        name,
        content,
        modifiedTime: new Date().toISOString(),
        size: content.byteLength,
      });
      return json({ '.tag': 'file', id, name });
    }

    if (call.url === DOWNLOAD_ENDPOINT && method === 'POST') {
      const arg = JSON.parse(headerOf(call, 'Dropbox-API-Arg')) as { path?: string };
      const file = this.files.get(arg.path ?? '');
      if (file === undefined) return json({ error_summary: 'not_found/' }, 409);
      return new Response(new Uint8Array(file.content), { status: 200 });
    }

    return json({ error_summary: `rota_desconhecida/${call.url}` }, 500);
  }
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
    driveClientId: APP_KEY,
    driveClientSecret: '',
    drivePassphrase: passphrase,
  });
  shell.openExternal.mockImplementationOnce((url: string): Promise<void> => {
    const params = new URL(url).searchParams;
    const redirect = params.get('redirect_uri');
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
        scope:
          'account_info.read files.metadata.read files.metadata.write ' +
          'files.content.read files.content.write',
      });
    }
    if (call.url === ACCOUNT_ENDPOINT) return json({ email: 'leitor@example.com' });
    return json({ error_summary: `rota_desconhecida/${call.url}` }, 500);
  });
  const result = await authorize();
  if (!result.ok) throw new Error(`Falha ao conectar no teste: ${result.error ?? 'desconhecida'}`);
}
