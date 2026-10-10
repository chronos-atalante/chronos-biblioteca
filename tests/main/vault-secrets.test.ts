import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMBEDDED_APP_KEY, SCOPE_VERSION } from '@zero/main/drive/constants';
import { appKey, loadState, persistState, state } from '@zero/main/drive/state';
import { loadSettings, saveSettings } from '@zero/main/settings';
import {
  createVault,
  destroyVault,
  getSecret,
  lockVault,
  setSecret,
  unlockVault,
  vaultExists,
  vaultPath,
} from '@zero/main/vault';
import { VAULT_SECRET } from '@zero/main/vault/secrets';
import { isVaultError, type VaultError } from '@zero/main/vault/errors';
import { resetSandbox, sandboxPath } from '../helpers/sandbox.ts';
import { FAST_KDF, openTestVault, PASSWORD } from '../helpers/vault.ts';

const TOKENS = {
  accessToken: 'token-abc',
  refreshToken: 'refresh-abc',
  expiresAt: 1_800_000_000_000,
  accountEmail: 'user@example.com',
  lastSync: null,
  scopeVersion: SCOPE_VERSION,
};

function configFile(name: string): string {
  return path.join(sandboxPath('XDG_CONFIG_HOME'), 'cronologia', name);
}

function writeJson(name: string, data: object): void {
  fs.mkdirSync(path.dirname(configFile(name)), { recursive: true });
  fs.writeFileSync(configFile(name), JSON.stringify(data), { mode: 0o600 });
}

