import crypto from 'crypto';
import { currentMessages } from '@zero/main/i18n';
import { loadSettings } from '@zero/main/settings';

const MAGIC = Buffer.from('WTENC3');
const MAGIC_BYTES = 6;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES;

/**
 * Custo do scrypt, sempre explícito (os padrões do Node mudam entre versões):
 * `N=2^17` é o mínimo do OWASP Password Storage Cheat Sheet, ~128 MiB por
 * derivação — 8x o padrão do Node (2^14) e pesado o bastante para inviabilizar
 * força bruta paralela (ASIC/GPU) contra a senha, sem travar o backup manual
 * (típico: <1s por arquivo em desktop).
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.scryptSync(passphrase, salt, 32, {
    N: 131072,
    r: 8,
    p: 1,
    maxmem: 256 * 1024 * 1024,
  });
}

function encryptBuffer(data: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), encrypted]);
}

/** Único formato válido: `WTENC3` (nunca houve release com outro). */
function isCurrentFormat(data: Buffer): boolean {
  return data.subarray(0, MAGIC_BYTES).equals(MAGIC);
}

export function isEncrypted(data: Buffer): boolean {
  return isCurrentFormat(data);
}

function decryptBuffer(data: Buffer, passphrase: string): Buffer {
  const m = currentMessages();
  if (!isCurrentFormat(data)) throw new Error(m.driveErrors.notEncrypted);
  if (data.length < HEADER_BYTES) throw new Error(m.driveErrors.truncated);
  const salt = data.subarray(MAGIC_BYTES, MAGIC_BYTES + SALT_BYTES);
  const iv = data.subarray(MAGIC_BYTES + SALT_BYTES, MAGIC_BYTES + SALT_BYTES + IV_BYTES);
  const tag = data.subarray(
    MAGIC_BYTES + SALT_BYTES + IV_BYTES,
    MAGIC_BYTES + SALT_BYTES + IV_BYTES + TAG_BYTES,
  );
  const payload = data.subarray(HEADER_BYTES);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
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
    throw new Error(currentMessages().driveErrors.definePassphrase);
  }
  return encryptBuffer(data, passphrase);
}

export function decryptWith(data: Buffer, passphrase: string): Buffer {
  const m = currentMessages();
  if (!isEncrypted(data)) return data;
  if (passphrase === '') {
    throw new Error(m.driveErrors.needsPassphrase);
  }
  try {
    return decryptBuffer(data, passphrase);
  } catch {
    // Mensagem única de propósito: não distingue senha errada de corrupção
    // para não dar oráculo a quem manipula o blob remoto.
    throw new Error(m.driveErrors.wrongPassphrase);
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
 * nomes, necessário para atualizar no lugar e para restaurar em outra
 * máquina) e com domínio separado da chave de conteúdo dos arquivos.
 *
 * O custo acompanha o da chave de conteúdo (`N=2^17`): o nome do
 * `library.json` é adivinhável, então um atacante testa senhas candidatas
 * offline pelo HMAC sem decifrar nada — mesma força da cifra.
 */
export function nameKeyFor(passphrase: string): Buffer {
  return crypto.scryptSync(passphrase, 'webtoons-remote-names-v1', 32, {
    N: 131072,
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
  const invalid = new Error(currentMessages().driveErrors.invalidManifest);
  const parsed: unknown = JSON.parse(data.toString('utf-8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw invalid;
  }
  const mapping: Record<string, string> = {};
  for (const remote of Object.keys(parsed)) {
    const local: unknown = Reflect.get(parsed, remote);
    if (remote === '' || typeof local !== 'string' || local === '') {
      throw invalid;
    }
    mapping[remote] = local;
  }
  return mapping;
}
