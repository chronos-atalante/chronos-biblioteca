import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '@zero/main/settings';
import { resetSandbox, sandboxPath } from '../helpers/sandbox';

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
});
