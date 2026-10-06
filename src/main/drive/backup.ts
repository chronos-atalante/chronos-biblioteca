import fs from 'fs';
import path from 'path';
import type { BackupSummary, DriveStatus, Work } from '@zero/types';
import {
  MANIFEST_FILE,
  buildManifest,
  decryptWith,
  encryptWith,
  maybeEncrypt,
  nameKeyFor,
  parseManifest,
  remoteName,
} from '@zero/main/drive/crypto';
import { currentProvider } from '@zero/main/drive/provider';
import type { RemoteFile } from '@zero/main/drive/provider';
import {
  emit,
  getStatus,
  loadState,
  persistState,
  setError,
  state,
  toMessage,
} from '@zero/main/drive/state';
import { backupFiles, coversDir, loadLibrary, restoreLibrary } from '@zero/main/library';
import { currentMessages } from '@zero/main/i18n';
import { loadSettings } from '@zero/main/settings';

/** Valida a forma mínima de uma obra vinda do backup. */
function isWorkRecord(value: unknown): value is Work {
  if (typeof value !== 'object' || value === null) return false;
  if (!(
    'id' in value &&
    'title' in value &&
    'synopsis' in value &&
    'type' in value &&
    'status' in value &&
    'progress' in value
  )) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.synopsis === 'string' &&
    typeof value.type === 'string' &&
    typeof value.status === 'string' &&
    typeof value.progress === 'number'
  );
}

/** Valida que o backup decifrado é uma lista de obras. */
function isWorkArray(value: unknown): value is Work[] {
  return Array.isArray(value) && value.every(isWorkRecord);
}

/**
 * Resolve cada arquivo remoto para seu nome local.
 *
 * Nomes opacos (HMAC) + manifesto cifrado. Sem manifesto (backup vazio),
 * cada nome vale por si. Um manifesto corrompido ou com senha errada falha
 * de forma fechada; nunca se restaura mapeamento adivinhado.
 */
async function resolveLocalNames(
  remote: RemoteFile[],
  passphrase: string,
): Promise<{ localOf: Map<string, string>; manifestId: string | null }> {
  const provider = currentProvider();
  const manifestRemote = remoteName(MANIFEST_FILE, nameKeyFor(passphrase));
  const localOf = new Map<string, string>();
  const manifestFile = remote.find((file) => file.name === manifestRemote);
  let manifestId: string | null = null;
  if (manifestFile !== undefined) {
    manifestId = manifestFile.id;
    const manifestBuffer = await provider.downloadFile(manifestFile.id);
    const mapping = parseManifest(decryptWith(manifestBuffer, passphrase));
    for (const [remoteName_, localName] of Object.entries(mapping)) {
      localOf.set(remoteName_, localName);
    }
  }
  for (const file of remote) {
    if (!localOf.has(file.name) && file.name !== manifestRemote) {
      localOf.set(file.name, file.name);
    }
  }
  return { localOf, manifestId };
}

export async function backupNow(): Promise<{
  ok: boolean;
  error?: string;
  summary?: BackupSummary;
}> {
  if (state.syncing) return { ok: false, error: currentMessages().driveErrors.syncInProgress };
  const provider = currentProvider();
  if (state.tokens === null) {
    return { ok: false, error: currentMessages().driveErrors.connectFirst(provider.label) };
  }
  const passphrase = loadSettings().drivePassphrase;
  if (passphrase === '') {
    const error = currentMessages().driveErrors.definePassphrase;
    setError(error);
    return { ok: false, error };
  }
  state.syncing = true;
  setError(null);
  emit();
  try {
    const files = backupFiles();
    if (files === null) {
      throw new Error(currentMessages().driveErrors.emptyLibrary);
    }

    const key = nameKeyFor(passphrase);
    const toRemote = (local: string): string => remoteName(local, key);
    const manifestRemote = toRemote(MANIFEST_FILE);

    const remote = await provider.listAppFiles();
    const remoteByName = new Map(remote.map((file) => [file.name, file]));

    // `mode: overwrite` no upload: sem id prévio, sem multipart.
    for (const file of files) {
      await provider.uploadFile(toRemote(file.name), maybeEncrypt(file.buffer));
    }

    // Manifesto por último: ele é o "commit" que descreve o backup.
    const manifest: Record<string, string> = {};
    for (const file of files) manifest[toRemote(file.name)] = file.name;
    await provider.uploadFile(manifestRemote, encryptWith(buildManifest(manifest), passphrase));

    // Tudo que não é esperado some: órfãos de backups interrompidos.
    const expected = new Set([...files.map((file) => toRemote(file.name)), manifestRemote]);
    for (const file of remote) {
      if (!expected.has(file.name)) {
        await provider.deleteFile(file.id);
      }
    }

    const previousLibrary = remoteByName.get(toRemote('library.json'));
    const summary: BackupSummary = {
      id: previousLibrary?.id ?? 'novo',
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

export async function restoreNow(passphrase: string): Promise<{
  ok: boolean;
  error?: string;
  works?: number;
}> {
  if (state.syncing) return { ok: false, error: currentMessages().driveErrors.syncInProgress };
  const provider = currentProvider();
  if (state.tokens === null) {
    return { ok: false, error: currentMessages().driveErrors.connectFirst(provider.label) };
  }
  state.syncing = true;
  setError(null);
  emit();
  try {
    const remote = await provider.listAppFiles();
    const { localOf, manifestId } = await resolveLocalNames(remote, passphrase);
    const libraryRemote = [...localOf.entries()].find(([, local]) => local === 'library.json')?.[0];
    const libraryFile =
      libraryRemote === undefined ? undefined : remote.find((file) => file.name === libraryRemote);
    if (libraryFile === undefined) {
      throw new Error(currentMessages().driveErrors.noBackupFound(provider.label));
    }

    const libraryBuffer = decryptWith(await provider.downloadFile(libraryFile.id), passphrase);
    const parsed: unknown = JSON.parse(libraryBuffer.toString('utf-8'));
    if (!isWorkArray(parsed)) {
      throw new Error(currentMessages().driveErrors.invalidLibrary);
    }
    const works: Work[] = parsed;

    const coversPath = coversDir();
    fs.mkdirSync(coversPath, { recursive: true });
    for (const file of remote) {
      const local = localOf.get(file.name);
      if (local === undefined || local === 'library.json' || file.id === manifestId) {
        continue;
      }
      const buffer = decryptWith(await provider.downloadFile(file.id), passphrase);
      fs.writeFileSync(path.join(coversPath, path.basename(local)), buffer);
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
    const provider = currentProvider();
    const remote = await provider.listAppFiles();
    const passphrase = loadSettings().drivePassphrase;
    const { localOf } = await resolveLocalNames(remote, passphrase);
    const libraryRemote = [...localOf.entries()].find(([, local]) => local === 'library.json')?.[0];
    const libraryFile =
      libraryRemote === undefined ? undefined : remote.find((file) => file.name === libraryRemote);
    if (libraryFile === undefined) return null;
    const buffer = await provider.downloadFile(libraryFile.id);
    const size = libraryFile.size ?? buffer.byteLength;
    const parsed: unknown = JSON.parse(
      decryptWith(buffer, loadSettings().drivePassphrase).toString('utf-8'),
    );
    return {
      id: libraryFile.id,
      name: 'library.json',
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
