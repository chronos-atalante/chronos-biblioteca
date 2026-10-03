import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { URLSearchParams } from 'url';
import { shell } from 'electron';
import type { BackupSummary, DriveStatus, Work } from '../shared/types';
import { loadSettings } from './settings';
import { backupFiles, configDir, coversDir, loadLibrary, restoreLibrary } from './library';

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email'].join(' ');

/** Pasta oculta no Drive (prefixo "." mantém ela fora das listagens comuns) */
const FOLDER_NAME = '.webtoons-backup';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

interface Tokens {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt: number;
  accountEmail: string | null;
  lastSync: string | null;
}

interface State {
  tokens: Tokens | null;
  lastError: string | null;
  syncing: boolean;
}

interface AuthOutcome {
  code: string | null;
  error: string | null;
}

interface RemoteFile {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string | undefined;
}

const state: State = { tokens: null, lastError: null, syncing: false };

let statusListener: ((status: DriveStatus) => void) | null = null;

function ensureConfig(): void {
  fs.mkdirSync(configDir(), { recursive: true });
}

function statePath(): string {
  return path.join(configDir(), 'drive-tokens.json');
}

function loadState(): void {
  ensureConfig();
  try {
    const file = statePath();
    if (fs.existsSync(file)) {
      state.tokens = JSON.parse(fs.readFileSync(file, 'utf-8')) as Tokens;
    }
  } catch {
    state.tokens = null;
  }
}

function persistState(): void {
  ensureConfig();
  if (state.tokens !== null) {
    fs.writeFileSync(statePath(), JSON.stringify(state.tokens, null, 2), { encoding: 'utf-8', mode: 0o600 });
  } else if (fs.existsSync(statePath())) {
    fs.unlinkSync(statePath());
  }
}

export function getStatus(): DriveStatus {
  return {
    connected: state.tokens !== null && state.tokens.accessToken !== '',
    syncing: state.syncing,
    lastSync: state.tokens?.lastSync ?? null,
    lastError: state.lastError,
    accountEmail: state.tokens?.accountEmail ?? null,
  };
}

function emit(): void {
  statusListener?.(getStatus());
}

export function onStatus(listener: (status: DriveStatus) => void): void {
  statusListener = listener;
}

function credentials(): { clientId: string; clientSecret: string } | null {
  const settings = loadSettings();
  if (settings.driveClientId === '' || settings.driveClientSecret === '') return null;
  return { clientId: settings.driveClientId, clientSecret: settings.driveClientSecret };
}

