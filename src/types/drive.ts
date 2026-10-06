/** Identificadores fechados dos provedores de backup catalogados no app. */
export type BackupProviderId = 'dropbox' | 'google-drive';

/**
 * Visão de um provedor para a UI. O catálogo vem do processo main
 * (`drive.providers()`), para a interface nunca duplicar o estado real.
 */
export interface BackupProviderInfo {
  id: BackupProviderId;
  label: string;
  /** true quando já é possível conectar e fazer backup neste provedor. */
  operational: boolean;
  /** Motivo da indisponibilidade; null quando o provedor está operante. */
  unavailableReason: string | null;
  /** Destino do backup na conta, em texto pronto para exibição. */
  storageTarget: string;
  /** true quando esse destino é oculto na interface do serviço (ex.: appDataFolder). */
  storageHidden: boolean;
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
  works: number | null;
}
