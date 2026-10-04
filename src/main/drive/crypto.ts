import crypto from 'crypto';
import { loadSettings } from '@zero/main/settings';

const MAGIC_V1 = Buffer.from('WTENC1');
const MAGIC_V2 = Buffer.from('WTENC2');
const MAGIC_BYTES = 6;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES;

type BackupFormat = 'v1' | 'v2';

/**
 * Custo do scrypt, sempre explícito (os padrões do Node mudam entre versões).
 * N=2^16 usa ~64 MiB por derivação: 4x acima do padrão do Node (2^14) e pesado
 * o bastante para inviabilizar força bruta paralela (ASIC/GPU) contra a senha,
 * sem travar o backup manual (típico: <1s por arquivo em desktop).
 */
function deriveKey(passphrase: string, salt: Buffer, format: BackupFormat): Buffer {
  if (format === 'v1') return crypto.scryptSync(passphrase, salt, 32);
  return crypto.scryptSync(passphrase, salt, 32, {
    N: 65536,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}

function encryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt, 'v2'), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC_V2, salt, iv, cipher.getAuthTag(), encrypted]);
}

function formatOf(data: Buffer): BackupFormat | null {
  const magic = data.subarray(0, MAGIC_BYTES);
  if (magic.equals(MAGIC_V2)) return 'v2';
  if (magic.equals(MAGIC_V1)) return 'v1';
  return null;
}

/** Diz se o buffer já está criptografado (qualquer versão do formato). */
export function isEncrypted(data: Buffer): boolean {
  return formatOf(data) !== null;
}

function decryptBuffer(data: Buffer, passphrase: string): Buffer {
  const format = formatOf(data);
  if (format === null) throw new Error('Não é um backup criptografado.');
  if (data.length < HEADER_BYTES) throw new Error('Backup truncado ou corrompido.');
  const salt = data.subarray(MAGIC_BYTES, MAGIC_BYTES + SALT_BYTES);
  const iv = data.subarray(MAGIC_BYTES + SALT_BYTES, MAGIC_BYTES + SALT_BYTES + IV_BYTES);
  const tag = data.subarray(
    MAGIC_BYTES + SALT_BYTES + IV_BYTES,
    MAGIC_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES,
  );
  const payload = data.subarray(HEADER_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt, format), iv);
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

/**
 * Criptografa apenas o que ainda está em claro (migração de backups legados).
 * Arquivos já cifrados (v1/v2) passam intactos; sem senha configurada, o
 * conteúdo é mantido como está.
 */
export function encryptIfNeeded(data: Buffer): Buffer {
  if (isEncrypted(data)) return data;
  if (loadSettings().drivePassphrase === '') return data;
  return maybeEncrypt(data);
}

export function decryptWith(data: Buffer, passphrase: string): Buffer {
  if (!isEncrypted(data)) return data;
  if (passphrase === '') {
    throw new Error('Este backup está criptografado. Informe a senha de criptografia.');
  }
  try {
    return decryptBuffer(data, passphrase);
  } catch {
    // Mensagem única de propósito: não distingue senha errada de corrupção
    // para não dar oráculo a quem manipula o blob remoto.
    throw new Error('Senha de criptografia incorreta ou backup corrompido.');
  }
}
