import fs from 'fs';
import path from 'path';
import { configDir } from '@zero/main/library';
import type { AppSettings } from '@zero/types';

const DEFAULTS: AppSettings = {
  driveClientId: '',
  driveClientSecret: '',
  drivePassphrase: '',
};

function ensureConfigDir(): void {
  fs.mkdirSync(configDir(), { recursive: true });
}

function settingsPath(): string {
  ensureConfigDir();
  return path.join(configDir(), 'settings.json');
}

/** Lê um campo string de um objeto vindo de JSON; qualquer outra forma usa o padrão. */
function field(record: object, key: keyof AppSettings): string {
  const value: unknown = Reflect.get(record, key);
  return typeof value === 'string' ? value : DEFAULTS[key];
}

export function loadSettings(): AppSettings {
  try {
    const file = settingsPath();
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULTS };
    return {
      driveClientId: field(parsed, 'driveClientId'),
      driveClientSecret: field(parsed, 'driveClientSecret'),
      drivePassphrase: field(parsed, 'drivePassphrase'),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: AppSettings): AppSettings {
  const next: AppSettings = {
    driveClientId: settings.driveClientId.trim(),
    driveClientSecret: settings.driveClientSecret.trim(),
    drivePassphrase: settings.drivePassphrase,
  };
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  return next;
}
