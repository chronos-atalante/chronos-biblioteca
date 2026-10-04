import crypto from 'crypto';
import { loadSettings } from '@zero/main/settings';

const ENC_MAGIC = Buffer.from('WTENC1');

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32);
}

function encryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([ENC_MAGIC, salt, iv, cipher.getAuthTag(), encrypted]);
}

function isEncrypted(data: Buffer): boolean {
  return data.subarray(0, ENC_MAGIC.length).equals(ENC_MAGIC);
}

function decryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = data.subarray(ENC_MAGIC.length, ENC_MAGIC.length + 16);
  const iv = data.subarray(ENC_MAGIC.length + 16, ENC_MAGIC.length + 28);
  const tag = data.subarray(ENC_MAGIC.length + 28, ENC_MAGIC.length + 44);
  const payload = data.subarray(ENC_MAGIC.length + 44);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}

export function maybeEncrypt(data: Buffer): Buffer {
  const passphrase = loadSettings().drivePassphrase;
  if (passphrase === '') {
    throw new Error('Defina uma senha de criptografia do backup nas configurações.');
  }
  return encryptBuffer(data, passphrase);
}

export function decryptWith(data: Buffer, passphrase: string): Buffer {
  if (!isEncrypted(data)) return data;
  if (passphrase === '') {
    throw new Error('Este backup está criptografado. Informe a senha de criptografia.');
  }
  try {
    return decryptBuffer(data, passphrase);
  } catch {
    throw new Error('Senha de criptografia incorreta ou backup corrompido.');
  }
}
