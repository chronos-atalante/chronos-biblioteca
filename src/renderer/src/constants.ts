import type { WorkStatus, WorkType } from '@shared/types'

export const TYPE_LABELS: Record<WorkType, string> = {
  webtoon: 'Webtoon',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
  manga: 'Mangá',
  livro: 'Livro',
  outro: 'Outro'
}

export const STATUS_LABELS: Record<WorkStatus, string> = {
  planejado: 'Planejado',
  lendo: 'Lendo',
  pausado: 'Pausado',
  concluido: 'Concluído'
}

export const TYPE_COLORS: Record<WorkType, string> = {
  webtoon: '#7c6cf0',
  manhwa: '#f07c9f',
  manhua: '#f0b45f',
  manga: '#5fc0f0',
  livro: '#63d6a5',
  outro: '#9aa3b8'
}

export const STATUS_COLORS: Record<WorkStatus, string> = {
  planejado: '#8b93a7',
  lendo: '#5b9dff',
  pausado: '#e0a94f',
  concluido: '#4ecf8b'
}

export const TYPE_OPTIONS = Object.keys(TYPE_LABELS) as WorkType[]
export const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as WorkStatus[]

export type StatusFilter = 'todos' | WorkStatus

export const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'lendo', label: 'Lendo' },
  { value: 'planejado', label: 'Planejados' },
  { value: 'pausado', label: 'Pausados' },
  { value: 'concluido', label: 'Concluídos' }
]

export function coverUrl(coverFile?: string): string | null {
  if (!coverFile) return null
  return `cover://app/${encodeURIComponent(coverFile)}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
  } catch {
    return '—'
  }
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}
