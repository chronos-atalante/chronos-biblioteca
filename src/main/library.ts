import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import type { Work } from '../shared/types'

const RATING_CLAMPS = { min: 0, max: 100 } as const

export function userDataDir(): string {
  return app.getPath('userData')
}

export function coversDir(): string {
  const dir = path.join(userDataDir(), 'covers')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function libraryPath(): string {
  return path.join(userDataDir(), 'library.json')
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, data: unknown): void {
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(RATING_CLAMPS.max, Math.max(RATING_CLAMPS.min, Math.round(value)))
}

export function loadLibrary(): Work[] {
  const works = readJson<Work[]>(libraryPath(), [])
  if (!Array.isArray(works)) return []
  return works
}

export function saveLibrary(works: Work[]): Work[] {
  writeJson(libraryPath(), works)
  return works
}

export function newId(): string {
  return crypto.randomUUID()
}

export function upsertWork(
  input: Omit<Work, 'createdAt' | 'updatedAt'> & Partial<Pick<Work, 'createdAt' | 'updatedAt'>>
): Work[] {
  const works = loadLibrary()
  const now = new Date().toISOString()
  const status = input.status
  const progress = status === 'concluido' ? 100 : clampProgress(Number(input.progress))

  const index = works.findIndex((w) => w.id === input.id)
  if (index >= 0) {
    const previous = works[index]
    const updated: Work = {
      ...previous,
      ...input,
      progress,
      status,
      updatedAt: now
    }
    works[index] = updated
    if (previous.coverFile && previous.coverFile !== updated.coverFile) {
      removeCoverFile(previous.coverFile, works)
    }
  } else {
    works.push({
      ...input,
      id: input.id || newId(),
      progress,
      status,
      createdAt: input.createdAt || now,
      updatedAt: now
    })
  }

  saveLibrary(works)
  cleanupOrphanCovers(works)
  return works
}

export function deleteWork(id: string): Work[] {
  const works = loadLibrary()
  const target = works.find((w) => w.id === id)
  if (target?.coverFile) removeCoverFile(target.coverFile, works)
  const next = works.filter((w) => w.id !== id)
  saveLibrary(next)
  cleanupOrphanCovers(next)
  return next
}

const COVER_EXT_WHITELIST = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp'])

export function importCover(sourcePath: string, preferredId?: string): string | null {
  try {
    if (!fs.existsSync(sourcePath)) return null
    const ext = path.extname(sourcePath).toLowerCase()
    const safeExt = COVER_EXT_WHITELIST.has(ext) ? ext : '.png'
    const name = `${preferredId || newId()}${safeExt}`
    const destination = path.join(coversDir(), name)
    fs.copyFileSync(sourcePath, destination)
    return name
  } catch {
    return null
  }
}

function removeCoverFile(fileName: string, works: Work[]): void {
  const stillUsed = works.some((w) => w.coverFile === fileName)
  if (stillUsed) return
  const full = path.join(coversDir(), path.basename(fileName))
  fs.promises.unlink(full).catch(() => undefined)
}

function cleanupOrphanCovers(works: Work[]): void {
  try {
    const used = new Set(works.map((w) => w.coverFile).filter(Boolean) as string[])
    for (const file of fs.readdirSync(coversDir())) {
      if (!used.has(file)) {
        fs.promises.unlink(path.join(coversDir(), file)).catch(() => undefined)
      }
    }
  } catch {
    // pasta pode não existir ainda
  }
}

export function listCoverFiles(): string[] {
  try {
    return fs.readdirSync(coversDir()).filter((f) => !f.startsWith('.'))
  } catch {
    return []
  }
}

export function readCoverBuffer(fileName: string): Buffer | null {
  const full = path.join(coversDir(), path.basename(fileName))
  if (!fs.existsSync(full)) return null
  return fs.readFileSync(full)
}

export function restoreLibrary(works: Work[]): Work[] {
  const sanitized = works.map((w) => ({
    ...w,
    progress: clampProgress(Number(w.progress)),
    createdAt: w.createdAt || new Date().toISOString(),
    updatedAt: w.updatedAt || new Date().toISOString()
  }))
  saveLibrary(sanitized)
  cleanupOrphanCovers(sanitized)
  return sanitized
}

export function backupFiles(): { name: string; buffer: Buffer; mime: string }[] {
  const files: { name: string; buffer: Buffer; mime: string }[] = []
  const library = fs.readFileSync(libraryPath())
  files.push({ name: 'library.json', buffer: library, mime: 'application/json' })
  for (const cover of listCoverFiles()) {
    const buffer = readCoverBuffer(cover)
    if (buffer) files.push({ name: `covers/${cover}`, buffer, mime: mimeFor(cover) })
  }
  return files
}

export function mimeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.avif':
      return 'image/avif'
    case '.bmp':
      return 'image/bmp'
    default:
      return 'application/octet-stream'
  }
}
