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
import { resetSandbox, sandboxPath } from '../helpers/sandbox.ts';

/** Perfil barato para a suíte: o cofre de produção usa `KDF_DEFAULTS`. */
const FAST_KDF = { memoryKiB: 16_384, iterations: 1, parallelism: 1 };
const PASSWORD = 'uva-preta-42-estrela';

const TOKENS = {
  accessToken: 'token-abc',
  refreshToken: 'refresh-abc',
  expiresAt: 1_800_000_000_000,
  accountEmail: 'user@example.com',
  lastSync: null,
  scopeVersion: SCOPE_VERSION,
};

function configFile(name: string): string {
  return path.join(sandboxPath('XDG_CONFIG_HOME'), 'chronos-biblioteca', name);
}

function writeJson(name: string, data: object): void {
  fs.mkdirSync(path.dirname(configFile(name)), { recursive: true });
  fs.writeFileSync(configFile(name), JSON.stringify(data), { mode: 0o600 });
}

function diskRaw(name: string): string | null {
  const file = configFile(name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
}

describe('vault ↔ credenciais: migração legado → cofre', () => {
  beforeEach(() => {
    resetSandbox();
    destroyVault();
    state.tokens = null;
    state.lastError = null;
    state.syncing = false;
  });

  describe('sem cofre: o modo legado continua 100% funcional', () => {
    it('settings legados são lidos sem criar cofre', () => {
      writeJson('settings.json', {
        driveClientId: 'app-key-legada',
        driveClientSecret: '',
        drivePassphrase: 'frase-legada',
        language: 'pt-BR',
      });
      expect(loadSettings()).toMatchObject({
        driveClientId: 'app-key-legada',
        drivePassphrase: 'frase-legada',
      });
      expect(vaultExists()).toBe(false);
    });

    it('saveSettings segue gravando no arquivo legado', () => {
      saveSettings({
        driveClientId: 'app-key-nova',
        driveClientSecret: '',
        drivePassphrase: 'frase-nova',
        language: 'pt-BR',
      });
      expect(vaultExists()).toBe(false);
      expect(diskRaw('settings.json')).toContain('frase-nova');
      expect(loadSettings().drivePassphrase).toBe('frase-nova');
    });

    it('tokens seguem no dropbox-tokens.json com 0600', () => {
      writeJson('dropbox-tokens.json', TOKENS);
      loadState();
      expect(state.tokens?.accessToken).toBe('token-abc');
      expect(fs.statSync(configFile('dropbox-tokens.json')).mode & 0o777).toBe(0o600);

      persistState();
      expect(diskRaw('dropbox-tokens.json')).toContain('token-abc');
      expect(vaultExists()).toBe(false);
    });
  });

  describe('com cofre desbloqueado: segredos migram para dentro', () => {
    it('a primeira leitura migra settings.json para o cofre e zera o disco', async () => {
      writeJson('settings.json', {
        driveClientId: 'app-key-legada',
        driveClientSecret: '',
        drivePassphrase: 'frase-legada',
        language: 'pt-BR',
      });
      await createVault(PASSWORD, FAST_KDF);

      const loaded = loadSettings();
      expect(loaded.drivePassphrase).toBe('frase-legada');
      expect(loaded.driveClientId).toBe('app-key-legada');

      expect(getSecret(VAULT_SECRET.drivePassphrase)).toBe('frase-legada');
      expect(getSecret(VAULT_SECRET.driveClientId)).toBe('app-key-legada');
      const raw = diskRaw('settings.json');
      expect(raw).toContain('"drivePassphrase": ""');
      expect(raw).toContain('"driveClientId": ""');
      expect(raw).not.toContain('frase-legada');
      expect(raw).not.toContain('app-key-legada');
      expect(raw).toContain('"language": "pt-BR"');
    });

    it('a migração é idempotente (segunda leitura não regrava nada)', async () => {
      writeJson('settings.json', {
        driveClientId: '',
        driveClientSecret: '',
        drivePassphrase: 'frase-legada',
        language: 'pt-BR',
      });
      await createVault(PASSWORD, FAST_KDF);
      loadSettings();
      const first = diskRaw('settings.json');
      const again = loadSettings();
      expect(again.drivePassphrase).toBe('frase-legada');
      expect(diskRaw('settings.json')).toBe(first);
    });

    it('saveSettings com cofre aberto grava lá dentro e zera o arquivo', async () => {
      await createVault(PASSWORD, FAST_KDF);
      const saved = saveSettings({
        driveClientId: 'app-key-nova',
        driveClientSecret: '',
        drivePassphrase: 'frase-nova',
        language: 'pt-BR',
      });
      expect(saved.drivePassphrase).toBe('frase-nova');
      expect(getSecret(VAULT_SECRET.drivePassphrase)).toBe('frase-nova');
      expect(getSecret(VAULT_SECRET.driveClientId)).toBe('app-key-nova');
      expect(diskRaw('settings.json')).not.toContain('frase-nova');
      expect(loadSettings()).toMatchObject({
        drivePassphrase: 'frase-nova',
        driveClientId: 'app-key-nova',
      });
    });

    it('o que foi salvo com o cofre fechado é levado para dentro ao desbloquear', async () => {
      await createVault(PASSWORD, FAST_KDF);
      lockVault();

      saveSettings({
        driveClientId: '',
        driveClientSecret: '',
        drivePassphrase: 'frase-do-periodo-fechado',
        language: 'pt-BR',
      });
      // Fechado: o disco volta a ser a fonte (comportamento legado).
      expect(loadSettings().drivePassphrase).toBe('frase-do-periodo-fechado');
      expect(() => getSecret(VAULT_SECRET.drivePassphrase)).toThrow();

      await unlockVault(PASSWORD);
      expect(loadSettings().drivePassphrase).toBe('frase-do-periodo-fechado');
      expect(getSecret(VAULT_SECRET.drivePassphrase)).toBe('frase-do-periodo-fechado');
      expect(diskRaw('settings.json')).not.toContain('frase-do-periodo-fechado');
    });

    it('a primeira leitura de tokens migra o arquivo para o cofre', async () => {
      writeJson('dropbox-tokens.json', TOKENS);
      await createVault(PASSWORD, FAST_KDF);

      loadState();
      expect(state.tokens?.accessToken).toBe('token-abc');
      expect(fs.existsSync(configFile('dropbox-tokens.json'))).toBe(false);
      const inVault = getSecret(VAULT_SECRET.dropboxTokens);
      expect(inVault).not.toBeNull();
      expect(inVault).toContain('token-abc');
    });

    it('persistState grava no cofre e não cria arquivo legado', async () => {
      await createVault(PASSWORD, FAST_KDF);
      state.tokens = { ...TOKENS, accessToken: 'token-novo' };
      persistState();
      expect(fs.existsSync(configFile('dropbox-tokens.json'))).toBe(false);
      expect(getSecret(VAULT_SECRET.dropboxTokens)).toContain('token-novo');
      loadState();
      expect(state.tokens).toMatchObject({ accessToken: 'token-novo' });
    });

    it('persistState sem tokens apaga do cofre e do disco (desconexão)', async () => {
      await createVault(PASSWORD, FAST_KDF);
      setSecret(VAULT_SECRET.dropboxTokens, JSON.stringify(TOKENS));
      state.tokens = null;
      persistState();
      expect(getSecret(VAULT_SECRET.dropboxTokens)).toBeNull();
      expect(fs.existsSync(configFile('dropbox-tokens.json'))).toBe(false);
    });

    it('appKey passa a ver a App key alternativa guardada no cofre', async () => {
      await createVault(PASSWORD, FAST_KDF);
      expect(appKey()).toBe(EMBEDDED_APP_KEY);
      setSecret(VAULT_SECRET.driveClientId, 'app-key-do-cofre');
      expect(appKey()).toBe('app-key-do-cofre');
    });
  });

  describe('cofre fechado: falha fechada no legado', () => {
    it('após a migração, os segredos ficam indisponíveis (vazio) até desbloquear', async () => {
      writeJson('settings.json', {
        driveClientId: 'app-key-legada',
        driveClientSecret: '',
        drivePassphrase: 'frase-legada',
        language: 'pt-BR',
      });
      await createVault(PASSWORD, FAST_KDF);
      loadSettings();
      lockVault();

      const locked = loadSettings();
      expect(locked.drivePassphrase).toBe('');
      expect(locked.driveClientId).toBe('');
      expect(locked.language).toBe('pt-BR');
      expect(appKey()).toBe(EMBEDDED_APP_KEY);
    });

    it('loadState fechado lê só o arquivo legado', async () => {
      writeJson('dropbox-tokens.json', TOKENS);
      await createVault(PASSWORD, FAST_KDF);
      lockVault();

      loadState();
      expect(state.tokens?.accessToken).toBe('token-abc');
      expect(fs.existsSync(configFile('dropbox-tokens.json'))).toBe(true);
    });

    it('persistState fechado volta a escrever o arquivo com 0600', async () => {
      await createVault(PASSWORD, FAST_KDF);
      lockVault();
      state.tokens = { ...TOKENS, accessToken: 'token-fechado' };
      persistState();
      expect(diskRaw('dropbox-tokens.json')).toContain('token-fechado');
      expect(fs.statSync(configFile('dropbox-tokens.json')).mode & 0o777).toBe(0o600);
      expect(() => getSecret(VAULT_SECRET.dropboxTokens)).toThrow();
    });
  });

  describe('cofre adulterado: falha fechada sem perder o disco', () => {
    it('loadSettings mantém o legado e não zera o settings.json', async () => {
      writeJson('settings.json', {
        driveClientId: 'app-key-legada',
        driveClientSecret: '',
        drivePassphrase: 'frase-legada',
        language: 'pt-BR',
      });
      await createVault(PASSWORD, FAST_KDF);
      tamperVault();

      const loaded = loadSettings();
      expect(loaded.drivePassphrase).toBe('frase-legada');
      expect(loaded.driveClientId).toBe('app-key-legada');
      expect(diskRaw('settings.json')).toContain('frase-legada');
    });

    it('loadState mantém os tokens do arquivo quando o cofre não abre', async () => {
      writeJson('dropbox-tokens.json', TOKENS);
      await createVault(PASSWORD, FAST_KDF);
      tamperVault();

      loadState();
      expect(state.tokens?.accessToken).toBe('token-abc');
      expect(fs.existsSync(configFile('dropbox-tokens.json'))).toBe(true);
    });
  });
});

/** Estraga o payload do cofre mantendo a sessão desbloqueada. */
function tamperVault(): void {
  const file = vaultPath();
  const buffer = fs.readFileSync(file);
  const last = buffer.length - 1;
  buffer[last] = (buffer[last] ?? 0) ^ 0xff;
  fs.writeFileSync(file, buffer, { mode: 0o600 });
}
