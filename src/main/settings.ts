import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';
import { writeJsonAtomic } from '@zero/main/jsonfile';
import { configDir } from '@zero/main/paths';
import type { AppSettings, Language } from '@zero/types';

/**
 * Forma persistida das configurações (nomes de campos mantidos por
 * compatibilidade com o `settings.json` existente):
 * - `driveClientId`: App key alternativa (override da embutida; sem UI);
 * - `driveClientSecret`: legado do provedor anterior, ignorado;
 * - `drivePassphrase`: senha de criptografia do backup;
 * - `language`: idioma da interface (`pt-BR`, `en`, `ko`, `zh-CN` ou `ja`).
 */
const DEFAULTS: AppSettings = {
  driveClientId: '',
  driveClientSecret: '',
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

/** Lê um campo string de um objeto vindo de JSON; qualquer outra forma usa o padrão. */
function field(record: object, key: keyof AppSettings): string {
  const value: unknown = Reflect.get(record, key);
  return typeof value === 'string' ? value : DEFAULTS[key];
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

const ENC_PREFIX = 'enc:';

/**
 * Guarda a senha no keyring do SO (libsecret/KWallet/Keychain/DPAPI).
 * Sem keyring disponível, mantém em claro com permissão 0600 (fallback);
 * instalações antigas em claro continuam lendo normalmente e migram
 * sozinhas para o keyring no próximo salvamento.
 */
function protect(passphrase: string): string {
  if (passphrase === '' || !safeStorage.isEncryptionAvailable()) return passphrase;
  try {
    return `${ENC_PREFIX}${safeStorage.encryptString(passphrase).toString('base64')}`;
  } catch {
    return passphrase;
  }
}

/**
 * Reverte `protect`. Sem keyring ou com blob adulterado, a senha vira ''
 * (falha fechada: o backup passa a exigir a senha em vez de usar lixo).
 */
function unprotect(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  try {
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(Buffer.from(stored.slice(ENC_PREFIX.length), 'base64'));
  } catch {
    return '';
  }
}

/**
 * Informa se o cofre do SO está disponível para proteger a senha do backup.
 * A UI usa isso para avisar quando a senha cai no fallback em claro.
 */
export function isKeyringAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
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
      drivePassphrase: unprotect(field(parsed, 'drivePassphrase')),
      language: languageField(parsed),
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
    language:
      settings.language === 'en' ||
      settings.language === 'ko' ||
      settings.language === 'zh-CN' ||
      settings.language === 'ja'
        ? settings.language
        : 'pt-BR',
  };
  // Em disco a senha vai protegida (keyring) ou em claro (fallback); o
  // retorno é sempre a forma utilizável, que o renderer exibe no formulário.
  // Escrita atômica com 0600: nem JSON pela metade, nem legível por terceiros.
  const onDisk: AppSettings = { ...next, drivePassphrase: protect(next.drivePassphrase) };
  writeJsonAtomic(settingsPath(), onDisk, 0o600);
  return next;
}
