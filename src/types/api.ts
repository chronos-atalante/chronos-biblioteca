import type { BackupProviderInfo, BackupSummary, DriveStatus } from '@zero/types/drive';
import type { AppSettings } from '@zero/types/settings';
import type { VaultResult, VaultStatus } from '@zero/types/vault';
import type { Work } from '@zero/types/work';

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
    providers: () => Promise<BackupProviderInfo[]>;
    auth: () => Promise<{ ok: boolean; error?: string }>;
    backup: () => Promise<{ ok: boolean; error?: string; summary?: BackupSummary }>;
    restore: (passphrase: string) => Promise<{ ok: boolean; error?: string; works?: number }>;
    backupInfo: () => Promise<BackupSummary | null>;
    disconnect: () => Promise<DriveStatus>;
    onStatus: (cb: (status: DriveStatus) => void) => () => void;
  };
  vault: {
    status: () => Promise<VaultStatus>;
    create: (password: string) => Promise<VaultResult>;
    unlock: (password: string) => Promise<VaultResult>;
    lock: () => Promise<VaultStatus>;
    /** Avisa quando o auto-lock derruba a sessão do cofre. */
    onLocked: (cb: () => void) => () => void;
  };
}
