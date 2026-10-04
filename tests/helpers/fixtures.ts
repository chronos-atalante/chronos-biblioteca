import type { Work } from '@zero/types';

export function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: 'work-1',
    title: 'Solo Leveling',
    synopsis: 'Caçador de nível mais baixo vira o mais forte.',
    type: 'webtoon',
    status: 'lendo',
    progress: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

export function makeDraft(
  overrides: Partial<Omit<Work, 'createdAt' | 'updatedAt'>> = {},
): Omit<Work, 'createdAt' | 'updatedAt'> & Partial<Pick<Work, 'createdAt' | 'updatedAt'>> {
  const base = makeWork();
  return {
    id: base.id,
    title: base.title,
    synopsis: base.synopsis,
    type: base.type,
    status: base.status,
    progress: base.progress,
    marker: base.marker,
    coverFile: base.coverFile,
    category: base.category,
    ...overrides,
  };
}

export function flushAsync(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 30);
  });
}
