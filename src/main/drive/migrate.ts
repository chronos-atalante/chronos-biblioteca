import { APP_DATA_SPACE } from '@zero/main/drive/constants';
import { mimeFor } from '@zero/main/library';
import {
  deleteFile,
  downloadFile,
  findLegacyFolder,
  listAppDataFiles,
  listFolder,
  uploadMultipart,
} from '@zero/main/drive/rest';
import { persistState, state } from '@zero/main/drive/state';

let inflight: Promise<void> | null = null;

function mimeForBackup(name: string): string {
  return name === 'library.json' ? 'application/json' : mimeFor(name);
}

async function migrate(): Promise<void> {
  const legacyFolderId = await findLegacyFolder();
  if (legacyFolderId === null) {
    markDone();
    return;
  }

  const legacyFiles = await listFolder(legacyFolderId);
  const existingNames = new Set((await listAppDataFiles()).map((file) => file.name));

  for (const file of legacyFiles) {
    if (existingNames.has(file.name)) continue;
    const buffer = await downloadFile(file.id);
    await uploadMultipart(APP_DATA_SPACE, file.name, buffer, mimeForBackup(file.name));
  }

  for (const file of legacyFiles) {
    await deleteFile(file.id);
  }
  await deleteFile(legacyFolderId);
  markDone();
}

function markDone(): void {
  const tokens = state.tokens;
  if (tokens === null) return;
  tokens.legacyMigrated = true;
  persistState();
}

/**
 * Move o backup da pasta legada ".webtoons-backup" (visível em "Meu Drive")
 * para o espaço oculto appDataFolder e apaga a pasta antiga.
 * Idempotente: só roda até marcar `legacyMigrated` no estado salvo.
 */
export function ensureLegacyMigration(): Promise<void> {
  if (state.tokens === null || state.tokens.legacyMigrated === true) return Promise.resolve();
  inflight ??= migrate().finally(() => {
    inflight = null;
  });
  return inflight;
}
