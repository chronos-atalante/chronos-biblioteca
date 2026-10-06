import fs from 'fs';
import path from 'path';
import type { DriveStatus } from '@zero/types';
import { EMBEDDED_APP_KEY, SCOPE_VERSION } from '@zero/main/drive/constants';
import { configDir } from '@zero/main/library';
import { currentMessages } from '@zero/main/i18n';
import { loadSettings } from '@zero/main/settings';

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
    const file = statePath();
    if (fs.existsSync(file)) {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (isTokens(parsed) && parsed.scopeVersion === SCOPE_VERSION) {
        state.tokens = parsed;
      } else {
        state.lastError = currentMessages().driveErrors.permissionsUpdated;
      }
    }
  } catch {
    state.tokens = null;
  }
}

export function persistState(): void {
  ensureConfig();
  if (state.tokens !== null) {
    fs.writeFileSync(statePath(), JSON.stringify(state.tokens, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } else if (fs.existsSync(statePath())) {
    fs.unlinkSync(statePath());
  }
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
