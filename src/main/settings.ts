import fs from 'fs';
import path from 'path';
import { writeJsonAtomic } from '@zero/main/jsonfile';
import { configDir } from '@zero/main/paths';
import type { AppSettings, Language } from '@zero/types';
import { VAULT_SECRET, vaultUnlocked } from '@zero/main/vault/secrets';
import { getSecret, setSecret } from '@zero/main/vault/vault';

/**
 * Configurações persistidas. O disco guarda **só** o `language`: os segredos
 * (`drivePassphrase`, `driveClientId`) moram no cofre de segredos em
 * `/var/lib/.cronologia/.vault` e são lidos dele quando o cofre está
 * desbloqueado (sem cofre aberto voltam `''`, falha fechada). Um `settings.json`
 * antigo com `enc:`/keyring é simplesmente ignorado no primeiro salvamento.
 * Ver `docs/credenciais.md`.
 */
const DEFAULTS: AppSettings = {
  driveClientId: '',
  drivePassphrase: '',
  language: 'pt-BR',
};

function ensureConfigDir(): void {
  fs.mkdirSync(configDir(), { recursive: true });
}

function settingsPath(): string {
  ensureConfigDir();
  return path.join(configDir(), 'settings.json');
}

/** Lê o idioma; qualquer valor fora do catálogo cai no padrão. */
function languageField(record: object): Language {
  const value: unknown = Reflect.get(record, 'language');
  return value === 'pt-BR' ||
    value === 'en' ||
    value === 'ko' ||
    value === 'zh-CN' ||
    value === 'ja'
    ? value
    : DEFAULTS.language;
}

/** Idioma do disco (o único campo persistido fora do cofre). */
function readLanguage(): Language {
  try {
    const file = settingsPath();
    if (!fs.existsSync(file)) return DEFAULTS.language;
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS.language;
    return languageField(parsed);
  } catch {
    return DEFAULTS.language;
  }
}

/** Segredos do cofre; cofre fechado/ilegível → `''` (falha fechada). */
function readSecrets(): Pick<AppSettings, 'driveClientId' | 'drivePassphrase'> {
  const empty = { driveClientId: '', drivePassphrase: '' };
  if (!vaultUnlocked()) return empty;
  try {
    return {
      drivePassphrase: getSecret(VAULT_SECRET.drivePassphrase) ?? '',
      driveClientId: getSecret(VAULT_SECRET.driveClientId) ?? '',
    };
  } catch {
    return empty;
  }
}

export function loadSettings(): AppSettings {
  return { ...DEFAULTS, ...readSecrets(), language: readLanguage() };
}

/**
 * Grava as configurações: o idioma no disco (0600, escrita atômica) e os
 * segredos no cofre. Exige cofre desbloqueado — sem ele lança
 * `VaultError('vaultLocked')`, e nada é gravado (nada é sobrescrito com `''`).
 * O chamador (UI) abre o cofre antes de chegar aqui.
 */
export function saveSettings(settings: AppSettings): AppSettings {
  const next: AppSettings = {
    driveClientId: settings.driveClientId.trim(),
    drivePassphrase: settings.drivePassphrase,
    language:
      settings.language === 'en' ||
      settings.language === 'ko' ||
      settings.language === 'zh-CN' ||
      settings.language === 'ja'
        ? settings.language
        : 'pt-BR',
  };
  // Segredos primeiro: se o cofre estiver fechado, a exceção aborta antes de
  // qualquer escrita em disco.
  setSecret(VAULT_SECRET.drivePassphrase, next.drivePassphrase);
  setSecret(VAULT_SECRET.driveClientId, next.driveClientId);
  writeJsonAtomic(settingsPath(), { language: next.language }, 0o600);
  return next;
}
