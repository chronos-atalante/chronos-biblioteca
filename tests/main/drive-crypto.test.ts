import { beforeEach, describe, expect, it } from 'vitest';
import { decryptWith, encryptIfNeeded, isEncrypted, maybeEncrypt } from '@zero/main/drive/crypto';
import { saveSettings } from '@zero/main/settings';
import { resetSandbox } from '../helpers/sandbox.ts';
import { PASSPHRASE, encryptForTest } from '../helpers/drive.ts';

const SECRET_DATA = Buffer.from('{"obras":[{"id":"segredo"}]}', 'utf-8');

function withPassphrase(passphrase = PASSPHRASE): void {
  saveSettings({ driveClientId: '', driveClientSecret: '', drivePassphrase: passphrase });
}

describe('formato WTENC2 (atual)', { timeout: 30_000 }, () => {
  beforeEach(() => {
    resetSandbox();
    withPassphrase();
  });

  it('roundtrip cifra e decifra com a senha', () => {
    const encrypted = maybeEncrypt(SECRET_DATA);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted.subarray(0, 6).toString('utf-8')).toBe('WTENC2');
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
    const encrypted = Buffer.concat([Buffer.from('WTENC2'), Buffer.alloc(44), Buffer.from('x')]);
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
});

describe('formato WTENC1 (legado)', { timeout: 30_000 }, () => {
  beforeEach(() => {
    resetSandbox();
    withPassphrase();
  });

  it('continua restaurando backups antigos', () => {
    const legacy = encryptForTest(SECRET_DATA, PASSPHRASE);
    expect(legacy.subarray(0, 6).toString('utf-8')).toBe('WTENC1');
    expect(isEncrypted(legacy)).toBe(true);
    expect(decryptWith(legacy, PASSPHRASE).equals(SECRET_DATA)).toBe(true);
  });

  it('não cifra duas vezes o que já está cifrado', () => {
    const legacy = encryptForTest(SECRET_DATA, PASSPHRASE);
    const again = encryptIfNeeded(legacy);
    expect(again.equals(legacy)).toBe(true);
    const current = encryptIfNeeded(maybeEncrypt(SECRET_DATA));
    expect(decryptWith(current, PASSPHRASE).equals(SECRET_DATA)).toBe(true);
  });

  it('cifra legados em claro na migração quando há senha', () => {
    const plain = Buffer.from('backup-legado-em-claro', 'utf-8');
    const migrated = encryptIfNeeded(plain);
    expect(isEncrypted(migrated)).toBe(true);
    expect(decryptWith(migrated, PASSPHRASE).toString('utf-8')).toBe('backup-legado-em-claro');
  });

  it('mantém legados em claro quando não há senha', () => {
    withPassphrase('');
    const plain = Buffer.from('backup-legado-em-claro', 'utf-8');
    expect(encryptIfNeeded(plain).equals(plain)).toBe(true);
  });
});
