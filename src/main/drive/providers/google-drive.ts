import type { BackupProvider } from '@zero/main/drive/provider';

/**
 * Motivo exibido ao usuário (UI, tentativa de conexão e tentativa de backup).
 *
 * O Google Drive está catalogado, mas não operante: antes de ligar a
 * integração, o app precisa atender às exigências de verificação do Google
 * (tela de consentimento OAuth, revisão dos escopos e publicação), além de
 * uma implementação própria de OAuth/REST para o Drive. O backup de hoje é o
 * Dropbox (ver `docs/backup-providers.md`).
 */
export const GOOGLE_DRIVE_UNAVAILABLE =
  'O Google Drive ainda não está operante: a integração só será ativada quando o ' +
  'Chronos atender às exigências do Google (verificação do app, tela de ' +
  'consentimento e revisão dos escopos). Enquanto isso, o backup usa o Dropbox.';

/**
 * Destino do backup no Google Drive, decidido de antemão: a pasta oculta
 * `appDataFolder`, que só existe pela API (escopo `drive.appdata`) e **não
 * aparece na interface do Google Drive** — ninguém vê a pasta na conta, ao
 * contrário da pasta do app no Dropbox. É o mesmo espaço oculto que a
 * integração anterior já usava; mantê-lo é requisito para reativar o
 * provedor, junto com as exigências do Google.
 */
export const GOOGLE_DRIVE_STORAGE_TARGET =
  'appDataFolder (pasta oculta, não aparece na interface do Google Drive)';

/** Recusa qualquer operação com o mesmo motivo exibido na interface. */
const unavailable = (): Promise<never> => Promise.reject(new Error(GOOGLE_DRIVE_UNAVAILABLE));

export const googleDriveProvider: BackupProvider = {
  id: 'google-drive',
  info: {
    id: 'google-drive',
    label: 'Google Drive',
    operational: false,
    unavailableReason: GOOGLE_DRIVE_UNAVAILABLE,
    storageTarget: GOOGLE_DRIVE_STORAGE_TARGET,
    storageHidden: true,
  },
  authorize: (): Promise<{ ok: boolean; error?: string }> =>
    Promise.resolve({ ok: false, error: GOOGLE_DRIVE_UNAVAILABLE }),
  listAppFiles: unavailable,
  uploadFile: unavailable,
  downloadFile: unavailable,
  deleteFile: unavailable,
};
