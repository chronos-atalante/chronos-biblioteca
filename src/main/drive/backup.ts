import fs from 'fs';
import path from 'path';
import type { BackupSummary, DriveStatus, Work } from '@zero/types';
import { APP_DATA_SPACE } from '@zero/main/drive/constants';
import { decryptWith, maybeEncrypt } from '@zero/main/drive/crypto';
import { ensureLegacyMigration } from '@zero/main/drive/migrate';
import { deleteFile, downloadFile, listAppDataFiles, uploadMultipart } from '@zero/main/drive/rest';
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
    const files = backupFiles();
    if (files === null) {
      throw new Error('Nenhuma biblioteca local para backup. Adicione ao menos uma obra.');
    }

    await ensureLegacyMigration();
    const remote = await listAppDataFiles();
    const remoteByName = new Map(remote.map((file) => [file.name, file]));

    for (const file of files) {
      await uploadMultipart(
        APP_DATA_SPACE,
        file.name,
        maybeEncrypt(file.buffer),
        file.mime,
        remoteByName.get(file.name)?.id,
      );
    }

    const localNames = new Set(files.map((file) => file.name));
    for (const file of remote) {
      if (!localNames.has(file.name)) {
        await deleteFile(file.id);
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
    const libraryFile = remote.find((file) => file.name === 'library.json');
    if (libraryFile === undefined) {
      throw new Error('Nenhum backup encontrado no espaço oculto do Drive.');
    }

    const libraryBuffer = decryptWith(await downloadFile(libraryFile.id), passphrase);
    const parsed: unknown = JSON.parse(libraryBuffer.toString('utf-8'));
    if (!isWorkArray(parsed)) {
      throw new Error('Backup inválido (library.json corrompido).');
    }
    const works: Work[] = parsed;

    const covers = remote.filter((file) => file.name !== 'library.json');
    const coversPath = coversDir();
    fs.mkdirSync(coversPath, { recursive: true });
    for (const cover of covers) {
      const buffer = decryptWith(await downloadFile(cover.id), passphrase);
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
    const remote = await listAppDataFiles();
    const libraryFile = remote.find((file) => file.name === 'library.json');
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
