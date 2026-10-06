import type { Language, WorkStatus, WorkType } from '@zero/types';

/** Chaves fechadas de tipo/status na ordem de exibição (rótulos ficam em `@zero/messages`). */
export const TYPE_OPTIONS: readonly WorkType[] = [
  'webtoon',
  'manhwa',
  'manhua',
  'manga',
  'livro',
  'outro',
];

export const STATUS_OPTIONS: readonly WorkStatus[] = [
  'planejado',
  'lendo',
  'pausado',
  'concluido',
  'cancelado',
];

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
  cancelado: '#e06c75',
};

export const CATEGORIES: string[] = [
  'Ação',
  'Adulto',
  'Artes Marciais',
  'Aventura',
  'Boys Love',
  'Comédia',
  'Crime',
  'Cultivo',
  'Cyberpunk',
  'Demônios',
  'Distopia',
  'Drama',
  'Ecchi',
  'Escolar',
  'Espaço',
  'Esportes',
  'Faroeste',
  'Fantasia',
  'Ficção Científica',
  'Girls Love',
  'Guerra',
  'Harém',
  'Histórico',
  'Infantil',
  'Isekai',
  'Jogos',
  'Josei',
  'Magia',
  'Mecha',
  'Medicina',
  'Militar',
  'Mistério',
  'Mitologia',
  'Música',
  'Paródia',
  'Policial',
  'Pós-apocalíptico',
  'Psicológico',
  'Regressão',
  'Romance',
  'Samurai',
  'Seinen',
  'Shoujo',
  'Shounen',
  'Slice of Life',
  'Sobrenatural',
  'Sobrevivência',
  'Super-heróis',
  'Suspense',
  'Terror',
  'Thriller',
  'Tragédia',
  'Vampiros',
  'Viagem no Tempo',
  'Vilões',
  'Zumbis',
];

export type StatusFilter = 'todos' | WorkStatus;

/** Valores dos chips de filtro da barra superior (rótulos em `m.app.filters`). */
export const FILTER_OPTIONS: readonly StatusFilter[] = [
  'todos',
  'lendo',
  'planejado',
  'pausado',
  'concluido',
  'cancelado',
];

export function coverUrl(coverFile?: string): string | null {
  if (coverFile === undefined || coverFile === '') return null;
  return `cover://app/${encodeURIComponent(coverFile)}`;
}

export function formatDate(iso: string | null, language: Language): string {
  if (iso === null || iso === '') return '-';
  try {
    return new Date(iso).toLocaleString(language, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '-';
  }
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.round(value));
}
