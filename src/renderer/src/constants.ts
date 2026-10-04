import type { WorkStatus, WorkType } from '@zero/types';

export const TYPE_LABELS: Record<WorkType, string> = {
  webtoon: 'Webtoon',
  manhwa: 'Manhwa',
  manhua: 'Manhua',
  manga: 'Mangá',
  livro: 'Livro',
  outro: 'Outro',
};

export const STATUS_LABELS: Record<WorkStatus, string> = {
  planejado: 'Planejado',
  lendo: 'Lendo',
  pausado: 'Pausado',
  concluido: 'Concluído',
};

export const TYPE_COLORS: Record<WorkType, string> = {
  webtoon: '#7c8cff',
  manhwa: '#f07c9f',
  manhua: '#f0b45f',
  manga: '#5fc0f0',
  livro: '#63d6a5',
  outro: '#9aa3b8',
};

export const STATUS_COLORS: Record<WorkStatus, string> = {
  planejado: '#8b93a7',
  lendo: '#5b9dff',
  pausado: '#e0a94f',
  concluido: '#4ecf8b',
};

export const TYPE_OPTIONS = Object.keys(TYPE_LABELS) as WorkType[];
export const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as WorkStatus[];

export const CATEGORIES: string[] = [
  'Isekai',
  'Ação',
  'Artes Marciais',
  'Fantasia',
  'Comédia',
  'Romance',
  'Drama',
  'Aventura',
  'Suspense',
  'Terror',
  'Mistério',
  'Shounen',
  'Seinen',
  'Slice of Life',
  'Esportes',
  'Escolar',
];

export type StatusFilter = 'todos' | WorkStatus;

export const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'lendo', label: 'Lendo' },
  { value: 'planejado', label: 'Planejados' },
  { value: 'pausado', label: 'Pausados' },
  { value: 'concluido', label: 'Concluídos' },
];

export function coverUrl(coverFile?: string): string | null {
  if (coverFile === undefined || coverFile === '') return null;
  return `cover://app/${encodeURIComponent(coverFile)}`;
}

export function formatDate(iso: string | null): string {
  if (iso === null || iso === '') return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.round(value));
}
