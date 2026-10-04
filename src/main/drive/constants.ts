export const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email'].join(' ');

/** Pasta oculta no Drive (prefixo "." mantém ela fora das listagens comuns) */
export const FOLDER_NAME = '.webtoons-backup';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const DRIVE_API = 'https://www.googleapis.com/drive/v3';
export const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000;
