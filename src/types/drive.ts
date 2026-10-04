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
