import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, DriveStatus, ElectronApi, Work } from '@zero/types';

const api: ElectronApi = {
  library: {
    get: () => ipcRenderer.invoke('library:get'),
    save: (work) => ipcRenderer.invoke('library:save', work),
    remove: (id) => ipcRenderer.invoke('library:delete', id),
  },
  pickCover: () => ipcRenderer.invoke('cover:pick'),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
    isKeyringAvailable: () => ipcRenderer.invoke('settings:keyring'),
  },
  drive: {
    status: () => ipcRenderer.invoke('drive:status'),
    providers: () => ipcRenderer.invoke('drive:providers'),
    auth: () => ipcRenderer.invoke('drive:auth'),
    backup: () => ipcRenderer.invoke('drive:backup'),
    restore: (passphrase: string) => ipcRenderer.invoke('drive:restore', passphrase),
    backupInfo: () => ipcRenderer.invoke('drive:backup-info'),
    disconnect: () => ipcRenderer.invoke('drive:disconnect'),
    onStatus: (cb: (status: DriveStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: DriveStatus): void => cb(status);
      ipcRenderer.on('drive:status-changed', listener);
      return () => ipcRenderer.removeListener('drive:status-changed', listener);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

export type { AppSettings, Work };
