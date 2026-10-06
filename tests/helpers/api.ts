import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type {
  AppSettings,
  BackupProviderInfo,
  BackupSummary,
  DriveStatus,
  ElectronApi,
  Work,
} from '@zero/types';
import { listProviders } from '@zero/main/drive/provider';

type SaveInput = Parameters<ElectronApi['library']['save']>[0];

export interface ApiMockOptions {
  works?: Work[];
  settings?: AppSettings;
  status?: DriveStatus;
  backupInfo?: BackupSummary | null;
  providers?: BackupProviderInfo[];
}

export interface ApiMock {
  api: ElectronApi;
  libraryGet: Mock<() => Promise<Work[]>>;
  librarySave: Mock<(work: SaveInput) => Promise<Work[]>>;
  libraryRemove: Mock<(id: string) => Promise<Work[]>>;
  pickCover: Mock<() => Promise<string | null>>;
  settingsGet: Mock<() => Promise<AppSettings>>;
  settingsSet: Mock<(settings: AppSettings) => Promise<AppSettings>>;
  driveStatus: Mock<() => Promise<DriveStatus>>;
  driveProviders: Mock<() => Promise<BackupProviderInfo[]>>;
  driveAuth: Mock<() => Promise<{ ok: boolean; error?: string }>>;
  driveBackup: Mock<() => Promise<{ ok: boolean; error?: string; summary?: BackupSummary }>>;
  driveRestore: Mock<() => Promise<{ ok: boolean; error?: string; works?: number }>>;
  driveBackupInfo: Mock<() => Promise<BackupSummary | null>>;
  driveDisconnect: Mock<() => Promise<DriveStatus>>;
  driveOnStatus: Mock<(callback: (status: DriveStatus) => void) => () => void>;
  emitStatus: (status: DriveStatus) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  driveClientId: '',
  driveClientSecret: '',
  drivePassphrase: '',
  language: 'pt-BR',
};

const DEFAULT_STATUS: DriveStatus = {
  connected: false,
  syncing: false,
  lastSync: null,
  lastError: null,
  accountEmail: null,
};

/**
 * Catálogo usado pela UI nos testes: o mesmo do processo main
 * (`drive.providers()`), com o Google Drive catalogado e não operante.
 */
const DEFAULT_PROVIDERS: BackupProviderInfo[] = listProviders();

/**
 * Cria uma `window.api` fake com estado interno equivalente ao backend real:
 * `save` e `remove` operam sobre a mesma lista devolvida por `get`.
 */
export function createApiMock(options: ApiMockOptions = {}): ApiMock {
  let works: Work[] = [...(options.works ?? [])];
  const listeners = new Set<(status: DriveStatus) => void>();

  const libraryGet = vi.fn((): Promise<Work[]> => Promise.resolve([...works]));

  const librarySave = vi.fn((work: SaveInput): Promise<Work[]> => {
    const stored = work as Work;
    const index = works.findIndex((item) => item.id === stored.id);
    works =
      index === -1 ? [...works, stored] : works.map((item, i) => (i === index ? stored : item));
    return Promise.resolve([...works]);
  });

  const libraryRemove = vi.fn((id: string): Promise<Work[]> => {
    works = works.filter((item) => item.id !== id);
    return Promise.resolve([...works]);
  });

  const pickCover = vi.fn((): Promise<string | null> => Promise.resolve('capa-escolhida.png'));

  const settingsGet = vi.fn((): Promise<AppSettings> =>
    Promise.resolve({
      ...DEFAULT_SETTINGS,
      ...(options.settings ?? {}),
    }),
  );

  const settingsSet = vi.fn((settings: AppSettings): Promise<AppSettings> =>
    Promise.resolve(settings),
  );

  const driveStatus = vi.fn((): Promise<DriveStatus> =>
    Promise.resolve({ ...DEFAULT_STATUS, ...(options.status ?? {}) }),
  );

  const driveProviders = vi.fn((): Promise<BackupProviderInfo[]> =>
    Promise.resolve(options.providers ?? DEFAULT_PROVIDERS),
  );

  const driveAuth = vi.fn((): Promise<{ ok: boolean; error?: string }> =>
    Promise.resolve({ ok: true }),
  );

  const driveBackup = vi.fn((): Promise<{ ok: boolean; error?: string; summary?: BackupSummary }> =>
    Promise.resolve({ ok: true }),
  );

  const driveRestore = vi.fn((): Promise<{ ok: boolean; error?: string; works?: number }> =>
    Promise.resolve({ ok: true, works: 2 }),
  );

  const driveBackupInfo = vi.fn((): Promise<BackupSummary | null> =>
    Promise.resolve(options.backupInfo ?? null),
  );

  const driveDisconnect = vi.fn((): Promise<DriveStatus> =>
    Promise.resolve({
      ...DEFAULT_STATUS,
      connected: false,
    }),
  );

  const driveOnStatus = vi.fn((callback: (status: DriveStatus) => void): (() => void) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  });

  const api: ElectronApi = {
    library: {
      get: libraryGet,
      save: librarySave,
      remove: libraryRemove,
    },
    pickCover,
    settings: {
      get: settingsGet,
      set: settingsSet,
    },
    drive: {
      status: driveStatus,
      providers: driveProviders,
      auth: driveAuth,
      backup: driveBackup,
      restore: driveRestore,
      backupInfo: driveBackupInfo,
      disconnect: driveDisconnect,
      onStatus: driveOnStatus,
    },
  };

  return {
    api,
    libraryGet,
    librarySave,
    libraryRemove,
    pickCover,
    settingsGet,
    settingsSet,
    driveStatus,
    driveProviders,
    driveAuth,
    driveBackup,
    driveRestore,
    driveBackupInfo,
    driveDisconnect,
    driveOnStatus,
    emitStatus: (status: DriveStatus): void => {
      for (const listener of listeners) listener(status);
    },
  };
}

export function installApiMock(mock: ApiMock): void {
  Object.defineProperty(window, 'api', {
    value: mock.api,
    configurable: true,
    writable: true,
  });
}
