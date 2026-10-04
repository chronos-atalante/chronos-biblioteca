export type WorkType = 'webtoon' | 'manhwa' | 'manhua' | 'manga' | 'livro' | 'outro';

export type WorkStatus = 'planejado' | 'lendo' | 'pausado' | 'concluido';

export interface Work {
  id: string;
  title: string;
  synopsis: string;
  type: WorkType;
  status: WorkStatus;
  /** Progresso de leitura em porcentagem, de 0 a 100 */
  progress: number;
  /** Indicação livre, ex.: "Cap. 45", "Vol. 3" */
  marker?: string | undefined;
  /** Nome do arquivo da capa dentro da pasta de capas */
  coverFile?: string | undefined;
  /** Categoria principal da obra, ex.: 'Isekai' */
  category?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  driveClientId: string;
  driveClientSecret: string;
  drivePassphrase: string;
}

export interface DriveStatus {
  connected: boolean;
  syncing: boolean;
  lastSync: string | null;
  lastError: string | null;
  accountEmail: string | null;
}

export interface BackupSummary {
  id: string;
  name: string;
  modifiedTime: string;
  size: number;
  works: number;
}

export interface ElectronApi {
  library: {
    get: () => Promise<Work[]>;
    save: (
      work: Omit<Work, 'createdAt' | 'updatedAt'> & Partial<Pick<Work, 'createdAt' | 'updatedAt'>>,
    ) => Promise<Work[]>;
    remove: (id: string) => Promise<Work[]>;
  };
  pickCover: () => Promise<string | null>;
  settings: {
    get: () => Promise<AppSettings>;
    set: (settings: AppSettings) => Promise<AppSettings>;
  };
  drive: {
    status: () => Promise<DriveStatus>;
    auth: () => Promise<{ ok: boolean; error?: string }>;
    backup: () => Promise<{ ok: boolean; error?: string; summary?: BackupSummary }>;
    restore: () => Promise<{ ok: boolean; error?: string; works?: number }>;
    backupInfo: () => Promise<BackupSummary | null>;
    disconnect: () => Promise<DriveStatus>;
    onStatus: (cb: (status: DriveStatus) => void) => () => void;
  };
}
