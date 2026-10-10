import fs from 'fs';
import { hkdfSync } from 'node:crypto';
import { VaultError } from '@zero/main/vault/errors';
import { seal, unseal, IV_BYTES, MASTER_KEY_BYTES, TAG_BYTES } from '@zero/main/vault/crypto';
import { vaultSession } from '@zero/main/vault/session';

/**
 * Cifra do acervo: a biblioteca e as capas em disco, com a chave que só existe
 * enquanto o cofre está aberto.
 *
 * Formato de cada arquivo (`.enc`), idêntico em todos:
 *
 * ```
 * magic   6 B  "CLIB1"
 * iv     16 B  nonce da operação
 * tag    16 B  tag de autenticação
 * dado    n B  texto cifrado
 * ```
 *
 * A chave de cada arquivo é derivada por HKDF-SHA512 da chave-mestra da
 * sessão, com um `info` por domínio. Duas consequências que valem o desenho:
 *
 * - **Cryptographic Erase**: apagar o `vault.zkv` mata a chave-mestra, e com
 *   ela todo `.enc` vira ruído irrecuperável, sem precisar sobrescrever
 *   gigabytes. É por isso que o acervo não precisa morar dentro do container.
 * - os arquivos não guardam chave, salt nem KDF: sozinhos são bytes inúteis.
 *
 * Módulo puro de criptografia e arquivo: não conhece a biblioteca nem a UI.
 * Quem valida caminhos é o domínio (`library.ts`), nunca este arquivo.
 */

/** Assinatura do formato, para um arquivo de outro app não ser lido como dado. */
export const STORE_MAGIC = 'CLIB1';

/** Derivado da assinatura: os dois não podem divergir. */
const MAGIC_BYTES = STORE_MAGIC.length;

const HEADER_BYTES = MAGIC_BYTES + IV_BYTES + TAG_BYTES;

/** Extensão dos arquivos cifrados do acervo. */
export const STORE_EXTENSION = '.enc';

/** Domínios de derivação: separados para que um compromise de um não valha o outro. */
const LIBRARY_INFO = 'chronos-biblioteca/store/library';
const COVER_INFO = 'chronos-biblioteca/store/cover';

type StoreDomain = 'library' | 'cover';

const INFO_BY_DOMAIN: Record<StoreDomain, string> = {
  library: LIBRARY_INFO,
  cover: COVER_INFO,
};

/**
 * Chave do domínio, derivada da chave-mestra da sessão. O salt do HKDF é
 * fixo e vazio de propósito: quem traz a entropia é a chave-mestra, e o `info`
 * é o que separa os domínios.
 */
function storeKey(domain: StoreDomain): Buffer {
  const masterKey = vaultSession.key();
  if (masterKey === null) throw new VaultError('vaultLocked');
  return Buffer.from(
    hkdfSync('sha512', masterKey, Buffer.alloc(0), INFO_BY_DOMAIN[domain], MASTER_KEY_BYTES),
  );
}

/** Serializa um bloco cifrado no formato `.enc`. */
export function sealStoreFile(domain: StoreDomain, plaintext: Buffer): Buffer {
  const { iv, tag, data } = seal(storeKey(domain), plaintext);
  return Buffer.concat([Buffer.from(STORE_MAGIC, 'ascii'), iv, tag, data]);
}

/**
 * Abre um bloco cifrado. Devolve `null` em qualquer anormalidade: magic
 * errado, tamanho truncado, tag inválida, chave trocada. Nunca devolve texto
 * sob tag que não validou.
 */
export function openStoreFile(domain: StoreDomain, raw: Buffer): Buffer | null {
  if (raw.length < HEADER_BYTES) return null;
  if (raw.toString('ascii', 0, MAGIC_BYTES) !== STORE_MAGIC) return null;
  return unseal(storeKey(domain), {
    iv: raw.subarray(MAGIC_BYTES, MAGIC_BYTES + IV_BYTES),
    tag: raw.subarray(MAGIC_BYTES + IV_BYTES, HEADER_BYTES),
    data: raw.subarray(HEADER_BYTES),
  });
}

/**
 * Lê e decifra um arquivo `.enc` do acervo.
 *
 * Ausente devolve `null` (estado normal de biblioteca vazia). Presente e
 * ilegível lança `libraryTampered`: a diferença importa, porque um
 * `libraryTampered` engolido viraria `[]` e o próximo salvamento gravaria
 * por cima de um acervo que o usuário ainda tem.
 */
export function readStoreFile(file: string, domain: StoreDomain): Buffer | null {
  let raw: Buffer;
  try {
    raw = fs.readFileSync(file);
  } catch {
    return null;
  }
  const plain = openStoreFile(domain, raw);
  if (plain === null) throw new VaultError('libraryTampered');
  return plain;
}

/** Grava um arquivo `.enc` de forma atômica (`.tmp` + `rename`, `0600`). */
export function writeStoreFile(file: string, domain: StoreDomain, plaintext: Buffer): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, sealStoreFile(domain, plaintext), { mode: 0o600 });
  try {
    fs.chmodSync(tmp, 0o600);
  } catch {
    // Melhor esforço: gravar com a permissão mais larga é melhor que não gravar.
  }
  fs.renameSync(tmp, file);
}

/** Nome cifrado de uma capa: `uuid.jpg` vira `uuid.jpg.enc`. */
export function coverFileName(name: string): string {
  return `${name}${STORE_EXTENSION}`;
}

/** Remove o sufixo `.enc`; `null` se o nome não for de um arquivo cifrado. */
export function plainCoverName(name: string): string | null {
  return name.endsWith(STORE_EXTENSION) ? name.slice(0, -STORE_EXTENSION.length) : null;
}
