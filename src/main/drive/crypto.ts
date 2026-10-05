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
  return encryptWith(data, passphrase);
}

/** Cifra com senha explícita (a senha vazia é recusada em vez de ignorada). */
export function encryptWith(data: Buffer, passphrase: string): Buffer {
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

/**
 * Nomes remotos opacos (ver `backup.ts`).
 *
 * A pasta do app no Dropbox já é privada por aplicativo, mas nomes como
 * `library.json` dizem o que cada arquivo é. Por isso o upload usa nomes
 * opacos e um manifesto cifrado `{ nomeRemoto: nomeLocal }`.
 */

/** Nome local do manifesto dentro do backup. */
export const MANIFEST_FILE = 'manifest.json';

/**
 * Chave que opacifica nomes remotos. Determinística (mesma senha, mesmos
 * nomes — necessário para atualizar no lugar e para restaurar em outra
 * máquina) e com domínio separado da chave de conteúdo dos arquivos.
 */
export function nameKeyFor(passphrase: string): Buffer {
  return crypto.scryptSync(passphrase, 'webtoons-remote-names-v1', 32, {
    N: 65536,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}

/** Nome remoto opaco e estável para um arquivo local (HMAC-SHA256 em hexa). */
export function remoteName(localName: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(localName, 'utf-8').digest('hex');
}

/** Serializa o manifesto `{ nomeRemoto: nomeLocal }` (cifrar antes de subir). */
export function buildManifest(mapping: Record<string, string>): Buffer {
  return Buffer.from(JSON.stringify(mapping), 'utf-8');
}

/** Valida o manifesto decifrado; qualquer forma estranha é rejeitada. */
export function parseManifest(data: Buffer): Record<string, string> {
  const parsed: unknown = JSON.parse(data.toString('utf-8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Manifesto do backup inválido.');
  }
  const mapping: Record<string, string> = {};
  for (const remote of Object.keys(parsed)) {
    const local: unknown = Reflect.get(parsed, remote);
    if (remote === '' || typeof local !== 'string' || local === '') {
      throw new Error('Manifesto do backup inválido.');
    }
    mapping[remote] = local;
  }
  return mapping;
}
