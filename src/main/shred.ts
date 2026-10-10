import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Sobrescrita segura de arquivo antes da remoção.
 *
 * Primitiva de baixo nível: não conhece o cofre nem a biblioteca, e nenhum
 * caminho de domínio é montado aqui. O chamador entrega **sempre** um caminho
 * já validado (nunca um id ou um nome cru vindo do renderer), porque esta
 * função abre o arquivo para escrita.
 *
 * O que ela garante, e o que não:
 *
 * - garante que o conteúdo antigo não é recuperável por leitura normal do
 *   arquivo depois da remoção;
 * - **não** garante nada em SSD ou em disco com wear leveling: a escrita pode
 *   ir para outro bloco físico e o original ficar no controlador. Nesse caso a
 *   proteção é a cifra (sem a chave o arquivo já é ruído), não a sobrescrita.
 *
 * Por isso o shred é *higiene* onde o arquivo já é cifrado e *controle real*
 * onde o arquivo estava em claro.
 */

/** Passes padrão: aleatório, zero, aleatório. */
export const SHRED_PASSES = 3;

/** Teto aceito, para o chamador não passar valor absurdo por engano. */
const MAX_PASSES = 16;

/** Bloco de escrita: 64 KiB equilibra número de chamadas e uso de memória. */
const CHUNK_BYTES = 64 * 1024;

function boundedPasses(passes: number): number {
  if (!Number.isInteger(passes) || passes < 1) return 1;
  return Math.min(passes, MAX_PASSES);
}

/**
 * Sobrescreve o arquivo inteiro `passes` vezes e o apaga.
 *
 * Devolve `false` sem lançar quando não dá para fazer: arquivo inexistente,
 * symlink no lugar, diretório, permissão negada. A falha de shred **não pode**
 * impedir o resto de uma limpeza, então o chamador trata o `false` como "este
 * arquivo já não atrapalha" e segue.
 */
export function shredFile(file: string, passes: number = SHRED_PASSES): boolean {
  let fd: number | null = null;
  try {
    // `lstat` (e não `stat`) para enxergar o symlink em vez do alvo, e
    // `O_NOFOLLOW` para o `open` não seguir o link se ele aparecer entre os
    // dois: sem ele a sobrescrita cairia no arquivo apontado.
    if (!fs.lstatSync(file).isFile()) return false;

    fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW);
    const size = fs.fstatSync(fd).size;

    for (let pass = 0; pass < boundedPasses(passes); pass += 1) {
      // Alterna e termina em zeros: menos padrão para recuperação heurística.
      writePattern(fd, size, pass % 2 === 0);
    }

    // Sem o `fsync` a sobrescrita pode ficar só no cache de página, e o
    // `unlink` seguinte pode publicar um arquivo cujo conteúdo antigo segue
    // no platter.
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    fs.unlinkSync(file);
    syncDirectory(path.dirname(file));
    return true;
  } catch {
    closeQuietly(fd);
    return false;
  }
}

/** Escreve `size` bytes do início ao fim, com o preenchimento escolhido. */
function writePattern(fd: number, size: number, random: boolean): void {
  let offset = 0;
  while (offset < size) {
    const length = Math.min(CHUNK_BYTES, size - offset);
    const chunk = random ? crypto.randomBytes(length) : Buffer.alloc(length, 0);
    offset += fs.writeSync(fd, chunk, 0, length, offset);
  }
}

/**
 * Sincroniza o diretório pai para que a remoção do nome sobreviva a uma queda
 * no mesmo instante. Falha aqui não invalida a sobrescrita já concluída.
 */
function syncDirectory(dir: string): void {
  let fd: number | null = null;
  try {
    fd = fs.openSync(dir, fs.constants.O_RDONLY);
    fs.fsyncSync(fd);
  } catch {
    // Sistema de arquivos sem `fsync` em diretório: o arquivo já foi
    // sobrescrito e removido, que é o que a chamada promete.
  } finally {
    closeQuietly(fd);
  }
}

function closeQuietly(fd: number | null): void {
  if (fd === null) return;
  try {
    fs.closeSync(fd);
  } catch {
    // Descritor já fechado ou inválido: nada a fazer.
  }
}

/** Contagem do que foi de fato sobrescrito e do que não deu. */
export interface ShredResult {
  shredded: number;
  failed: number;
}

/**
 * Sobrescreve e apaga todo arquivo regular dentro de `dir`, e só então remove
 * a pasta. Diretório inexistente não é falha: `0` e `0`.
 */
export function shredDirectory(dir: string, passes: number = SHRED_PASSES): ShredResult {
  const result: ShredResult = { shredded: 0, failed: 0 };
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return result;
  }
  for (const name of names) {
    if (shredFile(path.join(dir, name), passes)) result.shredded += 1;
    else result.failed += 1;
  }
  try {
    fs.rmdirSync(dir);
  } catch {
    // A pasta não esvaziou (subdiretório, permissão): o conteúdo útil já foi
    // sobrescrito, que é o que a chamada pede.
  }
  return result;
}
