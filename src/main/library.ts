import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Work } from '@zero/types';
import { currentMessages } from '@zero/main/i18n';
import { cacheDir, configDir, coversDir, dataDir, userDataDir } from '@zero/main/paths';
import { shredDirectory, shredFile } from '@zero/main/shred';
import {
  coverFileName,
  plainCoverName,
  readStoreFile,
  writeStoreFile,
  STORE_EXTENSION,
} from '@zero/main/store-crypto';
import { VaultError } from '@zero/main/vault/errors';
import { vaultSession } from '@zero/main/vault/session';

export { cacheDir, configDir, coversDir, dataDir, userDataDir };

const RATING_CLAMPS = { min: 0 } as const;

/**
 * Acervo do usuário: obras e capas, **cifrados** com a chave do cofre.
 *
 * Nada aqui existe em claro no disco: a biblioteca é um `library.enc` e cada
 * capa é um `<uuid>.<ext>.enc`, ambos em AES-256-GCM com chave derivada da
 * chave-mestra da sessão (`src/main/store-crypto.ts`). Consequências diretas:
 *
 * - ler e gravar **exige cofre aberto**; sem chave, toda entrada lança
 *   `vaultLocked` antes de tocar em disco;
 * - apagar o `vault.zkv` (destruição do cofre) deixa todo `.enc`
 *   irrecuperável sem sobrescrever nada, porque a chave morre junto;
 * - arquivo cifrado ilegível é erro (`libraryTampered`), **nunca** lista vazia:
 *   devolver `[]` faria o próximo salvamento gravar por cima do acervo.
 *
 * A escrita é atômica (`.tmp` + `rename`) em todos os caminhos, como já era.
 */

/**
 * Portão único do acervo. Sem chave na sessão não há como decifrar, e o que
 * faria sem esta guarda seria devolver `[]` e deixar o próximo salvamento
 * sobrescrever um acervo que existe.
 */
function requireVault(): void {
  if (!vaultSession.isUnlocked()) throw new VaultError('vaultLocked');
}

/** Arquivo da biblioteca cifrada. */
function libraryPath(): string {
  return path.join(dataDir(), `library${STORE_EXTENSION}`);
}

/** `coversDir()` já cria a própria pasta; a do acervo precisa do mesmo cuidado. */
function ensureDataDir(): void {
  fs.mkdirSync(dataDir(), { recursive: true });
}

/** `true` quando existe acervo gravado em disco (presença, não legibilidade). */
export function libraryExists(): boolean {
  return fs.existsSync(libraryPath());
}

function parseLibrary(raw: Buffer): Work[] {
  try {
    const parsed: unknown = JSON.parse(raw.toString('utf-8'));
    return Array.isArray(parsed) ? (parsed as Work[]) : [];
  } catch {
    return [];
  }
}

/**
 * Lê a biblioteca decifrada. Sem arquivo, devolve lista vazia; com arquivo
 * ilegível, propaga `libraryTampered` (falha fechada, sem apagar nada).
 */
export function loadLibrary(): Work[] {
  requireVault();
  const raw = readStoreFile(libraryPath(), 'library');
  if (raw === null) return [];
  return parseLibrary(raw);
}

export function saveLibrary(works: Work[]): Work[] {
  requireVault();
  ensureDataDir();
  writeStoreFile(libraryPath(), 'library', Buffer.from(JSON.stringify(works, null, 2), 'utf-8'));
  return works;
}

