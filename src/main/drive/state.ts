import fs from 'fs';
import path from 'path';
import type { DriveStatus } from '@zero/types';
import {
  EMBEDDED_CLIENT_ID,
  EMBEDDED_CLIENT_SECRET,
  SCOPE_VERSION,
} from '@zero/main/drive/constants';
import { configDir } from '@zero/main/library';
import { loadSettings } from '@zero/main/settings';

export interface Tokens {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt: number;
  accountEmail: string | null;
  lastSync: string | null;
  scopeVersion: number;
  legacyMigrated?: boolean | undefined;
}

export interface DriveState {
  tokens: Tokens | null;
  lastError: string | null;
  syncing: boolean;
}

/** Estado em memória do Drive, compartilhado por oauth/rest/backup. */
export const state: DriveState = { tokens: null, lastError: null, syncing: false };

let statusListener: ((status: DriveStatus) => void) | null = null;

function ensureConfig(): void {
  fs.mkdirSync(configDir(), { recursive: true });
}

function statePath(): string {
  return path.join(configDir(), 'drive-tokens.json');
}

export function loadState(): void {
  ensureConfig();
  try {
    const file = statePath();
    if (fs.existsSync(file)) {
      const tokens = JSON.parse(fs.readFileSync(file, 'utf-8')) as Tokens;
      if (tokens.scopeVersion === SCOPE_VERSION) {
        state.tokens = tokens;
      } else {
        state.lastError = 'Permissões do Google atualizadas. Reconecte a conta Google.';
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

export function credentials(): { clientId: string; clientSecret: string } {
  const settings = loadSettings();
  if (settings.driveClientId !== '' && settings.driveClientSecret !== '') {
    return { clientId: settings.driveClientId, clientSecret: settings.driveClientSecret };
  }
  return { clientId: EMBEDDED_CLIENT_ID, clientSecret: EMBEDDED_CLIENT_SECRET };
}

export function setError(message: string | null): void {
  state.lastError = message;
  emit();
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
