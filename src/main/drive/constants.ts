export const SCOPES = [
  'account_info.read',
  'files.metadata.read',
  'files.metadata.write',
  'files.content.read',
  'files.content.write',
].join(' ');

/** Versão dos escopos pedidos; mudança invalida a sessão salva (reconexão obrigatória). */
export const SCOPE_VERSION = 3;

/**
 * Chave do aplicativo Dropbox (App key / `client_id`) embutida.
 *
 * Com PKCE o Dropbox dispensa o `app secret` em clientes públicos: só a chave
 * identifica o app, então ela é **pública por definição** (aparece na URL de
 * consentimento e sai extraída do binário) e embuti-la não cria segredo novo:
 * o `refresh_token` real continua no keyring. Fica em branco em build de
 * desenvolvimento quando for usar um app Dropbox próprio; a alternativa sem
 * recompilar é `driveClientId` no `settings.json` (override, sem UI; ver
 * `docs/dropbox.md` §1).
 */
export const EMBEDDED_APP_KEY = 'b049tyhvv2d5so7';

export const AUTH_ENDPOINT = 'https://www.dropbox.com/oauth2/authorize';
export const TOKEN_ENDPOINT = 'https://api.dropboxapi.com/oauth2/token';
export const API_ENDPOINT = 'https://api.dropboxapi.com/2';
export const CONTENT_ENDPOINT = 'https://content.dropboxapi.com/2';
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Porta fixa do callback loopback (`http://localhost:17431/callback`).
 *
 * Diferente do Google, o Dropbox exige a URI de redirecionamento pré-cadastrada
 * no App Console; por isso a porta não pode ser sorteada. Cadastre exatamente
 * essa URI no app (ver `docs/dropbox.md`).
 */
export const LOOPBACK_PORT = 17431;
export const REDIRECT_URI = `http://localhost:${LOOPBACK_PORT}/callback`;
