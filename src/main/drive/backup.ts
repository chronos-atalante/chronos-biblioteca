import fs from 'fs';
import path from 'path';
import type { BackupSummary, DriveStatus, Work } from '@zero/types';
import { DRIVE_API } from '@zero/main/drive/constants';
import { maybeDecrypt, maybeEncrypt } from '@zero/main/drive/crypto';
import {
  downloadFile,
  driveFetch,
  ensureFolder,
  findBackupFolder,
  listFolder,
  uploadMultipart,
} from '@zero/main/drive/rest';
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

    const folderId = await ensureFolder();
    const remote = await listFolder(folderId);
    const remoteByName = new Map(remote.map((file) => [file.name, file]));

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
