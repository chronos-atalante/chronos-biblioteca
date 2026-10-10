import type { BackupProviderInfo, BackupSummary, DriveStatus } from '@zero/types/drive';
import type { AppSettings } from '@zero/types/settings';
import type { VaultErrorCode, VaultResult, VaultStatus } from '@zero/types/vault';
import type { Work } from '@zero/types/work';

export interface ElectronApi {
  library: {
    get: () => Promise<Work[]>;
    save: (
      work: Omit<Work, 'createdAt' | 'updatedAt'> & Partial<Pick<Work, 'createdAt' | 'updatedAt'>>,
    ) => Promise<Work[]>;
    remove: (id: string) => Promise<Work[]>;
    /** Apaga o acervo inteiro (destrutivo, irreversível). */
    reset: () => Promise<LibraryReset>;
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
    /** Apaga os blobs do usuário na nuvem (destrutivo, irreversível). */
    purge: () => Promise<PurgeResult>;
    onStatus: (cb: (status: DriveStatus) => void) => () => void;
  };
  vault: {
    status: () => Promise<VaultStatus>;
    create: (password: string) => Promise<VaultResult>;
    unlock: (password: string) => Promise<VaultResult>;
    lock: () => Promise<VaultStatus>;
    /** Destrói o cofre e o acervo local (destrutivo, irreversível). */
    destroy: () => Promise<VaultResult>;
    /** Registra atividade do usuário (mantém a janela de ociosidade aberta). */
    touch: () => Promise<void>;
    /** Avisa quando o auto-lock derruba a sessão do cofre. */
    onLocked: (cb: () => void) => () => void;
  };
}

/** Contagem real do que foi sobrescrito e do que falhou. */
export interface LibraryReset {
  ok: boolean;
  shredded: number;
  failed: number;
  code?: VaultErrorCode;
}

/**
 * Resultado do apagamento na nuvem. `ok: false` com `deleted > 0` significa
 * **falha parcial**: parte foi apagada, parte ficou. A UI precisa mostrar a
 * contagem, nunca um "apagado" genérico.
 */
export interface PurgeResult {
  ok: boolean;
  deleted: number;
  failed: number;
  error?: string;
}
