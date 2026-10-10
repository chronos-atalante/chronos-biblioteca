import type { DriveStatus } from '@zero/types';
import { isVaultError } from '@zero/main/vault/errors';
import { EMBEDDED_APP_KEY, SCOPE_VERSION } from '@zero/main/drive/constants';
import { currentMessages } from '@zero/main/i18n';
import { loadSettings } from '@zero/main/settings';
import {
  VAULT_SECRET,
  clearSecret,
  readJsonSecret,
  vaultUnlocked,
  writeJsonSecret,
} from '@zero/main/vault/secrets';

export interface Tokens {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt: number;
  accountEmail: string | null;
  lastSync: string | null;
  scopeVersion: number;
  /** Escopos concedidos na autorização (auditoria; ausente em sessões antigas). */
  grantedScopes?: string | undefined;
}

export interface DriveState {
  tokens: Tokens | null;
  lastError: string | null;
  syncing: boolean;
}

/** Estado em memória do backup em nuvem, compartilhado por oauth/rest/backup. */
export const state: DriveState = { tokens: null, lastError: null, syncing: false };

let statusListener: ((status: DriveStatus) => void) | null = null;

/** Valida a forma mínima dos tokens persistidos no cofre. */
function isTokens(value: unknown): value is Tokens {
  if (typeof value !== 'object' || value === null) return false;
  if (!('accessToken' in value && 'scopeVersion' in value)) return false;
  return typeof value.accessToken === 'string' && typeof value.scopeVersion === 'number';
}

/**
 * Recarrega os tokens do cofre. É a **única** fonte: com o cofre fechado não
 * há sessão do Dropbox em memória nem em disco (falha fechada).
 */
export function loadState(): void {
  state.tokens = null;
  if (!vaultUnlocked()) return;
  const tokens = readJsonSecret(VAULT_SECRET.dropboxTokens, isTokens);
  if (tokens === null) return;
  if (tokens.scopeVersion === SCOPE_VERSION) {
    state.tokens = tokens;
  } else {
    state.lastError = currentMessages().driveErrors.permissionsUpdated;
  }
}

/** Persiste os tokens no cofre (exige cofre desbloqueado, senão lança). */
export function persistState(): void {
  if (state.tokens !== null) {
    writeJsonSecret(VAULT_SECRET.dropboxTokens, state.tokens);
    return;
  }
  clearSecret(VAULT_SECRET.dropboxTokens);
}

export function getStatus(): DriveStatus {
  return {
    connected: state.tokens !== null && state.tokens.accessToken !== '',
    syncing: state.syncing,
    lastSync: state.tokens?.lastSync ?? null,
    lastError: state.lastError,
    accountEmail: state.tokens?.accountEmail ?? null,
  };
}

export function emit(): void {
  statusListener?.(getStatus());
}

export function onStatus(listener: (status: DriveStatus) => void): void {
  statusListener = listener;
}

/**
 * Chave do aplicativo Dropbox (App key) em uso.
 *
 * Com PKCE não há `app secret` em cliente público; só a chave identifica o
 * app. Vale a chave informada nas Configurações (`driveClientId`, um segredo
 * do cofre: com o cofre fechado volta a embutida) ou a própria embutida.
 */
export function appKey(): string {
  const configured = loadSettings().driveClientId.trim();
  if (configured !== '') return configured;
  return EMBEDDED_APP_KEY;
}

export function setError(message: string | null): void {
  state.lastError = message;
  emit();
}

export function toMessage(error: unknown): string {
  // Erro de domínio do cofre chega como código; a mensagem é localizada aqui.
  if (isVaultError(error)) return currentMessages().vault.errors[error.code];
  return error instanceof Error ? error.message : String(error);
}
