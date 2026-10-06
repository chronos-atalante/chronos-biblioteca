import { describe, expectTypeOf, it } from 'vitest';
import type {
  AppSettings,
  BackupSummary,
  DriveStatus,
  ElectronApi,
  Language,
  Work,
  WorkStatus,
  WorkType,
} from '@zero/types';

describe('tipos compartilhados', () => {
  it('Work tem a forma esperada', () => {
    expectTypeOf<Work['id']>().toEqualTypeOf<string>();
    expectTypeOf<Work['progress']>().toEqualTypeOf<number>();
    expectTypeOf<Work['marker']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Work['coverFile']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Work['category']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<keyof Work>().toEqualTypeOf<
      | 'id'
      | 'title'
      | 'synopsis'
      | 'type'
      | 'status'
      | 'progress'
      | 'marker'
      | 'coverFile'
      | 'category'
      | 'createdAt'
      | 'updatedAt'
    >();
  });

  it('domínios de status e tipo', () => {
    expectTypeOf<WorkStatus>().toEqualTypeOf<
      'planejado' | 'lendo' | 'pausado' | 'concluido' | 'cancelado'
    >();
    expectTypeOf<WorkType>().toEqualTypeOf<
      'webtoon' | 'manhwa' | 'manhua' | 'manga' | 'livro' | 'outro'
    >();
  });

  it('configurações e estado do backup', () => {
    expectTypeOf<AppSettings>().toEqualTypeOf<{
      driveClientId: string;
      driveClientSecret: string;
      drivePassphrase: string;
      language: Language;
    }>();
    expectTypeOf<DriveStatus['connected']>().toEqualTypeOf<boolean>();
    expectTypeOf<DriveStatus['lastSync']>().toEqualTypeOf<string | null>();
    expectTypeOf<BackupSummary['works']>().toEqualTypeOf<number | null>();
  });

  it('window.api expõe a superfície usada pelo renderer', () => {
    expectTypeOf<ElectronApi['library']['get']>().returns.toEqualTypeOf<Promise<Work[]>>();
    expectTypeOf<ElectronApi['pickCover']>().returns.toEqualTypeOf<Promise<string | null>>();
    expectTypeOf<ElectronApi['drive']['onStatus']>().returns.toEqualTypeOf<() => void>();
  });
});
