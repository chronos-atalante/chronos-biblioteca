import fs from 'fs';
import path from 'path';
import type { BackupSummary, DriveStatus, Work } from '@zero/types';
import { APP_DATA_SPACE } from '@zero/main/drive/constants';
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
import { ensureLegacyMigration } from '@zero/main/drive/migrate';
import { deleteFile, downloadFile, listAppDataFiles, uploadMultipart } from '@zero/main/drive/rest';
import type { RemoteFile } from '@zero/main/drive/rest';
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
 * Esquema novo: nomes opacos (HMAC) + manifesto cifrado. Esquema legado
 * (nomes em claro, sem manifesto): cada nome vale por si. Um manifesto
 * corrompido ou com senha errada falha de forma fechada — nunca se restaura
 * mapeamento adivinhado.
 */
async function resolveLocalNames(
  remote: RemoteFile[],
  passphrase: string,
): Promise<{ localOf: Map<string, string>; manifestRemote: string }> {
  const manifestRemote = remoteName(MANIFEST_FILE, nameKeyFor(passphrase));
  const localOf = new Map<string, string>();
  const manifestFile = remote.find((file) => file.name === manifestRemote);
  if (manifestFile !== undefined) {
    const mapping = parseManifest(decryptWith(await downloadFile(manifestFile.id), passphrase));
    for (const [remoteName_, localName] of Object.entries(mapping)) {
      localOf.set(remoteName_, localName);
    }
  }
  for (const file of remote) {
    if (!localOf.has(file.name) && file.name !== manifestRemote) {
      localOf.set(file.name, file.name);
    }
  }
  return { localOf, manifestRemote };
}

export async function backupNow(): Promise<{
  ok: boolean;
  error?: string;
  summary?: BackupSummary;
}> {
  if (state.syncing) return { ok: false, error: 'Sincronização já em andamento.' };
  if (state.tokens === null) return { ok: false, error: 'Conecte a conta Google primeiro.' };
  const passphrase = loadSettings().drivePassphrase;
  if (passphrase === '') {
    const error = 'Defina uma senha de criptografia do backup nas configurações.';
    setError(error);
    return { ok: false, error };
  }
  state.syncing = true;
  setError(null);
  emit();
  try {
    const files = backupFiles();
    if (files === null) {
      throw new Error('Nenhuma biblioteca local para backup. Adicione ao menos uma obra.');
    }

    await ensureLegacyMigration();
    const key = nameKeyFor(passphrase);
    const toRemote = (local: string): string => remoteName(local, key);
    const manifestRemote = toRemote(MANIFEST_FILE);

    const remote = await listAppDataFiles();
    const remoteByName = new Map(remote.map((file) => [file.name, file]));

    for (const file of files) {
      await uploadMultipart(
        APP_DATA_SPACE,
        toRemote(file.name),
        maybeEncrypt(file.buffer),
        file.mime,
        remoteByName.get(toRemote(file.name))?.id,
      );
    }

    // Manifesto por último: ele é o "commit" que descreve o backup.
    const manifest: Record<string, string> = {};
    for (const file of files) manifest[toRemote(file.name)] = file.name;
    await uploadMultipart(
      APP_DATA_SPACE,
      manifestRemote,
      encryptWith(buildManifest(manifest), passphrase),
      'application/json',
      remoteByName.get(manifestRemote)?.id,
    );

    // Tudo que não é esperado some — órfãos e nomes legados em claro, que o
    // próximo backup renomeia sozinho para opacos.
    const expected = new Set([...files.map((file) => toRemote(file.name)), manifestRemote]);
    for (const file of remote) {
      if (!expected.has(file.name)) {
        await deleteFile(file.id);
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
  if (state.syncing) return { ok: false, error: 'Sincronização já em andamento.' };
  if (state.tokens === null) return { ok: false, error: 'Conecte a conta Google primeiro.' };
  state.syncing = true;
  setError(null);
  emit();
  try {
    await ensureLegacyMigration();
    const remote = await listAppDataFiles();
    const { localOf, manifestRemote } = await resolveLocalNames(remote, passphrase);
    const libraryRemote = [...localOf.entries()].find(([, local]) => local === 'library.json')?.[0];
    const libraryFile =
      libraryRemote === undefined ? undefined : remote.find((file) => file.name === libraryRemote);
    if (libraryFile === undefined) {
      throw new Error('Nenhum backup encontrado no espaço oculto do Drive.');
    }

    const libraryBuffer = decryptWith(await downloadFile(libraryFile.id), passphrase);
    const parsed: unknown = JSON.parse(libraryBuffer.toString('utf-8'));
    if (!isWorkArray(parsed)) {
      throw new Error('Backup inválido (library.json corrompido).');
    }
    const works: Work[] = parsed;

    const coversPath = coversDir();
    fs.mkdirSync(coversPath, { recursive: true });
    for (const file of remote) {
      const local = localOf.get(file.name);
      if (local === undefined || local === 'library.json' || file.name === manifestRemote) {
        continue;
      }
      const buffer = decryptWith(await downloadFile(file.id), passphrase);
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
    const remote = await listAppDataFiles();
    const passphrase = loadSettings().drivePassphrase;
    const { localOf } = await resolveLocalNames(remote, passphrase);
    const libraryRemote = [...localOf.entries()].find(([, local]) => local === 'library.json')?.[0];
    const libraryFile =
      libraryRemote === undefined ? undefined : remote.find((file) => file.name === libraryRemote);
    if (libraryFile === undefined) return null;
    const buffer = await downloadFile(libraryFile.id);
    const size =
      libraryFile.size !== undefined && libraryFile.size !== ''
        ? Number(libraryFile.size)
        : buffer.byteLength;
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
