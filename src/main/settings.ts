import fs from 'fs';
import path from 'path';
import { configDir } from './library';
import type { AppSettings } from '../shared/types';

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

export function loadSettings(): AppSettings {
  try {
    const file = settingsPath();
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<AppSettings>;
    return { ...DEFAULTS, ...raw };
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
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return next;
}
