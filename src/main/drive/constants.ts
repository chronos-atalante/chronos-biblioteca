export const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
].join(' ');

/** Versão dos escopos pedidos; mudança invalidam a sessão salva (reconexão obrigatória). */
export const SCOPE_VERSION = 2;

/** Espaço oculta do Drive (appDataFolder), invisível na interface do usuário. */
export const APP_DATA_SPACE = 'appDataFolder';

/** Pasta legada em "Meu Drive", usada antes da migração para appDataFolder. */
export const LEGACY_FOLDER_NAME = '.webtoons-backup';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export const EMBEDDED_CLIENT_ID =
  '181078843337-vdfo3s7npqup9hiqpc08kulkgrao5lkl.apps.googleusercontent.com';
export const EMBEDDED_CLIENT_SECRET = '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';

export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
