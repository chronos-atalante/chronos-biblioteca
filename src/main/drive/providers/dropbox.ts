import type { BackupProvider } from '@zero/main/drive/provider';
import { authorize } from '@zero/main/drive/oauth';
import { deleteFile, downloadFile, listAppFiles, uploadFile } from '@zero/main/drive/rest';

/**
 * Provedor Dropbox: só adapta o OAuth PKCE e o REST já existentes ao contrato
 * `BackupProvider`; a implementação de verdade continua em `oauth.ts` e
 * `rest.ts` (guia em `docs/dropbox.md`).
 */
export const dropboxProvider: BackupProvider = {
  id: 'dropbox',
  label: 'Dropbox',
  operational: true,
  storageHidden: false,
  describe: (m) => ({
    id: 'dropbox',
    label: 'Dropbox',
    operational: true,
    unavailableReason: null,
    storageTarget: m.providers.dropboxStorageTarget,
    storageHidden: false,
  }),
  authorize,
  listAppFiles,
  uploadFile,
  downloadFile,
  deleteFile,
};
