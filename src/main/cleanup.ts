import fs from 'fs';
import path from 'path';
import { cacheDir, configDir, coversDir, dataDir } from '@zero/main/paths';
import { STORE_EXTENSION } from '@zero/main/store-crypto';
import { shredFile } from '@zero/main/shred';

/**
 * Varreduras de disco que rodam no boot, antes de a interface responder.
 *
 * Duas coisas moram aqui, e as duas são "sobra que ninguém pediu para
 * conservar":
 *
 * 1. **Legado em claro**: até a 1.7 o app guardava credencial em claro em
 *    `~/.config` (`settings.json` com `enc:`, `dropbox-tokens.json` e um
 *    cofre antigo em `.vault`). Desde a 1.8 esses arquivos eram ignorados sem
 *    ser apagados, então quem migrou ficou com senha de backup e token antigos
 *    no disco, indefinidamente.
 * 2. **Temporários órfãos**: um `.tmp` de escrita interrompida não é coberto
 *    por nenhuma limpeza, porque o app só conhece os nomes finais.
 *
 * Garantias de propósito, para que a varredura não vire risco:
 *
 * - o legado é verificado **por existência**; o conteúdo nunca é lido, porque
 *   um segredo não precisa entrar na memória para ser apagado;
 * - a lista é **fechada**: `library*`, `covers/`, o `settings.json` vivo e o
 *   cofre atual nunca são tocados.
 */

/** Arquivos legados em `~/.config/chronos-biblioteca`, com o nome exato. */
const LEGACY_FILES = ['dropbox-tokens.json', 'drive-tokens.json'] as const;

/** Pasta do cofre antigo, dentro de `~/.config/chronos-biblioteca`. */
const LEGACY_VAULT_DIR = '.vault';

/**
 * Temporário mais novo que isto é deixado intacto: pode ser de uma escrita em
 * curso no momento da varredura.
 */
export const STALE_TMP_MS = 60 * 60_000;

/** Contagem do que foi sobrescrito e do que sobrou (sem dado do usuário). */
export interface SweepResult {
  shredded: number;
  failed: number;
}

/**
 * Apaga os restos legados em claro. Idempotente e silenciosa: não encontrar
 * nenhum não é erro.
 */
export function sweepLegacySecrets(): SweepResult {
  const result: SweepResult = { shredded: 0, failed: 0 };
  const config = configDir();

  const legacyVault = path.join(config, LEGACY_VAULT_DIR);
  if (fs.existsSync(legacyVault)) {
    try {
      for (const entry of fs.readdirSync(legacyVault)) {
        const full = path.join(legacyVault, path.basename(entry));
        if (!isPlainFile(full)) continue;
        count(shredFile(full), result);
      }
    } catch {
      result.failed += 1;
    }
    try {
      fs.rmdirSync(legacyVault);
    } catch {
      // Pasta não vazia ou sem permissão: os arquivos já foram sobrescritos.
    }
  }

  for (const name of LEGACY_FILES) {
    const full = path.join(config, path.basename(name));
    if (!fs.existsSync(full)) continue;
    count(shredFile(full), result);
  }

  // `settings.json` com `enc:` guardava a chave do backup em claro. O arquivo
  // atual só tem o idioma e é reescrito no próximo salvamento, então só se
  // apaga quando o campo legado está presente: um `settings.json` vivo não
  // pode ser removido.
  if (hasLegacyEncryptionField(path.join(config, 'settings.json'))) {
    count(shredFile(path.join(config, 'settings.json')), result);
  }

  return result;
}

/**
 * Sobrescreve o acervo que ficou **em claro** de versões anteriores: o
 * `library.json` e as capas sem o sufixo `.enc`.
 *
 * Sem isso, quem atualizasse para a 1.9 continuaria com títulos, sinopses e
 * progressos legíveis em `~/.local/share`, enquanto o app já anuncia que o
 * acervo é cifrado. Só o que **não** é `.enc` é apagado: o acervo cifrado de
 * hoje nunca é tocado aqui.
 */
export function sweepPlaintextLibrary(): SweepResult {
  const result: SweepResult = { shredded: 0, failed: 0 };
  const data = dataDir();

  const plaintext = path.join(data, 'library.json');
  if (fs.existsSync(plaintext)) count(shredFile(plaintext), result);

  let covers: string[];
  try {
    covers = fs.readdirSync(coversDir());
  } catch {
    return result;
  }
  for (const name of covers) {
    if (name.endsWith(STORE_EXTENSION)) continue;
    const full = path.join(coversDir(), path.basename(name));
    if (!isPlainFile(full)) continue;
    count(shredFile(full), result);
  }
  return result;
}

/**
 * Sobrescreve `.tmp` órfãos das pastas do app e do cofre. O `.enc` e o
 * `vault.zkv` **não** entram aqui: são apagados pelo próprio domínio, na
 * operação que os substitui.
 */
export function sweepStaleTempFiles(vaultDir: string, maxAgeMs = STALE_TMP_MS): SweepResult {
  const result: SweepResult = { shredded: 0, failed: 0 };
  const now = Date.now();
  for (const dir of [dataDir(), configDir(), cacheDir(), vaultDir]) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.tmp')) continue;
      const full = path.join(dir, path.basename(entry.name));
      try {
        if (now - fs.statSync(full).mtimeMs < maxAgeMs) continue;
      } catch {
        continue;
      }
      count(shredFile(full), result);
    }
  }
  return result;
}

/** `true` quando o arquivo tem o campo `enc:` do legado (busca por padrão). */
function hasLegacyEncryptionField(file: string): boolean {
  try {
    // Padrão em vez de JSON.parse: arquivo corrompido não pode virar exceção,
    // e a chave é o que importa, não o formato do valor.
    return /"enc"\s*:/.test(fs.readFileSync(file, 'utf-8'));
  } catch {
    return false;
  }
}

function isPlainFile(file: string): boolean {
  try {
    return fs.lstatSync(file).isFile();
  } catch {
    return false;
  }
}

function count(shredded: boolean, result: SweepResult): void {
  if (shredded) result.shredded += 1;
  else result.failed += 1;
}

/**
 * Roda as três varreduras e registra o resultado.
 *
 * Fica aqui, e não no boot do `index.ts`, para que o módulo seja dono do seu
 * próprio log e o `initApp` não ganhe um bloco de manutenção de disco. Nunca
 * lança: uma falha aqui só significa que a limpeza não aconteceu agora, e
 * impedir o app de abrir por causa disso seria pior do que o resíduo.
 */
export function runDiskCleanup(vaultDir: string): void {
  try {
    const legacy = sweepLegacySecrets();
    const plain = sweepPlaintextLibrary();
    const temp = sweepStaleTempFiles(vaultDir);
    const shredded = legacy.shredded + plain.shredded + temp.shredded;
    const failed = legacy.failed + plain.failed + temp.failed;
    if (shredded > 0 || failed > 0) {
      // Sem caminho completo no log: ele revelaria a estrutura do home.
      console.warn(`Varredura de disco: ${shredded} arquivo(s) removido(s), ${failed} com falha.`);
    }
  } catch (error) {
    console.warn('Falha na varredura de disco:', error);
  }
}
