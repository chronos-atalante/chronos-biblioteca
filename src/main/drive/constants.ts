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
 * Chave do aplicativo Dropbox (App key) embutida.
 *
 * Com PKCE o Dropbox dispensa o `app secret` em clientes públicos: só a chave
 * identifica o app e o segredo real é o `refresh_token` guardado no keyring.
 * Enquanto nenhum app existir, fica vazia e cada instalação usa a própria
 * chave informada nas Configurações (ver `docs/dropbox.md`).
 */
export const EMBEDDED_APP_KEY = '';

export const AUTH_ENDPOINT = 'https://www.dropbox.com/oauth2/authorize';
export const TOKEN_ENDPOINT = 'https://api.dropboxapi.com/oauth2/token';
export const API_ENDPOINT = 'https://api.dropboxapi.com/2';
export const CONTENT_ENDPOINT = 'https://content.dropboxapi.com/2';
export const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Porta fixa do callback loopback (`http://localhost:17431/callback`).
 *
 * Diferente do Google, o Dropbox exige a URI de redirecionamento pré-cadastrada
 * no App Console — por isso a porta não pode ser sorteada. Cadastre exatamente
 * essa URI no app (ver `docs/dropbox.md`).
 */
export const LOOPBACK_PORT = 17431;
export const REDIRECT_URI = `http://localhost:${LOOPBACK_PORT}/callback`;
