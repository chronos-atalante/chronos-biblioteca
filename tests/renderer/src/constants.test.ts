import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  FILTERS,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  TYPE_COLORS,
  TYPE_LABELS,
  TYPE_OPTIONS,
  clampProgress,
  coverUrl,
  formatDate,
} from '@zero/renderer/constants';
import type { StatusFilter } from '@zero/renderer/constants';

describe('rótulos e cores', () => {
  it('cobre todos os tipos de obra', () => {
    expect(TYPE_OPTIONS).toEqual(['webtoon', 'manhwa', 'manhua', 'manga', 'livro', 'outro']);
    for (const type of TYPE_OPTIONS) {
      expect(TYPE_LABELS[type]).not.toBe('');
      expect(TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('cobre todos os status', () => {
    expect(STATUS_OPTIONS).toEqual(['planejado', 'lendo', 'pausado', 'concluido']);
    for (const status of STATUS_OPTIONS) {
      expect(STATUS_LABELS[status]).not.toBe('');
      expect(STATUS_COLORS[status]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('expõe os filtros da barra superior', () => {
    const values: StatusFilter[] = FILTERS.map((filter) => filter.value);
    expect(values).toEqual(['todos', 'lendo', 'planejado', 'pausado', 'concluido']);
    expect(FILTERS.every((filter) => filter.label !== '')).toBe(true);
  });

  it('lista categorias prontas para uso', () => {
    expect(CATEGORIES).toContain('Isekai');
    expect(CATEGORIES).toHaveLength(16);
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
  });
});

describe('coverUrl', () => {
  it('devolve null sem capa', () => {
    expect(coverUrl(undefined)).toBeNull();
    expect(coverUrl('')).toBeNull();
  });

  it('monta a URL do protocolo cover com encoding', () => {
    expect(coverUrl('capa.png')).toBe('cover://app/capa.png');
    expect(coverUrl('minha capa.png')).toBe('cover://app/minha%20capa.png');
  });
});

describe('formatDate', () => {
  it('usa travessão para datas vazias', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formata datas ISO válidas em pt-BR', () => {
    const formatted = formatDate('2026-03-04T15:30:00.000Z');
    expect(formatted).not.toBe('—');
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{2}/);
  });
});

describe('clampProgress', () => {
  it('normaliza para inteiro não negativo', () => {
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(33.7)).toBe(34);
    expect(clampProgress(100)).toBe(100);
  });
});
