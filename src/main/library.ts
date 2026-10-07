import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Work } from '@zero/types';
import { currentMessages } from '@zero/main/i18n';
import { writeJsonAtomic } from '@zero/main/jsonfile';
import { cacheDir, configDir, coversDir, dataDir, userDataDir } from '@zero/main/paths';

export { cacheDir, configDir, coversDir, dataDir, userDataDir };

const RATING_CLAMPS = { min: 0 } as const;

function libraryPath(): string {
  return path.join(dataDir(), 'library.json');
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  writeJsonAtomic(file, data);
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(RATING_CLAMPS.min, Math.round(value));
}

export function loadLibrary(): Work[] {
  const works = readJson<Work[]>(libraryPath(), []);
  if (!Array.isArray(works)) return [];
  return works;
}

export function saveLibrary(works: Work[]): Work[] {
  writeJson(libraryPath(), works);
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

export function importCover(sourcePath: string, preferredId?: string): string | null {
  try {
    if (!fs.existsSync(sourcePath)) return null;
    const ext = path.extname(sourcePath).toLowerCase();
    const safeExt = COVER_EXT_WHITELIST.has(ext) ? ext : '.png';
    const baseId = preferredId !== undefined && isValidWorkId(preferredId) ? preferredId : newId();
    const name = `${baseId}${safeExt}`;
    const destination = path.join(coversDir(), name);
    fs.copyFileSync(sourcePath, destination);
    return name;
  } catch {
    return null;
  }
}

function removeCoverFile(fileName: string, works: Work[]): void {
  const stillUsed = works.some((w) => w.coverFile === fileName);
  if (stillUsed) return;
  const full = path.join(coversDir(), path.basename(fileName));
  fs.promises.unlink(full).catch(() => undefined);
}

function cleanupOrphanCovers(works: Work[]): void {
  try {
    const used = new Set(
      works
        .map((w) => w.coverFile)
        .filter((file): file is string => file !== undefined && file !== ''),
    );
    for (const file of fs.readdirSync(coversDir())) {
      if (!used.has(file)) {
        fs.promises.unlink(path.join(coversDir(), file)).catch(() => undefined);
      }
    }
  } catch {
    // pasta pode não existir ainda
  }
}

export function listCoverFiles(): string[] {
  try {
    return fs.readdirSync(coversDir()).filter((f) => !f.startsWith('.'));
  } catch {
    return [];
  }
}

export function readCoverBuffer(fileName: string): Buffer | null {
  const full = path.join(coversDir(), path.basename(fileName));
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}

export function restoreLibrary(works: Work[]): Work[] {
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

export interface BackupFile {
  name: string;
  buffer: Buffer;
  mime: string;
}

/** Retorna `null` quando a base local ainda não existe (instalação nova). */
export function backupFiles(): BackupFile[] | null {
  if (!fs.existsSync(libraryPath())) return null;
  const files: BackupFile[] = [];
  const library = fs.readFileSync(libraryPath());
  files.push({ name: 'library.json', buffer: library, mime: 'application/json' });
  for (const cover of listCoverFiles()) {
    const buffer = readCoverBuffer(cover);
    if (buffer !== null) files.push({ name: cover, buffer, mime: mimeFor(cover) });
  }
  return files;
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
