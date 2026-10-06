import type { BackupProvider } from '@zero/main/drive/provider';
import { currentMessages } from '@zero/main/i18n';

/**
 * Catálogo do Google Drive (não operante).
 *
 * A integração real só será escrita quando for ativada; até lá o provedor
 * existe no catálogo com o motivo da indisponibilidade e qualquer operação
 * rejeita com esse mesmo texto (ver `docs/backup-providers.md`).
 */
const unavailable = (): Promise<never> =>
  Promise.reject(new Error(currentMessages().providers.googleUnavailable));

export const googleDriveProvider: BackupProvider = {
  id: 'google-drive',
  label: 'Google Drive',
  operational: false,
  storageHidden: true,
  describe: (m) => ({
    id: 'google-drive',
    label: 'Google Drive',
    operational: false,
    unavailableReason: m.providers.googleUnavailable,
    storageTarget: m.providers.googleStorageTarget,
    storageHidden: true,
  }),
  authorize: () =>
    Promise.resolve({ ok: false, error: currentMessages().providers.googleUnavailable }),
  listAppFiles: unavailable,
  uploadFile: () => unavailable(),
  downloadFile: () => unavailable(),
  deleteFile: () => unavailable(),
};