export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Id de obra aceito na IPC e restaurado da nuvem: UUID gerado pelo app ou um
 * identificador curto legível sem separadores de caminho. Rejeitar `..`, `/`
 * e `\` aqui é defesa em profundidade (classe CVE-2026-21589): nenhum id vira
 * caminho de arquivo hoje, mas a regra garante que isso continue verdadeiro.
 */
const WORK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidWorkId(id: string): boolean {
  return WORK_ID_PATTERN.test(id);
}

export function upsertWork(
  input: Omit<Work, 'createdAt' | 'updatedAt'> & Partial<Pick<Work, 'createdAt' | 'updatedAt'>>,
): Work[] {
  if (input.id !== '' && !isValidWorkId(input.id)) {
    throw new Error(currentMessages().libraryErrors.invalidId);
  }
  const works = loadLibrary();
  const now = new Date().toISOString();
  const status = input.status;
  const progress = clampProgress(input.progress);

  const index = works.findIndex((w) => w.id === input.id);
  const previous = index === -1 ? undefined : works[index];

  const updated: Work = {
    id: input.id !== '' ? input.id : newId(),
    title: input.title,
    synopsis: input.synopsis,
    type: input.type,
    status,
    progress,
    marker: input.marker,
    coverFile: input.coverFile,
    category: input.category,
    createdAt: previous?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
  };

  if (previous !== undefined) {
    works[index] = updated;
    if (
      previous.coverFile !== undefined &&
      previous.coverFile !== '' &&
      previous.coverFile !== updated.coverFile
    ) {
      removeCoverFile(previous.coverFile, works);
    }
  } else {
    works.push(updated);
  }

  saveLibrary(works);
  cleanupOrphanCovers(works);
  return works;
}

export function deleteWork(id: string): Work[] {
  if (!isValidWorkId(id)) {
    throw new Error(currentMessages().libraryErrors.invalidId);
  }
  const works = loadLibrary();
  const target = works.find((w) => w.id === id);
  const coverFile = target?.coverFile;
  if (coverFile !== undefined && coverFile !== '') removeCoverFile(coverFile, works);
  const next = works.filter((w) => w.id !== id);
  saveLibrary(next);
  cleanupOrphanCovers(next);
  return next;
}

const COVER_EXT_WHITELIST = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp']);

/**
 * Copia a capa escolhida para a pasta do acervo, **cifrada**. Devolve o nome
 * em claro (`<id>.<ext>`), que é o que `Work.coverFile` guarda; em disco o
 * arquivo é `<id>.<ext>.enc`.
 */
export function importCover(sourcePath: string, preferredId?: string): string | null {
  requireVault();
  try {
    if (!fs.existsSync(sourcePath)) return null;
    const ext = path.extname(sourcePath).toLowerCase();
    const safeExt = COVER_EXT_WHITELIST.has(ext) ? ext : '.png';
    const baseId = preferredId !== undefined && isValidWorkId(preferredId) ? preferredId : newId();
    const name = `${baseId}${safeExt}`;
    writeStoreFile(coverPath(name), 'cover', fs.readFileSync(sourcePath));
    return name;
  } catch {
    return null;
  }
}

/** Grava uma capa em claro (restauração do backup na nuvem). */
export function writeCoverFile(name: string, plain: Buffer): void {
  requireVault();
  writeStoreFile(coverPath(name), 'cover', plain);
}

/** Caminho cifrado de uma capa. O nome chega validado pelos chamadores. */
function coverPath(name: string): string {
  return path.join(coversDir(), path.basename(coverFileName(name)));
}

/**
 * Apaga uma capa sobrescrevendo antes. `basename` é a barreira de path
 * traversal (classe CVE-2026-21589) e vem antes de qualquer escrita.
 */
function removeCoverFile(fileName: string, works: Work[]): void {
  if (works.some((w) => w.coverFile === fileName)) return;
  shredFile(path.join(coversDir(), path.basename(coverFileName(fileName))));
}

/**
 * Apaga toda capa que a biblioteca não referencia mais: órfão `.enc` de
 * edição, troca ou restauração **e** qualquer arquivo que não seja um `.enc`
 * válido (capa em claro de versão anterior, que é dado sensível e por isso
 * também é sobrescrito). Roda a cada salvamento, então shred aqui é o custo
 * que o roadmap aceitou pagar para não deixar capa legível em disco.
 */
function cleanupOrphanCovers(works: Work[]): void {
  try {
    const used = new Set(
      works
        .map((w) => w.coverFile)
        .filter((file): file is string => file !== undefined && file !== ''),
    );
    for (const file of fs.readdirSync(coversDir())) {
      const name = plainCoverName(file);
      if (name !== null && used.has(name)) continue;
      shredFile(path.join(coversDir(), path.basename(file)));
    }
  } catch {
    // pasta pode não existir ainda
  }
}

/** Nomes das capas em claro, na forma que `Work.coverFile` usa. */
export function listCoverFiles(): string[] {
  try {
    const names: string[] = [];
    for (const file of fs.readdirSync(coversDir())) {
      const name = plainCoverName(file);
      if (name !== null && !name.startsWith('.')) names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}

/** Decifra a capa para exibir; `null` se ausente, ilegível ou sem chave. */
export function readCoverBuffer(fileName: string): Buffer | null {
  const plain = plainCoverName(path.basename(fileName)) ?? path.basename(fileName);
  const full = path.join(coversDir(), path.basename(coverFileName(plain)));
  if (!fs.existsSync(full)) return null;
  try {
    return readStoreFile(full, 'cover');
  } catch {
    // Capa ilegível ou cofre fechado: a imagem simplesmente não aparece.
    return null;
  }
}

export function restoreLibrary(works: Work[]): Work[] {
  requireVault();
  const sanitized = works.map((w) => ({
    ...w,
    // Id vindo da nuvem passa pela mesma régua da IPC; fora da regra, novo id.
    id: typeof w.id === 'string' && isValidWorkId(w.id) ? w.id : newId(),
    progress: clampProgress(w.progress),
    createdAt: w.createdAt !== '' ? w.createdAt : new Date().toISOString(),
    updatedAt: w.updatedAt !== '' ? w.updatedAt : new Date().toISOString(),
  }));
  saveLibrary(sanitized);
  cleanupOrphanCovers(sanitized);
  return sanitized;
}

/**
 * Apaga o acervo inteiro sobrescrevendo: a biblioteca, a pasta de capas e o
 * que sobrou. Exige cofre aberto (sem chave não há o que sobrescrever com
 * segurança).
 */
export function resetLibrary(): void {
  requireVault();
  shredFile(libraryPath());
  shredDirectory(coversDir());
  coversDir();
}

export interface BackupFile {
  name: string;
  buffer: Buffer;
  mime: string;
}

/**
 * Arquivos do acervo **em claro** para o backup: quem chama já exige cofre
 * aberto, e a cifragem da nuvem é outra (senha de backup, scrypt). Devolve
 * `null` quando não há acervo gravado (instalação nova).
 */
export function backupFiles(): BackupFile[] | null {
  if (!libraryExists()) return null;
  const files: BackupFile[] = [];
  const library = loadLibrary();
  files.push({
    name: 'library.json',
    buffer: Buffer.from(JSON.stringify(library, null, 2), 'utf-8'),
    mime: 'application/json',
  });
  for (const cover of listCoverFiles()) {
    const buffer = readCoverBuffer(cover);
    if (buffer !== null) files.push({ name: cover, buffer, mime: mimeFor(cover) });
  }
  return files;
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(RATING_CLAMPS.min, Math.round(value));
}

export function mimeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'application/octet-stream';
  }
}

/** Sobrescreve e apaga a pasta de capas, deixando a pasta pronta de novo. */
export function shredCovers(): void {
  shredDirectory(coversDir());
  coversDir();
}
