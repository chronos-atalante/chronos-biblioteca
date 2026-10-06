import { authorize } from '@zero/main/drive/oauth';
import { deleteFile, downloadFile, listAppFiles, uploadFile } from '@zero/main/drive/rest';
import type { BackupProvider } from '@zero/main/drive/provider';

/**
 * Provedor Dropbox: só adapta o OAuth PKCE e o REST já existentes ao contrato
 * `BackupProvider` — a implementação de verdade continua em `oauth.ts` e
 * `rest.ts` (guia em `docs/dropbox.md`).
 */
export const dropboxProvider: BackupProvider = {
  id: 'dropbox',
  info: {
    id: 'dropbox',
    label: 'Dropbox',
    operational: true,
    unavailableReason: null,
    storageTarget: '/Apps/Chronos Biblioteca (pasta visível na sua conta)',
    storageHidden: false,
  },
  authorize,
  listAppFiles,
  uploadFile,
  downloadFile,
  deleteFile,
};
