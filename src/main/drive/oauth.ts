import crypto from 'crypto';
import http from 'http';
import { URLSearchParams } from 'url';
import { shell } from 'electron';
import {
  AUTH_ENDPOINT,
  AUTH_TIMEOUT_MS,
  SCOPES,
  SCOPE_VERSION,
  TOKEN_ENDPOINT,
  USERINFO_ENDPOINT,
} from '@zero/main/drive/constants';
import { ensureLegacyMigration } from '@zero/main/drive/migrate';
import {
  credentials,
  emit,
  persistState,
  setError,
  state,
  toMessage,
} from '@zero/main/drive/state';
import type { Tokens } from '@zero/main/drive/state';

interface AuthOutcome {
  code: string | null;
  error: string | null;
}

async function openBrowser(authorizeUrl: string, port: number): Promise<string> {
  let resolveOutcome: (outcome: AuthOutcome) => void = () => undefined;
  const outcomePromise = new Promise<AuthOutcome>((resolve) => {
    resolveOutcome = resolve;
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#000;color:#e8ecf6;padding:40px">
        <h2>${error !== null ? 'Autorização recusada' : 'Autorização concluída'}</h2>
        <p>${error !== null ? 'Você pode fechar esta aba.' : 'Pode fechar esta aba e voltar para o aplicativo.'}</p>
      </body>`,
    );
    server.close();
    resolveOutcome({ code, error });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  await shell.openExternal(authorizeUrl);

  const timeout = new Promise<AuthOutcome>((resolve) =>
    setTimeout(
      () => resolve({ code: null, error: 'Tempo esgotado aguardando autorização.' }),
      AUTH_TIMEOUT_MS,
    ),
  );
  const outcome = await Promise.race([outcomePromise, timeout]);
  if (server.listening) server.close();

  if (outcome.code !== null && outcome.code !== '') return outcome.code;
  throw new Error(outcome.error ?? 'Autorização cancelada.');
}

async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<Tokens> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Falha ao obter tokens (${res.status}).`);
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string | undefined;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    accountEmail: null,
    lastSync: null,
    scopeVersion: SCOPE_VERSION,
  };
}

async function fetchAccountEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${USERINFO_ENDPOINT}?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string | undefined };
    return data.email ?? null;
  } catch {
    return null;
  }
}

export async function authorize(): Promise<{ ok: boolean; error?: string }> {
  const creds = credentials();
  try {
    const port = await freePort();
    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    const code = await openBrowser(`${AUTH_ENDPOINT}?${params.toString()}`, port);
    const tokens = await exchangeCode(
      code,
      creds.clientId,
      creds.clientSecret,
      redirectUri,
      codeVerifier,
    );
    tokens.accountEmail = await fetchAccountEmail(tokens.accessToken);
    state.tokens = tokens;
    setError(null);
    persistState();
    emit();
    try {
      await ensureLegacyMigration();
    } catch {
      // a migração da pasta legada é retentada no próximo backup/restauração
    }
    return { ok: true };
  } catch (err) {
    const message = toMessage(err);
    setError(message);
    return { ok: false, error: message };
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export async function refreshAccessToken(): Promise<string> {
  const creds = credentials();
  const refreshToken = state.tokens?.refreshToken;
  if (refreshToken === undefined || refreshToken === '') {
    throw new Error('Sessão expirada. Conecte a conta Google novamente.');
  }
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('Não foi possível renovar a sessão do Google Drive.');
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const tokens = state.tokens;
  if (tokens === null) throw new Error('Nenhuma conta Google conectada.');
  tokens.accessToken = data.access_token;
  tokens.expiresAt = Date.now() + data.expires_in * 1000;
  persistState();
  return tokens.accessToken;
}

export async function accessToken(): Promise<string> {
  const tokens = state.tokens;
  if (tokens === null) throw new Error('Nenhuma conta Google conectada.');
  if (Date.now() > tokens.expiresAt - 60_000) return refreshAccessToken();
  return tokens.accessToken;
}
