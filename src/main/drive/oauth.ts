import crypto from 'crypto';
import http from 'http';
import { URLSearchParams } from 'url';
import { shell } from 'electron';
import {
  API_ENDPOINT,
  AUTH_ENDPOINT,
  AUTH_TIMEOUT_MS,
  LOOPBACK_PORT,
  REDIRECT_URI,
  SCOPES,
  SCOPE_VERSION,
  TOKEN_ENDPOINT,
} from '@zero/main/drive/constants';
import { parseJson } from '@zero/main/drive/json';
import { appKey, emit, persistState, setError, state, toMessage } from '@zero/main/drive/state';
import type { Tokens } from '@zero/main/drive/state';

interface AuthOutcome {
  code: string | null;
  error: string | null;
}

const LOOPBACK_HOST = '127.0.0.1';

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    // Host explícito e único: evita a ambiguidade de `localhost` resolver ora
    // para `127.0.0.1` ora para `::1` enquanto o servidor escuta só em uma
    // família (navegadores e o `fetch`/`http` tentam as duas).
    server.listen(port, LOOPBACK_HOST, () => resolve());
  });
}

/** Encerra o servidor sem deixar sockets residuais para o próximo fluxo. */
function shutdown(server: http.Server): void {
  server.close();
  server.closeAllConnections();
}

