import { beforeEach, describe, expect, it } from 'vitest';
import { decryptWith, isEncrypted, maybeEncrypt } from '@zero/main/drive/crypto';
import { saveSettings } from '@zero/main/settings';
import { resetSandbox } from '../helpers/sandbox.ts';
import { PASSPHRASE } from '../helpers/drive.ts';

const SECRET_DATA = Buffer.from('{"obras":[{"id":"segredo"}]}', 'utf-8');

function withPassphrase(passphrase = PASSPHRASE): void {
  saveSettings({ driveClientId: '', driveClientSecret: '', drivePassphrase: passphrase });
}

describe('formato WTENC3 (único)', { timeout: 30_000 }, () => {
  beforeEach(() => {
    resetSandbox();
    withPassphrase();
  });

  it('roundtrip cifra e decifra com a senha', () => {
    const encrypted = maybeEncrypt(SECRET_DATA);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted.subarray(0, 6).toString('utf-8')).toBe('WTENC3');
    expect(decryptWith(encrypted, PASSPHRASE).equals(SECRET_DATA)).toBe(true);
  });

  it('gera salt e IV aleatórios a cada chamada', () => {
    const first = maybeEncrypt(SECRET_DATA);
    const second = maybeEncrypt(SECRET_DATA);
    expect(first.equals(second)).toBe(false);
    expect(decryptWith(first, PASSPHRASE).equals(SECRET_DATA)).toBe(true);
    expect(decryptWith(second, PASSPHRASE).equals(SECRET_DATA)).toBe(true);
  });

  it('recusa senha errada sem vazar o motivo', () => {
    const encrypted = maybeEncrypt(SECRET_DATA);
    expect(() => decryptWith(encrypted, 'senha-errada')).toThrow(
      'Senha de criptografia incorreta ou backup corrompido.',
    );
  });

  it('exige senha para cifrar e para decifrar', () => {
    withPassphrase('');
    expect(() => maybeEncrypt(SECRET_DATA)).toThrow(
      'Defina uma senha de criptografia do backup nas configurações.',
    );
    const encrypted = Buffer.concat([Buffer.from('WTENC3'), Buffer.alloc(44), Buffer.from('x')]);
    expect(() => decryptWith(encrypted, '')).toThrow(
      'Este backup está criptografado. Informe a senha de criptografia.',
    );
  });

  it('rejeita buffers truncados e adulterados sem quebrar', () => {
    const encrypted = maybeEncrypt(SECRET_DATA);
    expect(() => decryptWith(encrypted.subarray(0, 20), PASSPHRASE)).toThrow(
      'Senha de criptografia incorreta ou backup corrompido.',
    );
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptWith(tampered, PASSPHRASE)).toThrow(
      'Senha de criptografia incorreta ou backup corrompido.',
    );
  });

  it('devolve em claro o que nunca foi cifrado (compatibilidade)', () => {
    const plain = Buffer.from('texto-antigo-sem-cifra', 'utf-8');
    expect(isEncrypted(plain)).toBe(false);
    expect(decryptWith(plain, PASSPHRASE).equals(plain)).toBe(true);
  });

  it('não reconhece os formatos antigos WTENC1 e WTENC2', () => {
    for (const magic of ['WTENC1', 'WTENC2']) {
      const old = Buffer.concat([Buffer.from(magic), Buffer.alloc(44), Buffer.from('x')]);
      expect(isEncrypted(old)).toBe(false);
      expect(decryptWith(old, PASSPHRASE).equals(old)).toBe(true);
    }
  });
});
