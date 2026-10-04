import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '@zero/main/settings';
import { safeStorage } from '../mocks/electron.ts';
import { resetSandbox, sandboxPath } from '../helpers/sandbox.ts';

function settingsFile(): string {
  return path.join(sandboxPath('XDG_CONFIG_HOME'), 'webtoons-biblioteca', 'settings.json');
}

describe('settings', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('devolve os padrões quando o arquivo não existe', () => {
    expect(loadSettings()).toEqual({
      driveClientId: '',
      driveClientSecret: '',
      drivePassphrase: '',
    });
  });

  it('devolve os padrões quando o JSON está corrompido', () => {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), '{ não é json', 'utf-8');
    expect(loadSettings()).toEqual({
      driveClientId: '',
      driveClientSecret: '',
      drivePassphrase: '',
    });
  });

  it('faz merge de campos parciais salvos', () => {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify({ driveClientId: 'id-1' }), 'utf-8');
    expect(loadSettings()).toEqual({
      driveClientId: 'id-1',
      driveClientSecret: '',
      drivePassphrase: '',
    });
  });

  it('saveSettings remove espaços das credenciais e persiste', () => {
    const saved = saveSettings({
      driveClientId: '  meuid.apps.googleusercontent.com ',
      driveClientSecret: '  GOCSPX-segredo  ',
      drivePassphrase: '  segredo de backup  ',
    });
    expect(saved).toEqual({
      driveClientId: 'meuid.apps.googleusercontent.com',
      driveClientSecret: 'GOCSPX-segredo',
      drivePassphrase: '  segredo de backup  ',
    });
    expect(loadSettings()).toEqual(saved);
  });

  it('grava settings.json com permissão 0600', () => {
    saveSettings({
      driveClientId: 'id',
      driveClientSecret: 'segredo',
      drivePassphrase: 'frase',
    });
    const mode = fs.statSync(settingsFile()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('mantém a senha em claro sem keyring (fallback)', () => {
    const saved = saveSettings({
      driveClientId: 'id',
      driveClientSecret: 'segredo',
      drivePassphrase: 'frase-secreta',
    });
    expect(saved.drivePassphrase).toBe('frase-secreta');
    expect(fs.readFileSync(settingsFile(), 'utf-8')).toContain('frase-secreta');
    expect(loadSettings().drivePassphrase).toBe('frase-secreta');
  });

  it('cifra a senha no keyring quando disponível', () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    try {
      const saved = saveSettings({
        driveClientId: 'id',
        driveClientSecret: 'segredo',
        drivePassphrase: 'frase-secreta',
      });
      expect(saved.drivePassphrase).toBe('frase-secreta');
      const raw = fs.readFileSync(settingsFile(), 'utf-8');
      expect(raw).toContain('enc:');
      expect(raw).not.toContain('frase-secreta');
      expect(loadSettings().drivePassphrase).toBe('frase-secreta');
    } finally {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);
    }
  });

  it('lê instalações antigas em claro mesmo com keyring', () => {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(
      settingsFile(),
      JSON.stringify({ driveClientId: '', driveClientSecret: '', drivePassphrase: 'antiga' }),
      'utf-8',
    );
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    try {
      expect(loadSettings().drivePassphrase).toBe('antiga');
    } finally {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);
    }
  });

  it('falha fechada quando o keyring some depois de cifrar', () => {
    safeStorage.isEncryptionAvailable.mockReturnValue(true);
    try {
      saveSettings({ driveClientId: '', driveClientSecret: '', drivePassphrase: 'frase-secreta' });
    } finally {
      safeStorage.isEncryptionAvailable.mockReturnValue(false);
    }
    expect(loadSettings().drivePassphrase).toBe('');
  });
});
