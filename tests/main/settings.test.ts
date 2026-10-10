import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '@zero/main/settings';
import { createVault, destroyVault, lockVault } from '@zero/main/vault';
import { VaultError, isVaultError } from '@zero/main/vault/errors';
import { resetSandbox, sandboxPath } from '../helpers/sandbox.ts';
import { FAST_KDF, PASSWORD } from '../helpers/vault.ts';

function settingsFile(): string {
  return path.join(sandboxPath('XDG_CONFIG_HOME'), 'chronos-biblioteca', 'settings.json');
}

function writeSettingsJson(data: object): void {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(data), 'utf-8');
}

async function catchError(run: () => unknown): Promise<VaultError> {
  try {
    await run();
  } catch (error) {
    if (isVaultError(error)) return error;
    throw error;
  }
  throw new Error('esperava um VaultError');
}

describe('settings', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await createVault(PASSWORD, FAST_KDF);
  });

  it('devolve os padrões quando o arquivo não existe', () => {
    expect(loadSettings()).toEqual({
      driveClientId: '',
      drivePassphrase: '',
      language: 'pt-BR',
    });
  });

  it('devolve os padrões quando o JSON está corrompido', () => {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), '{ não é json', 'utf-8');
    expect(loadSettings()).toEqual({
      driveClientId: '',
      drivePassphrase: '',
      language: 'pt-BR',
    });
  });

  it('lê só o idioma do disco (segredos moram no cofre)', () => {
    writeSettingsJson({ language: 'ko' });
    expect(loadSettings()).toEqual({
      driveClientId: '',
      drivePassphrase: '',
      language: 'ko',
    });
  });

  it('ignora o settings.json antigo (enc:/keyring e campos de outro provedor)', () => {
    writeSettingsJson({
      language: 'ja',
      drivePassphrase: 'enc:abc123',
      driveClientId: 'id-antigo',
      driveClientSecret: 'segredo-antigo',
    });
    expect(loadSettings()).toEqual({
      driveClientId: '',
      drivePassphrase: '',
      language: 'ja',
    });

    // O primeiro salvamento regrava o arquivo só com o idioma.
    saveSettings({ driveClientId: 'nova-key', drivePassphrase: 'frase', language: 'pt-BR' });
    const raw = fs.readFileSync(settingsFile(), 'utf-8');
    expect(raw).not.toContain('enc:');
    expect(raw).not.toContain('segredo-antigo');
    expect(JSON.parse(raw)).toEqual({ language: 'pt-BR' });
  });

  it('saveSettings grava segredos no cofre e idioma no disco', () => {
    const saved = saveSettings({
      driveClientId: '  minha-app-key-123  ',
      drivePassphrase: '  segredo de backup  ',
      language: 'pt-BR',
    });
    expect(saved).toEqual({
      driveClientId: 'minha-app-key-123',
      drivePassphrase: '  segredo de backup  ',
      language: 'pt-BR',
    });
    expect(loadSettings()).toEqual(saved);

    // Nada de segredo fora do cofre.
    const raw = fs.readFileSync(settingsFile(), 'utf-8');
    expect(raw).not.toContain('minha-app-key-123');
    expect(raw).not.toContain('segredo de backup');
    expect(JSON.parse(raw)).toEqual({ language: 'pt-BR' });
  });

  it('persiste o idioma e normaliza valores fora do catálogo', () => {
    expect(saveSettings({ driveClientId: '', drivePassphrase: '', language: 'en' }).language).toBe(
      'en',
    );
    expect(loadSettings().language).toBe('en');

    expect(saveSettings({ driveClientId: '', drivePassphrase: '', language: 'ko' }).language).toBe(
      'ko',
    );
    expect(loadSettings().language).toBe('ko');

    expect(
      saveSettings({ driveClientId: '', drivePassphrase: '', language: 'zh-CN' }).language,
    ).toBe('zh-CN');
    expect(loadSettings().language).toBe('zh-CN');

    writeSettingsJson({ language: 'xx' });
    expect(loadSettings().language).toBe('pt-BR');
  });

  it('grava settings.json com permissão 0600', () => {
    saveSettings({ driveClientId: 'id', drivePassphrase: 'frase', language: 'pt-BR' });
    const mode = fs.statSync(settingsFile()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('segredos não sobrevivem ao cofre fechado (falha fechada)', () => {
    saveSettings({ driveClientId: 'id', drivePassphrase: 'frase-secreta', language: 'pt-BR' });
    lockVault();
    expect(loadSettings().drivePassphrase).toBe('');
    expect(loadSettings().driveClientId).toBe('');
    // O idioma continua no disco, independente do cofre.
    expect(loadSettings().language).toBe('pt-BR');
  });

  it('saveSettings recusa gravar com o cofre fechado', async () => {
    saveSettings({ driveClientId: 'id', drivePassphrase: 'frase-secreta', language: 'en' });
    const antes = fs.readFileSync(settingsFile(), 'utf-8');
    lockVault();
    const error = await catchError(() =>
      saveSettings({ driveClientId: 'id', drivePassphrase: 'frase', language: 'pt-BR' }),
    );
    expect(error.code).toBe('vaultLocked');
    // Nada foi gravado: nem o idioma novo entrou no disco.
    expect(fs.readFileSync(settingsFile(), 'utf-8')).toBe(antes);
    expect(loadSettings().language).toBe('en');
    expect(loadSettings().drivePassphrase).toBe('');
  });
});
