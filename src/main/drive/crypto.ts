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
 * derivação, 8x o padrão do Node (2^14) e pesado o bastante para inviabilizar
 * força bruta paralela (ASIC/GPU) contra a senha, sem travar o backup manual
 * (típico: <1s por arquivo em desktop).
 */
function deriveKey(passphrase: string, salt: Buffer | string): Buffer {
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

/**
 * Falha de senha de criptografia (errada ou blob corrompido).
 *
 * Classe própria (e não só a mensagem) para `restoreNow` distinguir tentativa
 * de senha de erro de rede/serviço e contar na trava exponencial, sem depender
 * do texto localizado.
 */
export class PassphraseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PassphraseError';
  }
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
    throw new PassphraseError(m.driveErrors.wrongPassphrase);
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
 * Salt fixo da chave que **localiza** o manifesto.
 *
 * Precisa ser estável entre máquinas: sem ler o manifesto não há como descobrir
 * o salt aleatório dos nomes de conteúdo, e o manifesto precisa ser encontrável
 * justamente para isso (peixe e balde). Por isso só o locator é determinístico;
 * os nomes de conteúdo usam `nameKeyFor` com o salt que vem do manifesto.
 */
const MANIFEST_KEY_SALT = 'webtoons-remote-names-v1';

/**
 * Chave que localiza o manifesto cifrado. Determinística (mesma senha, mesmo
 * nome em qualquer máquina) e com domínio separado da chave de conteúdo.
 */
export function manifestKeyFor(passphrase: string): Buffer {
  return deriveKey(passphrase, MANIFEST_KEY_SALT);
}

/**
 * Chave que opacifica nomes remotos de conteúdo. O salt vem do manifesto
 * cifrado (aleatório por cadeia de backup), então tabelas pré-computadas com o
 * salt fixo não servem contra um backup real. O custo acompanha o da chave de
 * conteúdo (`N=2^17`): o nome do `library.json` é adivinhável, então um
 * atacante testa senhas candidatas offline pelo HMAC sem decifrar nada, mesma
 * força da cifra.
 */
export function nameKeyFor(passphrase: string, salt: Buffer): Buffer {
  return deriveKey(passphrase, salt);
}

/** Salt novo (16 bytes aleatórios) para uma cadeia de backup sem manifesto v2. */
export function newNameSalt(): Buffer {
  return crypto.randomBytes(SALT_BYTES);
}

/** Nome remoto opaco e estável para um arquivo local (HMAC-SHA256 em hexa). */
export function remoteName(localName: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(localName, 'utf-8').digest('hex');
}

/** Manifesto decifrado: mapeamento + salt da chave de nomes (nulo no formato v1). */
export interface Manifest {
  files: Record<string, string>;
  nameSalt: Buffer | null;
}

/** Versão do formato de manifesto que embute o salt da chave de nomes. */
const MANIFEST_V2 = 2;

/**
 * Serializa o manifesto `{ nomeRemoto: nomeLocal }` com o salt da chave de
 * nomes embutido (cifrar antes de subir). O `v2` é o formato atual; backups
 * antigos (v1, sem salt) continuam legíveis via `parseManifest`.
 */
export function buildManifest(mapping: Record<string, string>, nameSalt: Buffer): Buffer {
  const payload = { v: MANIFEST_V2, salt: nameSalt.toString('base64'), files: mapping };
  return Buffer.from(JSON.stringify(payload), 'utf-8');
}

/** Valida o mapa nomeRemoto → nomeLocal; qualquer forma estranha é rejeitada. */
function parseFiles(value: unknown, invalid: Error): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid;
  const mapping: Record<string, string> = {};
  for (const remote of Object.keys(value)) {
    const local: unknown = Reflect.get(value, remote);
    if (remote === '' || typeof local !== 'string' || local === '') throw invalid;
    mapping[remote] = local;
  }
  return mapping;
}

/** Lê um salt base64 de 16 bytes; qualquer outra coisa é manifesto inválido. */
function parseNameSalt(value: unknown, invalid: Error): Buffer {
  if (typeof value !== 'string') throw invalid;
  const salt = Buffer.from(value, 'base64');
  if (salt.length !== SALT_BYTES) throw invalid;
  return salt;
}

/**
 * Valida o manifesto decifrado; qualquer forma estranha é rejeitada.
 *
 * - **v2** (`{ v, salt, files }`): formato atual, com o salt da chave de nomes.
 * - **v1** (mapa puro): backups antigos, legados sem salt próprio (`nameSalt`
 *   fica `null`; o próximo backup sorteia um e migra para v2).
 */
export function parseManifest(data: Buffer): Manifest {
  const invalid = new Error(currentMessages().driveErrors.invalidManifest);
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.toString('utf-8'));
  } catch {
    throw invalid;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw invalid;
  }
  const version: unknown = 'v' in parsed ? Reflect.get(parsed, 'v') : undefined;
  if (version !== undefined) {
    if (version !== MANIFEST_V2) throw invalid;
    const salt: unknown = 'salt' in parsed ? Reflect.get(parsed, 'salt') : undefined;
    const files: unknown = 'files' in parsed ? Reflect.get(parsed, 'files') : undefined;
    return {
      files: parseFiles(files, invalid),
      nameSalt: parseNameSalt(salt, invalid),
    };
  }
  return { files: parseFiles(parsed, invalid), nameSalt: null };
}
