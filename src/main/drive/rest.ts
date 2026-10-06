import { API_ENDPOINT, CONTENT_ENDPOINT } from '@zero/main/drive/constants';
import { accessToken, refreshAccessToken } from '@zero/main/drive/oauth';
import { parseJson } from '@zero/main/drive/json';
import { currentMessages } from '@zero/main/i18n';

export interface RemoteFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: number | undefined;
}

interface DropboxEntry {
  '.tag'?: string | undefined;
  id?: string | undefined;
  name?: string | undefined;
  server_modified?: string | undefined;
  size?: number | undefined;
}

interface ListFolderResponse {
  entries?: DropboxEntry[] | undefined;
  cursor?: string | undefined;
  has_more?: boolean | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Valida a página de `list_folder` antes de ler campo algum.
 *
 * Os elementos de `entries` são checados campo a campo em `toRemoteFile`
 * (id/nome/tipos); aqui só se garante a forma da resposta como um todo —
 * corpo malformado vira erro explícito em vez de listagem vazia silenciosa.
 */
function isListFolderResponse(value: unknown): value is ListFolderResponse {
  if (!isRecord(value)) return false;
  if ('entries' in value && !(Array.isArray(value.entries) && value.entries.every(isRecord))) {
    return false;
  }
  if ('cursor' in value && typeof value.cursor !== 'string') return false;
  if ('has_more' in value && typeof value.has_more !== 'boolean') return false;
  return true;
}

/** Lê a página de `list_folder` validada; corpo inválido é falha fechada. */
async function listFolderPage(res: Response): Promise<ListFolderResponse> {
  const data: unknown = await parseJson(res);
  if (!isListFolderResponse(data)) {
    throw new Error(currentMessages().driveErrors.invalidListResponse);
  }
  return data;
}

/** `error_summary` é legível como está; corpo de outro formato é ignorado. */
function isErrorSummary(value: unknown): value is { error_summary: string } {
  if (!isRecord(value) || !('error_summary' in value)) return false;
  return typeof value.error_summary === 'string';
}

function toRemoteFile(entry: DropboxEntry): RemoteFile | null {
  if (entry['.tag'] !== 'file') return null;
  const { id, name } = entry;
  if (typeof id !== 'string' || typeof name !== 'string') return null;
  return {
    id,
    name,
    modifiedTime: entry.server_modified ?? '',
    ...(entry.size !== undefined ? { size: entry.size } : {}),
  };
}

async function apiFetch(path: string, body: unknown): Promise<Response> {
  const token = await accessToken();
  const run = async (bearer: string): Promise<Response> =>
    fetch(`${API_ENDPOINT}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  let res = await run(token);
  if (res.status === 401) {
    res = await run(await refreshAccessToken());
  }
  if (!res.ok) throw await toDropboxError(res);
  return res;
}

async function toDropboxError(res: Response): Promise<Error> {
  let detail = '';
  let raw = '';
  try {
    // `error_summary` já é legível (ex.: "insufficient_space/..."); usa cru.
    const data: unknown = await parseJson(res.clone());
    if (isErrorSummary(data)) detail = data.error_summary;
  } catch {
    // resposta sem corpo JSON aproveitável
  }
  if (detail === '') {
    try {
      raw = (await res.text()).slice(0, 160);
    } catch {
      raw = '';
    }
  }
  // Escopo faltando (permissão não marcada no App Console, ou sessão concedida
  // antes dela): traduz para ação concreta em vez de vazar o inglês da API.
  if (/missing_scope|required scope/i.test(`${detail} ${raw}`)) {
    throw new Error(currentMessages().driveErrors.missingScopes);
  }
  throw new Error(
    detail !== '' ? detail : currentMessages().driveErrors.dropboxHttp(res.status, raw),
  );
}

/**
 * Lista os arquivos na raiz da pasta do app (`/Apps/<nome>`).
 *
 * Com permissão "App folder" a raiz da API já é a pasta do aplicativo:
 * nada fora dela é visível ou acessível.
 */
export async function listAppFiles(): Promise<RemoteFile[]> {
  const files: RemoteFile[] = [];
  const first = await apiFetch('/files/list_folder', {
    path: '',
    recursive: false,
    limit: 2000,
  });
  let data = await listFolderPage(first);
  for (const entry of data.entries ?? []) {
    const file = toRemoteFile(entry);
    if (file !== null) files.push(file);
  }
  let cursor = data.cursor ?? '';
  let hasMore = data.has_more ?? false;
  while (hasMore) {
    const res = await apiFetch('/files/list_folder/continue', { cursor });
    data = await listFolderPage(res);
    for (const entry of data.entries ?? []) {
      const file = toRemoteFile(entry);
      if (file !== null) files.push(file);
    }
    cursor = data.cursor ?? '';
    hasMore = data.has_more ?? false;
  }
  return files;
}

async function contentFetch(
  endpoint: 'upload' | 'download',
  apiArg: Record<string, string | boolean>,
  body?: Buffer,
): Promise<Response> {
  const token = await accessToken();
  const run = async (bearer: string): Promise<Response> =>
    fetch(`${CONTENT_ENDPOINT}/files/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Dropbox-API-Arg': JSON.stringify(apiArg),
        'Content-Type': 'application/octet-stream',
      },
      body: body === undefined ? null : new Uint8Array(body),
    });
  let res = await run(token);
  if (res.status === 401) {
    res = await run(await refreshAccessToken());
  }
  if (!res.ok) throw await toDropboxError(res);
  return res;
}

/** Sobe (ou sobrescreve) um arquivo na pasta do app. */
export async function uploadFile(name: string, buffer: Buffer): Promise<void> {
  // Tipos exatos: a API rejeita (HTTP 400) `autorename`/`mute` como string.
  await contentFetch(
    'upload',
    { path: `/${name}`, mode: 'overwrite', autorename: false, mute: true },
    buffer,
  );
}

/** Baixa um arquivo pelo id retornado em `listAppFiles`. */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await contentFetch('download', { path: fileId });
  const data = await res.arrayBuffer();
  return Buffer.from(data);
}

/** Apaga um arquivo pelo id retornado em `listAppFiles`. */
export async function deleteFile(fileId: string): Promise<void> {
  await apiFetch('/files/delete_v2', { path: fileId });
}
