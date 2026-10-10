import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { argon2id } from 'hash-wasm';
import type { VaultKdfParams } from '@zero/types/vault';

/**
 * Primitivas do cofre: Argon2id (hash-wasm), AES-256-GCM e HKDF-SHA512.
 * Módulo puro de criptografia: não conhece arquivo, sessão nem UI.
 */

/** Perfil de custo usado na criação de um cofre novo. */
export const KDF_DEFAULTS: VaultKdfParams = { memoryKiB: 131_072, iterations: 3, parallelism: 4 };

/**
 * Faixa aceita na leitura. Existe para um container adulterado não conseguir
 * exigir memória ou CPU ilimitadas (fora da faixa o arquivo é adulterado).
 */
export const KDF_LIMITS = {
  memoryKiB: { min: 16_384, max: 1_048_576 },
  iterations: { min: 1, max: 8 },
  parallelism: { min: 1, max: 8 },
} as const;

export const MASTER_KEY_BYTES = 32;
export const SALT_BYTES = 16;
export const IV_BYTES = 16;
export const TAG_BYTES = 16;

/** Bloco cifrado: IV e tag de autenticação de 128 bits + texto cifrado. */
export interface Sealed {
  iv: Buffer;
  tag: Buffer;
  data: Buffer;
}

/** Contexto de derivação da chave de dados (separação de domínio da mestra). */
const DATA_KEY_INFO = 'cronologia/vault/data';

/** Fragmentos que tornam a senha mestra previsível (comparados em minúsculas). */
const COMMON_FRAGMENTS = [
  'password',
  'senha',
  'chronos',
  'cronologia',
  'biblioteca',
  'dropbox',
  '123456',
  'qwerty',
  'letmein',
  'admin',
] as const;

export function kdfParamsInRange(params: VaultKdfParams): boolean {
  return (
    params.memoryKiB >= KDF_LIMITS.memoryKiB.min &&
    params.memoryKiB <= KDF_LIMITS.memoryKiB.max &&
    params.iterations >= KDF_LIMITS.iterations.min &&
    params.iterations <= KDF_LIMITS.iterations.max &&
    params.parallelism >= KDF_LIMITS.parallelism.min &&
    params.parallelism <= KDF_LIMITS.parallelism.max
  );
}

/** Deriva a KEK (32 bytes) da senha mestra com Argon2id. */
export async function deriveKek(
  password: string,
  salt: Buffer,
  params: VaultKdfParams,
): Promise<Buffer> {
  const hex = await argon2id({
    password,
    salt,
    parallelism: params.parallelism,
    iterations: params.iterations,
    memorySize: params.memoryKiB,
    hashLength: MASTER_KEY_BYTES,
    outputType: 'hex',
  });
  return Buffer.from(hex, 'hex');
}

export function newSalt(): Buffer {
  return randomBytes(SALT_BYTES);
}

export function newMasterKey(): Buffer {
  return randomBytes(MASTER_KEY_BYTES);
}

/** Cifra `plaintext` com AES-256-GCM (IV de 128 bits por operação). */
export function seal(key: Buffer, plaintext: Buffer): Sealed {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), data };
}

/**
 * Decifra o bloco. Qualquer falha (chave errada, byte adulterado) devolve
 * `null`: leitura fail-closed, nunca texto com tag inválida.
 */
export function unseal(key: Buffer, sealed: Sealed): Buffer | null {
  if (sealed.iv.length !== IV_BYTES || sealed.tag.length !== TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, sealed.iv);
    decipher.setAuthTag(sealed.tag);
    return Buffer.concat([decipher.update(sealed.data), decipher.final()]);
  } catch {
    return null;
  }
}

/** Chave de dados do payload, derivada da mestra por HKDF-SHA512. */
export function deriveDataKey(masterKey: Buffer, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha512', masterKey, salt, DATA_KEY_INFO, MASTER_KEY_BYTES));
}

export type PasswordProblem = 'short' | 'trivial';

function isAllSame(password: string): boolean {
  return /^(.)\1*$/u.test(password);
}

/** Sequência de ±1 cobrindo a senha inteira (`123456789012`, `abcdefghijk`). */
function isSequence(password: string): boolean {
  if (password.length < 6) return false;
  const step = password.charCodeAt(1) - password.charCodeAt(0);
  if (step !== 1 && step !== -1) return false;
  for (let index = 1; index < password.length; index += 1) {
    if (password.charCodeAt(index) - password.charCodeAt(index - 1) !== step) return false;
  }
  return true;
}

/** Bloco curto repetido até o fim (`121212121212`, `abcabcabcabc`). */
function isRepeatedBlock(password: string): boolean {
  const half = Math.floor(password.length / 2);
  for (let size = 1; size <= half; size += 1) {
    const block = password.slice(0, size);
    if (block.repeat(Math.ceil(password.length / size)).startsWith(password)) {
      return true;
    }
  }
  return false;
}

/** Regra de força da senha mestra: tamanho mínimo + ausência de padrão óbvio. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < 12) return 'short';
  const lower = password.toLowerCase();
  if (COMMON_FRAGMENTS.some((fragment) => lower.includes(fragment))) return 'trivial';
  if (isAllSame(password) || isSequence(password) || isRepeatedBlock(password)) return 'trivial';
  return null;
}
