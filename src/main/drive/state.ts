import fs from 'fs';
import path from 'path';
import type { DriveStatus } from '@zero/types';
import { EMBEDDED_APP_KEY, SCOPE_VERSION } from '@zero/main/drive/constants';
import { currentMessages } from '@zero/main/i18n';
import { writeJsonAtomic } from '@zero/main/jsonfile';
import { configDir } from '@zero/main/paths';
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

function ensureConfig(): void {
  fs.mkdirSync(configDir(), { recursive: true });
}

function statePath(): string {
  return path.join(configDir(), 'dropbox-tokens.json');
}

/** Valida a forma mínima dos tokens persistidos em disco. */
function isTokens(value: unknown): value is Tokens {
  if (typeof value !== 'object' || value === null) return false;
  if (!('accessToken' in value && 'scopeVersion' in value)) return false;
  return typeof value.accessToken === 'string' && typeof value.scopeVersion === 'number';
}

export function loadState(): void {
  ensureConfig();
  try {
    // Sessões do provedor anterior (Google) não valem aqui: o arquivo antigo é
    // descartado para nunca tentar um `refresh_token` de outro serviço.
    const legacy = path.join(configDir(), 'drive-tokens.json');
    if (fs.existsSync(legacy)) fs.unlinkSync(legacy);

    let candidate: Tokens | null = null;
    let invalid = false;

    const file = statePath();
    if (fs.existsSync(file)) {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (isTokens(parsed)) {
        candidate = parsed;
      } else {
        invalid = true;
      }
    }

    // Cofre desbloqueado: o arquivo legado migra para dentro (e sai do disco);
    // daí em diante a fonte é o cofre. Qualquer erro mantém o que o disco lê.
    if (vaultUnlocked()) {
      try {
        if (candidate !== null) {
          writeJsonSecret(VAULT_SECRET.dropboxTokens, candidate);
          fs.unlinkSync(file);
          invalid = false;
        }
        const inVault = readJsonSecret(VAULT_SECRET.dropboxTokens, isTokens);
        if (inVault !== null) {
          candidate = inVault;
          invalid = false;
        }
      } catch {
        // cofre ilegível: mantém a visão do disco
      }
    }

    if (candidate !== null) {
      if (candidate.scopeVersion === SCOPE_VERSION) {
        state.tokens = candidate;
      } else {
        state.lastError = currentMessages().driveErrors.permissionsUpdated;
      }
    } else if (invalid) {
      state.lastError = currentMessages().driveErrors.permissionsUpdated;
    }
  } catch {
    state.tokens = null;
  }
}

export function persistState(): void {
  ensureConfig();
  if (state.tokens !== null) {
    // Com o cofre desbloqueado os tokens vão para lá (e o legado é removido);
    // sem ele, valem as regras antigas: escrita atômica com 0600.
    if (vaultUnlocked()) {
      try {
        writeJsonSecret(VAULT_SECRET.dropboxTokens, state.tokens);
        if (fs.existsSync(statePath())) fs.unlinkSync(statePath());
        return;
      } catch {
        // cofre ilegível ou bloqueado no meio: grava no legado abaixo
      }
    }
    writeJsonAtomic(statePath(), state.tokens, 0o600);
    return;
  }
  if (fs.existsSync(statePath())) fs.unlinkSync(statePath());
  if (vaultUnlocked()) clearSecret(VAULT_SECRET.dropboxTokens);
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
 * app. Vale a chave informada nas Configurações (`driveClientId`, mantido por
 * compatibilidade com o `settings.json` existente) ou a embutida.
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
  return error instanceof Error ? error.message : String(error);
}