async function openBrowser(params: URLSearchParams): Promise<{
  code: string;
  redirectUri: string;
}> {
  let resolveOutcome: (outcome: AuthOutcome) => void = () => undefined;
  const outcomePromise = new Promise<AuthOutcome>((resolve) => {
    resolveOutcome = resolve;
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error_description') ?? url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    // Só conclui após o flush: `closeAllConnections` destruiria a resposta
    // ainda na fila se resolvesse antes.
    res.end(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#000;color:#e8ecf6;padding:40px">
        <h2>${error !== null ? 'Autorização recusada' : 'Autorização concluída'}</h2>
        <p>${error !== null ? 'Você pode fechar esta aba.' : 'Pode fechar esta aba e voltar para o aplicativo.'}</p>
      </body>`,
      () => {
        shutdown(server);
        resolveOutcome({ code, error });
      },
    );
  });

  // A URI registrada no App Console usa a porta fixa; se ela estiver ocupada
  // (ex.: suíte de testes em paralelo), cai para uma porta livre — nesse caso
  // o Dropbox recusa o redirect, e o erro de troca de tokens indica o motivo.
  let redirectUri = REDIRECT_URI;
  try {
    await listen(server, LOOPBACK_PORT);
  } catch {
    server.removeAllListeners('error');
    await listen(server, 0);
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : LOOPBACK_PORT;
    redirectUri = `http://localhost:${port}/callback`;
  }
  params.set('redirect_uri', redirectUri);

  await shell.openExternal(`${AUTH_ENDPOINT}?${params.toString()}`);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<AuthOutcome>((resolve) => {
    timer = setTimeout(
      () => resolve({ code: null, error: 'Tempo esgotado aguardando autorização.' }),
      AUTH_TIMEOUT_MS,
    );
    // Não segura o processo (testes) quando o fluxo já terminou por outro caminho.
    if (typeof timer.unref === 'function') timer.unref();
  });
  const outcome = await Promise.race([outcomePromise, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  if (server.listening) shutdown(server);

  if (outcome.code !== null && outcome.code !== '') return { code: outcome.code, redirectUri };
  throw new Error(outcome.error ?? 'Autorização cancelada.');
}

async function exchangeCode(
  code: string,
  key: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<Tokens> {
  // Cliente público com PKCE: o Dropbox não exige `app secret` aqui.
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
    client_id: key,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Falha ao obter tokens (${res.status}).`);
  const data = await parseJson<{
    access_token: string;
    refresh_token?: string | undefined;
    expires_in: number;
    scope?: string | undefined;
  }>(res);
  if (!isTokenResponse(data)) throw new Error(`Resposta de tokens inválida (${res.status}).`);
  return {
    accessToken: data.access_token,
    refreshToken:
      'refresh_token' in data && typeof data.refresh_token === 'string'
        ? data.refresh_token
        : undefined,
    expiresAt: Date.now() + data.expires_in * 1000,
    accountEmail: null,
    lastSync: null,
    scopeVersion: SCOPE_VERSION,
    grantedScopes:
      'scope' in data && typeof data.scope === 'string' && data.scope !== ''
        ? data.scope
        : undefined,
  };
}

/** Escopos que faltaram na concessão ('' quando o provedor não informou). */
export function missingScopes(granted: string | undefined): string[] {
  if (granted === undefined) return [];
  const have = new Set(granted.split(' ').filter((scope) => scope !== ''));
  return SCOPES.split(' ').filter((scope) => !have.has(scope));
}

/** Valida a forma mínima da resposta de tokens antes de usar (falha fechada). */
function isTokenResponse(
  data: unknown,
): data is { access_token: string; refresh_token?: string | undefined; expires_in: number } {
  if (typeof data !== 'object' || data === null) return false;
  if (!('access_token' in data && 'expires_in' in data)) return false;
  if (typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') {
    return false;
  }
  return (
    !('refresh_token' in data) ||
    data.refresh_token === undefined ||
    typeof data.refresh_token === 'string'
  );
}

async function fetchAccountEmail(token: string): Promise<string | null> {
  try {
    // Token no header Authorization (nunca na query string: URL vaza em logs/proxies).
    const res = await fetch(`${API_ENDPOINT}/users/get_current_account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: 'null',
    });
    if (!res.ok) return null;
    const data = await parseJson<{ email?: string | undefined }>(res);
    return data.email ?? null;
  } catch {
    return null;
  }
}

export async function authorize(): Promise<{ ok: boolean; error?: string }> {
  const key = appKey();
  if (key === '') {
    const error =
      'Configure a chave do aplicativo Dropbox nas Configurações (ver docs/dropbox.md).';
    setError(error);
    return { ok: false, error };
  }
  try {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const params = new URLSearchParams({
      client_id: key,
      response_type: 'code',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      scope: SCOPES,
      token_access_type: 'offline',
    });
    const { code, redirectUri } = await openBrowser(params);
    const tokens = await exchangeCode(code, key, codeVerifier, redirectUri);
    const missing = missingScopes(tokens.grantedScopes);
    if (missing.length > 0) {
      const error =
        `Faltam permissões no app Dropbox (${missing.join(', ')}). ` +
        'Marque todos os escopos na aba Permissions do App Console e conecte de novo.';
      setError(error);
      return { ok: false, error };
    }
    tokens.accountEmail = await fetchAccountEmail(tokens.accessToken);
    state.tokens = tokens;
    setError(null);
    persistState();
    emit();
    return { ok: true };
  } catch (err) {
    const message = toMessage(err);
    setError(message);
    return { ok: false, error: message };
  }
}

export async function refreshAccessToken(): Promise<string> {
  const key = appKey();
  if (key === '') {
    throw new Error('Configure a chave do aplicativo Dropbox nas Configurações.');
  }
  const refreshToken = state.tokens?.refreshToken;
  if (refreshToken === undefined || refreshToken === '') {
    throw new Error('Sessão expirada. Conecte a conta Dropbox novamente.');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: key,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Não foi possível renovar a sessão do Dropbox.');
  const data = await parseJson<{ access_token: string; expires_in: number }>(res);
  if (!isTokenResponse(data)) throw new Error('Não foi possível renovar a sessão do Dropbox.');
  const tokens = state.tokens;
  if (tokens === null) throw new Error('Nenhuma conta Dropbox conectada.');
  tokens.accessToken = data.access_token;
  tokens.expiresAt = Date.now() + data.expires_in * 1000;
  persistState();
  return tokens.accessToken;
}

export async function accessToken(): Promise<string> {
  const tokens = state.tokens;
  if (tokens === null) throw new Error('Nenhuma conta Dropbox conectada.');
  if (Date.now() > tokens.expiresAt - 60_000) return refreshAccessToken();
  return tokens.accessToken;
}
