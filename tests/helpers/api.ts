import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { AppSettings, BackupSummary, DriveStatus, ElectronApi, Work } from '@zero/types';

type SaveInput = Parameters<ElectronApi['library']['save']>[0];

export interface ApiMockOptions {
  works?: Work[];
  settings?: AppSettings;
  status?: DriveStatus;
  backupInfo?: BackupSummary | null;
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
};

const DEFAULT_STATUS: DriveStatus = {
  connected: false,
  syncing: false,
  lastSync: null,
  lastError: null,
  accountEmail: null,
};

/**
 * Cria uma `window.api` fake com estado interno equivalente ao backend real:
 * `save` e `remove` operam sobre a mesma lista devolvida por `get`.
 */
export function createApiMock(options: ApiMockOptions = {}): ApiMock {
  let works: Work[] = [...(options.works ?? [])];
  const listeners = new Set<(status: DriveStatus) => void>();

  const libraryGet = vi.fn(async (): Promise<Work[]> => [...works]);

  const librarySave = vi.fn(async (work: SaveInput): Promise<Work[]> => {
    const stored = work as Work;
    const index = works.findIndex((item) => item.id === stored.id);
    works =
      index === -1 ? [...works, stored] : works.map((item, i) => (i === index ? stored : item));
    return [...works];
  });

  const libraryRemove = vi.fn(async (id: string): Promise<Work[]> => {
    works = works.filter((item) => item.id !== id);
    return [...works];
  });

  const pickCover = vi.fn(async (): Promise<string | null> => 'capa-escolhida.png');

  const settingsGet = vi.fn(async (): Promise<AppSettings> => ({
    ...DEFAULT_SETTINGS,
    ...(options.settings ?? {}),
  }));

  const settingsSet = vi.fn(async (settings: AppSettings): Promise<AppSettings> => settings);

  const driveStatus = vi.fn(async (): Promise<DriveStatus> => ({ ...DEFAULT_STATUS }));

  const driveAuth = vi.fn(async (): Promise<{ ok: boolean; error?: string }> => ({ ok: true }));

  const driveBackup = vi.fn(
    async (): Promise<{ ok: boolean; error?: string; summary?: BackupSummary }> => ({ ok: true }),
  );

  const driveRestore = vi.fn(
    async (): Promise<{ ok: boolean; error?: string; works?: number }> => ({ ok: true, works: 2 }),
  );

  const driveBackupInfo = vi.fn(
    async (): Promise<BackupSummary | null> => options.backupInfo ?? null,
  );

  const driveDisconnect = vi.fn(async (): Promise<DriveStatus> => ({
    ...DEFAULT_STATUS,
    connected: false,
  }));

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
