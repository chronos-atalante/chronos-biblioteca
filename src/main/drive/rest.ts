import {
  APP_DATA_SPACE,
  DRIVE_API,
  FOLDER_MIME,
  LEGACY_FOLDER_NAME,
  UPLOAD_API,
} from '@zero/main/drive/constants';
import { accessToken, refreshAccessToken } from '@zero/main/drive/oauth';

export interface RemoteFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string | undefined;
}

export async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let token = await accessToken();
  const withAuth = (): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
  let res = await fetch(url, withAuth());
  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await fetch(url, withAuth());
  }
  if (!res.ok) {
    let detail = '';
    try {
      const data = (await res.json()) as { error?: { message?: string | undefined } | undefined };
      detail = data.error?.message ?? '';
    } catch {
      // resposta sem corpo JSON aproveitável
    }
    throw new Error(detail !== '' ? detail : `Erro do Google Drive (HTTP ${res.status}).`);
  }
  return res;
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function listPages(buildUrl: (pageToken: string) => string): Promise<RemoteFile[]> {
  const files: RemoteFile[] = [];
  let pageToken = '';
  do {
    const res = await driveFetch(buildUrl(pageToken));
    const data = (await res.json()) as {
      files?: RemoteFile[] | undefined;
      nextPageToken?: string | undefined;
    };
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? '';
  } while (pageToken !== '');
  return files;
}

const FILE_FIELDS = 'nextPageToken,files(id,name,modifiedTime,size)';

/** Lista os arquivos no espaço oculto appDataFolder (invisível na interface do Drive). */
export function listAppDataFiles(): Promise<RemoteFile[]> {
  return listPages((pageToken) => {
    const params = new URLSearchParams({
      spaces: APP_DATA_SPACE,
      q: 'trashed=false',
      fields: FILE_FIELDS,
      pageSize: '1000',
      pageToken,
    });
    return `${DRIVE_API}/files?${params.toString()}`;
  });
}

/** Procura a pasta legada ".webtoons-backup" em "Meu Drive" (migração). */
export async function findLegacyFolder(): Promise<string | null> {
  const q = `name='${escapeQuery(LEGACY_FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const res = await driveFetch(url);
  const data = (await res.json()) as { files?: { id: string }[] | undefined };
  return data.files?.[0]?.id ?? null;
}

export function listFolder(folderId: string): Promise<RemoteFile[]> {
  const q = `'${escapeQuery(folderId)}' in parents and trashed=false`;
  return listPages((pageToken) => {
    const params = new URLSearchParams({
      q,
      fields: FILE_FIELDS,
      pageSize: '1000',
      pageToken,
    });
    return `${DRIVE_API}/files?${params.toString()}`;
  });
}

export async function uploadMultipart(
  parent: string,
  name: string,
  buffer: Buffer,
  mime: string,
  existingId?: string,
): Promise<void> {
  const boundary = `----webtoons${Date.now()}${Math.random().toString(16).slice(2)}`;
  const meta = existingId === undefined ? { name, parents: [parent] } : { name };
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    'utf-8',
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const body = Buffer.concat([head, buffer, tail]);

  const url =
    existingId === undefined
      ? `${UPLOAD_API}/files?uploadType=multipart&fields=id,name`
      : `${UPLOAD_API}/files/${existingId}?uploadType=multipart&fields=id,name`;

  await driveFetch(url, {
    method: existingId === undefined ? 'POST' : 'PATCH',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`);
  const data = await res.arrayBuffer();
  return Buffer.from(data);
}

export async function deleteFile(fileId: string): Promise<void> {
  await driveFetch(`${DRIVE_API}/files/${fileId}`, { method: 'DELETE' });
}