function diskRaw(name: string): string | null {
  const file = configFile(name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
}

/** Pega o `VaultError` lançado de forma síncrona (falha fechada). */
function catchError(run: () => unknown): VaultError {
  try {
    run();
  } catch (error) {
    if (isVaultError(error)) return error;
    throw error;
  }
  throw new Error('esperava um VaultError');
}

/** Estraga o payload do cofre mantendo a sessão desbloqueada. */
function tamperVault(): void {
  const buffer = fs.readFileSync(vaultPath());
  const last = buffer.length - 1;
  buffer[last] = (buffer[last] ?? 0) ^ 0xff;
  fs.writeFileSync(vaultPath(), buffer, { mode: 0o600 });
}

/** Deixa um `settings.json` antigo, com segredo em claro, no disco. */
function writeLegacySettings(): void {
  writeJson('settings.json', {
    driveClientId: 'app-key-legada',
    drivePassphrase: 'frase-legada',
    language: 'pt-BR',
  });
}

describe('cofre é a única fonte de segredos e tokens', () => {
  beforeEach(() => {
    resetSandbox();
    destroyVault();
    state.tokens = null;
    state.lastError = null;
    state.syncing = false;
  });

  describe('sem cofre', () => {
    it('loadSettings lê só o idioma e não cria cofre', () => {
      writeLegacySettings();
      expect(loadSettings()).toEqual({
        driveClientId: '',
        drivePassphrase: '',
        language: 'pt-BR',
      });
      expect(vaultExists()).toBe(false);
    });

    it('saveSettings recusa gravar sem cofre', () => {
      const error = catchError(() =>
        saveSettings({ driveClientId: 'id', drivePassphrase: 'frase', language: 'en' }),
      );
      expect(error.code).toBe('vaultLocked');
      expect(vaultExists()).toBe(false);
      expect(fs.existsSync(configFile('settings.json'))).toBe(false);
    });

    it('tokens do dropbox-tokens.json legado não voltam do disco', () => {
      writeJson('dropbox-tokens.json', TOKENS);
      loadState();
      expect(state.tokens).toBeNull();
      expect(state.lastError).toBeNull();
    });
  });

  describe('com cofre aberto', () => {
    it('saveSettings grava segredos no cofre e só o idioma no disco', async () => {
      await openTestVault();
      const saved = saveSettings({
        driveClientId: '  app-key-nova  ',
        drivePassphrase: 'frase-nova',
        language: 'ko',
      });
      expect(saved.driveClientId).toBe('app-key-nova');
      expect(getSecret(VAULT_SECRET.drivePassphrase)).toBe('frase-nova');
      expect(getSecret(VAULT_SECRET.driveClientId)).toBe('app-key-nova');
      expect(JSON.parse(diskRaw('settings.json') ?? '')).toEqual({ language: 'ko' });
      expect(diskRaw('settings.json')).not.toContain('frase-nova');
      expect(fs.statSync(configFile('settings.json')).mode & 0o777).toBe(0o600);
      expect(loadSettings()).toMatchObject({
        driveClientId: 'app-key-nova',
        drivePassphrase: 'frase-nova',
        language: 'ko',
      });
    });

    it('um settings.json legado é ignorado: o que vale é o cofre', async () => {
      writeLegacySettings();
      await openTestVault();
      expect(loadSettings().drivePassphrase).toBe('');
      expect(getSecret(VAULT_SECRET.drivePassphrase)).toBeNull();

      // O primeiro salvamento sobrescreve o arquivo, sem segredo em claro.
      saveSettings({ driveClientId: '', drivePassphrase: '', language: 'pt-BR' });
      expect(diskRaw('settings.json')).not.toContain('frase-legada');
      expect(diskRaw('settings.json')).not.toContain('app-key-legada');
    });

    it('persistState grava no cofre e não cria arquivo de token', async () => {
      await openTestVault();
      state.tokens = { ...TOKENS, accessToken: 'token-novo' };
      persistState();
      expect(fs.existsSync(configFile('dropbox-tokens.json'))).toBe(false);
      expect(getSecret(VAULT_SECRET.dropboxTokens)).toContain('token-novo');

      state.tokens = null;
      loadState();
      expect(state.tokens).toMatchObject({ accessToken: 'token-novo' });
      expect(state.lastError).toBeNull();
    });

    it('persistState sem tokens apaga a sessão do cofre (desconexão)', async () => {
      await openTestVault();
      setSecret(VAULT_SECRET.dropboxTokens, JSON.stringify(TOKENS));
      state.tokens = null;
      persistState();
      expect(getSecret(VAULT_SECRET.dropboxTokens)).toBeNull();
      expect(fs.existsSync(configFile('dropbox-tokens.json'))).toBe(false);
    });

    it('appKey usa a App key alternativa guardada no cofre', async () => {
      await openTestVault();
      expect(appKey()).toBe(EMBEDDED_APP_KEY);
      setSecret(VAULT_SECRET.driveClientId, 'app-key-do-cofre');
      expect(appKey()).toBe('app-key-do-cofre');
    });
  });

  describe('cofre fechado', () => {
    it('loadSettings devolve segredos vazios e mantém o idioma', async () => {
      await openTestVault();
      saveSettings({ driveClientId: 'id', drivePassphrase: 'frase', language: 'zh-CN' });
      lockVault();
      expect(loadSettings()).toEqual({
        driveClientId: '',
        drivePassphrase: '',
        language: 'zh-CN',
      });
      expect(appKey()).toBe(EMBEDDED_APP_KEY);
    });

    it('saveSettings recusa gravar e não toca no disco', async () => {
      await openTestVault();
      saveSettings({ driveClientId: 'id', drivePassphrase: 'frase', language: 'pt-BR' });
      const antes = diskRaw('settings.json');
      lockVault();
      const error = catchError(() =>
        saveSettings({ driveClientId: 'outra', drivePassphrase: 'outra', language: 'en' }),
      );
      expect(error.code).toBe('vaultLocked');
      expect(diskRaw('settings.json')).toBe(antes);
      expect(loadSettings().drivePassphrase).toBe('');
    });

    it('tokens saem da memória: nem o arquivo legado no disco vale', async () => {
      writeJson('dropbox-tokens.json', TOKENS);
      await openTestVault();
      lockVault();
      loadState();
      expect(state.tokens).toBeNull();
    });

    it('persistState com sessão em memória lança e não escreve no disco', async () => {
      await openTestVault();
      lockVault();
      state.tokens = { ...TOKENS, accessToken: 'token-fechado' };
      expect(() => persistState()).toThrow();
      expect(diskRaw('dropbox-tokens.json')).toBeNull();
      expect(() => getSecret(VAULT_SECRET.dropboxTokens)).toThrow();
    });
  });

  describe('cofre adulterado', () => {
    it('loadSettings falha fechada e não zera o settings.json', async () => {
      writeLegacySettings();
      await openTestVault();
      tamperVault();
      expect(loadSettings()).toEqual({
        driveClientId: '',
        drivePassphrase: '',
        language: 'pt-BR',
      });
      expect(diskRaw('settings.json')).toContain('frase-legada');
    });

    it('tokens não voltam e nenhum arquivo de token é criado', async () => {
      await openTestVault();
      tamperVault();
      state.tokens = { ...TOKENS, accessToken: 'token-que-sumiu' };
      loadState();
      expect(state.tokens).toBeNull();
      expect(diskRaw('dropbox-tokens.json')).toBeNull();
    });
  });

  describe('sessão e arquivo', () => {
    it('unlockVault devolve o que foi gravado antes de trancar', async () => {
      await createVault(PASSWORD, FAST_KDF);
      saveSettings({ driveClientId: 'id-x', drivePassphrase: 'frase-x', language: 'ja' });
      lockVault();
      expect(() => getSecret(VAULT_SECRET.drivePassphrase)).toThrow();
      await unlockVault(PASSWORD);
      expect(getSecret(VAULT_SECRET.drivePassphrase)).toBe('frase-x');
      expect(loadSettings()).toMatchObject({ driveClientId: 'id-x', language: 'ja' });
    });
  });
});