function setError(message: string | null): void {
  state.lastError = message;
  emit();
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Valida a forma mínima de uma obra vinda do backup. */
function isWorkRecord(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.synopsis === 'string' &&
    typeof record.type === 'string' &&
    typeof record.status === 'string' &&
    typeof record.progress === 'number'
  );
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

async function openBrowser(authorizeUrl: string, port: number): Promise<string> {
  let resolveOutcome: (outcome: AuthOutcome) => void = () => undefined;
  const outcomePromise = new Promise<AuthOutcome>((resolve) => {
    resolveOutcome = resolve;
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#000;color:#e8ecf6;padding:40px">
        <h2>${error !== null ? 'Autorização recusada' : 'Autorização concluída'}</h2>
        <p>${error !== null ? 'Você pode fechar esta aba.' : 'Pode fechar esta aba e voltar para o aplicativo.'}</p>
      </body>`,
    );
    server.close();
    resolveOutcome({ code, error });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  await shell.openExternal(authorizeUrl);

  const timeout = new Promise<AuthOutcome>((resolve) =>
    setTimeout(
      () => resolve({ code: null, error: 'Tempo esgotado aguardando autorização.' }),
      AUTH_TIMEOUT_MS,
    ),
  );
  const outcome = await Promise.race([outcomePromise, timeout]);
  if (server.listening) server.close();

  if (outcome.code !== null && outcome.code !== '') return outcome.code;
  throw new Error(outcome.error ?? 'Autorização cancelada.');
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<Tokens> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Falha ao obter tokens (${res.status}).`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string | undefined;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    accountEmail: null,
    lastSync: null,
  };
}

async function fetchAccountEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${USERINFO_ENDPOINT}?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string | undefined };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export async function authorize(): Promise<{ ok: boolean; error?: string }> {
  const creds = credentials();
  if (creds === null) {
    return {
      ok: false,
      error: 'Configure o Client ID e o Client Secret do Google nas configurações.',
    };
  }
  try {
    const port = await freePort();
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });
    const code = await openBrowser(`${AUTH_ENDPOINT}?${params.toString()}`, port);
    const tokens = await exchangeCode(code, creds.clientId, creds.clientSecret, redirectUri);
    tokens.accountEmail = await fetchAccountEmail(tokens.accessToken);
    state.tokens = tokens;
    setError(null);
    persistState();
    emit();
    return { ok: true };
  } catch (err) {
    const message = toMessage(err);
    setError(message);
    return { ok: false, error: message };
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

async function refreshAccessToken(): Promise<string> {
  const creds = credentials();
  const refreshToken = state.tokens?.refreshToken;
  if (creds === null || refreshToken === undefined || refreshToken === '') {
    throw new Error('Sessão expirada. Conecte a conta Google novamente.');
  }
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Não foi possível renovar a sessão do Google Drive.');
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const tokens = state.tokens;
  if (tokens === null) throw new Error('Nenhuma conta Google conectada.');
  tokens.accessToken = data.access_token;
  tokens.expiresAt = Date.now() + data.expires_in * 1000;
  persistState();
  return tokens.accessToken;
}

async function accessToken(): Promise<string> {
  const tokens = state.tokens;
  if (tokens === null) throw new Error('Nenhuma conta Google conectada.');
  if (Date.now() > tokens.expiresAt - 60_000) return refreshAccessToken();
  return tokens.accessToken;
}

// ---------------------------------------------------------------------------
// Drive REST
// ---------------------------------------------------------------------------

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
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

async function findBackupFolder(): Promise<string | null> {
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

async function ensureFolder(): Promise<string> {
  const existing = await findBackupFolder();
  if (existing !== null) return existing;
  return createBackupFolder();
}

async function listFolder(folderId: string): Promise<RemoteFile[]> {
  const q = `'${escapeQuery(folderId)}' in parents and trashed=false`;
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&pageSize=1000`;
  const res = await driveFetch(url);
  const data = (await res.json()) as { files?: RemoteFile[] | undefined };
  return data.files ?? [];
}

async function uploadMultipart(
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

async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await driveFetch(`${DRIVE_API}/files/${fileId}?alt=media`);
  const data = await res.arrayBuffer();
  return Buffer.from(data);
}

// ---------------------------------------------------------------------------
// Criptografia do backup (AES-256-GCM, chave via scrypt)
// ---------------------------------------------------------------------------

const ENC_MAGIC = Buffer.from('WTENC1');

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32);
}

function encryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([ENC_MAGIC, salt, iv, cipher.getAuthTag(), encrypted]);
}

function isEncrypted(data: Buffer): boolean {
  return data.subarray(0, ENC_MAGIC.length).equals(ENC_MAGIC);
}

function decryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = data.subarray(ENC_MAGIC.length, ENC_MAGIC.length + 16);
  const iv = data.subarray(ENC_MAGIC.length + 16, ENC_MAGIC.length + 28);
  const tag = data.subarray(ENC_MAGIC.length + 28, ENC_MAGIC.length + 44);
  const payload = data.subarray(ENC_MAGIC.length + 44);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}

function maybeEncrypt(data: Buffer): Buffer {
  const passphrase = loadSettings().drivePassphrase;
  if (passphrase === '') {
    throw new Error('Defina uma senha de criptografia do backup nas configurações.');
  }
  return encryptBuffer(data, passphrase);
}

function maybeDecrypt(data: Buffer): Buffer {
  if (!isEncrypted(data)) return data;
  const passphrase = loadSettings().drivePassphrase;
  try {
    return decryptBuffer(data, passphrase);
  } catch {
    throw new Error('Senha de criptografia incorreta ou backup corrompido.');
  }
}

// ---------------------------------------------------------------------------
// Operações
// ---------------------------------------------------------------------------

export async function backupNow(): Promise<{
  ok: boolean;
  error?: string;
  summary?: BackupSummary;
}> {
  if (state.syncing) return { ok: false, error: 'Sincronização já em andamento.' };
  if (state.tokens === null) return { ok: false, error: 'Conecte a conta Google primeiro.' };
  state.syncing = true;
  setError(null);
  emit();
  try {
    const folderId = await ensureFolder();
    const remote = await listFolder(folderId);
    const remoteByName = new Map(remote.map((file) => [file.name, file]));
    const files = backupFiles();

    for (const file of files) {
      await uploadMultipart(
        folderId,
        file.name,
        maybeEncrypt(file.buffer),
        file.mime,
        remoteByName.get(file.name)?.id,
      );
    }

    const localNames = new Set(files.map((file) => file.name));
    for (const file of remote) {
      if (!localNames.has(file.name)) {
        await driveFetch(`${DRIVE_API}/files/${file.id}`, { method: 'DELETE' });
      }
    }

    const libraryFile = remoteByName.get('library.json');
    const summary: BackupSummary = {
      id: libraryFile?.id ?? 'novo',
      name: 'library.json',
      modifiedTime: new Date().toISOString(),
      size: files.reduce((total, file) => total + file.buffer.byteLength, 0),
      works: loadLibrary().length,
    };

    state.tokens.lastSync = new Date().toISOString();
    persistState();
    state.syncing = false;
    emit();
    return { ok: true, summary };
  } catch (err) {
    state.syncing = false;
    const message = toMessage(err);
    setError(message);
    return { ok: false, error: message };
  }
}

export async function restoreNow(): Promise<{ ok: boolean; error?: string; works?: number }> {
  if (state.syncing) return { ok: false, error: 'Sincronização já em andamento.' };
  if (state.tokens === null) return { ok: false, error: 'Conecte a conta Google primeiro.' };
  state.syncing = true;
  setError(null);
  emit();
  try {
    const folderId = await ensureFolder();
    const remote = await listFolder(folderId);
    const libraryFile = remote.find((file) => file.name === 'library.json');
    if (libraryFile === undefined) {
      throw new Error('Nenhum backup encontrado na pasta oculta do Drive.');
    }

    const libraryBuffer = maybeDecrypt(await downloadFile(libraryFile.id));
    const parsed: unknown = JSON.parse(libraryBuffer.toString('utf-8'));
    if (!Array.isArray(parsed) || !parsed.every(isWorkRecord)) {
      throw new Error('Backup inválido (library.json corrompido).');
    }
    const works = parsed as Work[];

    const covers = remote.filter((file) => file.name !== 'library.json');
    const coversPath = coversDir();
    fs.mkdirSync(coversPath, { recursive: true });
    for (const cover of covers) {
      const buffer = maybeDecrypt(await downloadFile(cover.id));
      fs.writeFileSync(path.join(coversPath, path.basename(cover.name)), buffer);
    }

    const restored = restoreLibrary(works);
    state.syncing = false;
    emit();
    return { ok: true, works: restored.length };
  } catch (err) {
    state.syncing = false;
    const message = toMessage(err);
    setError(message);
    return { ok: false, error: message };
  }
}

export async function backupInfo(): Promise<BackupSummary | null> {
  try {
    if (state.tokens === null) return null;
    const folderId = await findBackupFolder();
    if (folderId === null) return null;
    const remote = await listFolder(folderId);
    const libraryFile = remote.find((file) => file.name === 'library.json');
    if (libraryFile === undefined) return null;
    const buffer = await downloadFile(libraryFile.id);
    const parsed: unknown = JSON.parse(buffer.toString('utf-8'));
    const size =
      libraryFile.size !== undefined && libraryFile.size !== ''
        ? Number(libraryFile.size)
        : buffer.byteLength;
    return {
      id: libraryFile.id,
      name: libraryFile.name,
      modifiedTime: libraryFile.modifiedTime,
      size,
      works: Array.isArray(parsed) ? parsed.length : 0,
    };
  } catch {
    return null;
  }
}

export function disconnect(): DriveStatus {
  state.tokens = null;
  state.syncing = false;
  setError(null);
  persistState();
  emit();
  return getStatus();
}

export function initDrive(): void {
  loadState();
  emit();
}
