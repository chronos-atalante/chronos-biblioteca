import { DRIVE_API, FOLDER_MIME, FOLDER_NAME, UPLOAD_API } from '@zero/main/drive/constants';
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

export async function findBackupFolder(): Promise<string | null> {
  const q = `name='${escapeQuery(FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const res = await driveFetch(url);
  const data = (await res.json()) as { files?: { id: string }[] | undefined };
  return data.files?.[0]?.id ?? null;
}

async function createBackupFolder(): Promise<string> {
  const url = `${DRIVE_API}/files?fields=id`;
  const res = await driveFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function ensureFolder(): Promise<string> {
  const existing = await findBackupFolder();
  if (existing !== null) return existing;
  return createBackupFolder();
}

export async function listFolder(folderId: string): Promise<RemoteFile[]> {
  const q = `'${escapeQuery(folderId)}' in parents and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&pageSize=1000`;
  const res = await driveFetch(url);
  const data = (await res.json()) as { files?: RemoteFile[] | undefined };
  return data.files ?? [];
}

export async function uploadMultipart(
  folderId: string,
  name: string,
  buffer: Buffer,
  mime: string,
  existingId?: string,
): Promise<void> {
  const boundary = `----webtoons${Date.now()}${Math.random().toString(16).slice(2)}`;
  const meta = existingId === undefined ? { name, parents: [folderId] } : { name };
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
