import type { VaultKdfParams } from '@zero/types/vault';
import type { Sealed } from '@zero/main/vault/crypto';
import { IV_BYTES, SALT_BYTES, TAG_BYTES, kdfParamsInRange } from '@zero/main/vault/crypto';

/**
 * Container binário do cofre (`vault.zkv`): formato fixo, escrito e lido só
 * aqui. Toda leitura é fail-closed: forma inválida, truncamento, parâmetro
 * fora da faixa ou byte a mais no fim devolvem `null` (tratado como
 * adulterado), nunca conteúdo em claro.
 */

export const MAGIC = 'CHRONOS1';
export const VAULT_VERSION = 1;

/** magic(8) + versão(4) + createdAt(8) + kdf(12) + attempts(4) + lockUntil(8) + flags(1). */
const HEADER_BYTES = 45;

/** Chave mestra embrulhada: salt do Argon2id + IV + tag + texto cifrado. */
export interface VaultWrap extends Sealed {
  salt: Buffer;
}

export interface VaultContainer {
  version: number;
  createdAt: number;
  kdf: VaultKdfParams;
  attempts: number;
  lockUntil: number;
  wrap: VaultWrap;
  payload: Sealed;
}

function blockBytes(block: Sealed, includeSalt: boolean): number {
  return (includeSalt ? SALT_BYTES : 0) + IV_BYTES + TAG_BYTES + 4 + block.data.length;
}

/** Serializa o container. Forma inversa exata de `decodeContainer`. */
export function encodeContainer(container: VaultContainer): Buffer {
  const header = Buffer.alloc(HEADER_BYTES);
  header.write(MAGIC, 0, 'ascii');
  header.writeUInt32BE(container.version, 8);
  header.writeBigUInt64BE(BigInt(container.createdAt), 12);
  header.writeUInt32BE(container.kdf.memoryKiB, 20);
  header.writeUInt32BE(container.kdf.iterations, 24);
  header.writeUInt32BE(container.kdf.parallelism, 28);
  header.writeUInt32BE(container.attempts, 32);
  header.writeBigUInt64BE(BigInt(container.lockUntil), 36);
  header.writeUInt8(0, 44);

  const wrapSize = blockBytes(container.wrap, true);
  const payloadSize = blockBytes(container.payload, false);
  const out = Buffer.alloc(HEADER_BYTES + wrapSize + payloadSize);

  header.copy(out, 0);
  let offset = HEADER_BYTES;

  container.wrap.salt.copy(out, offset);
  offset += SALT_BYTES;
  container.wrap.iv.copy(out, offset);
  offset += IV_BYTES;
  container.wrap.tag.copy(out, offset);
  offset += TAG_BYTES;
  out.writeUInt32BE(container.wrap.data.length, offset);
  offset += 4;
  container.wrap.data.copy(out, offset);
  offset += container.wrap.data.length;

  container.payload.iv.copy(out, offset);
  offset += IV_BYTES;
  container.payload.tag.copy(out, offset);
  offset += TAG_BYTES;
  out.writeUInt32BE(container.payload.data.length, offset);
  offset += 4;
  container.payload.data.copy(out, offset);

  return out;
}

function readSealed(
  buffer: Buffer,
  offset: number,
  includeSalt: boolean,
): { block: Sealed; salt: Buffer | null; next: number } | null {
  let cursor = offset;
  let salt: Buffer | null = null;
  if (includeSalt) {
    if (cursor + SALT_BYTES > buffer.length) return null;
    salt = buffer.subarray(cursor, cursor + SALT_BYTES);
    cursor += SALT_BYTES;
  }
  if (cursor + IV_BYTES + TAG_BYTES + 4 > buffer.length) return null;
  const iv = buffer.subarray(cursor, cursor + IV_BYTES);
  cursor += IV_BYTES;
  const tag = buffer.subarray(cursor, cursor + TAG_BYTES);
  cursor += TAG_BYTES;
  const length = buffer.readUInt32BE(cursor);
  cursor += 4;
  if (cursor + length > buffer.length) return null;
  const data = buffer.subarray(cursor, cursor + length);
  return { block: { iv, tag, data }, salt, next: cursor + length };
}

/** Lê o container; qualquer anormalidade devolve `null` (fail-closed). */
export function decodeContainer(buffer: Buffer): VaultContainer | null {
  if (buffer.length < HEADER_BYTES) return null;
  if (buffer.toString('ascii', 0, 8) !== MAGIC) return null;

  const version = buffer.readUInt32BE(8);
  if (version !== VAULT_VERSION) return null;

  const createdAtBig = buffer.readBigUInt64BE(12);
  const lockUntilBig = buffer.readBigUInt64BE(36);
  if (createdAtBig > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  if (lockUntilBig > BigInt(Number.MAX_SAFE_INTEGER)) return null;

  const kdf: VaultKdfParams = {
    memoryKiB: buffer.readUInt32BE(20),
    iterations: buffer.readUInt32BE(24),
    parallelism: buffer.readUInt32BE(28),
  };
  if (!kdfParamsInRange(kdf)) return null;

  const attempts = buffer.readUInt32BE(32);
  if (attempts > 1_000_000) return null;

  const wrapRead = readSealed(buffer, HEADER_BYTES, true);
  if (wrapRead === null) return null;
  const salt = wrapRead.salt;
  if (salt === null) return null;
  const payloadRead = readSealed(buffer, wrapRead.next, false);
  if (payloadRead === null) return null;
  if (payloadRead.next !== buffer.length) return null;

  return {
    version,
    createdAt: Number(createdAtBig),
    kdf,
    attempts,
    lockUntil: Number(lockUntilBig),
    wrap: { salt, ...wrapRead.block },
    payload: payloadRead.block,
  };
}
