import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron';
import { coversDir, deleteWork, importCover, loadLibrary, mimeFor, upsertWork } from './library';
import { loadSettings, saveSettings } from './settings';
import {
  authorize,
  backupInfo,
  backupNow,
  disconnect,
  getStatus,
  initDrive,
  onStatus,
  restoreNow,
} from './drive';
import type { AppSettings, DriveStatus, Work } from '../shared/types';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cover',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 860,
    minHeight: 560,
    title: 'Webtoons Biblioteca',
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl !== undefined && devUrl !== '') {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerCoverProtocol(): void {
  protocol.handle('cover', (request) => {
    try {
      const url = new URL(request.url);
      const name = path.basename(decodeURIComponent(url.pathname));
      if (name === '') return new Response('Não encontrado', { status: 404 });
      const full = path.join(coversDir(), name);
      if (!fs.existsSync(full)) return new Response('Não encontrado', { status: 404 });
      const buffer = fs.readFileSync(full);
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': mimeFor(name),
          'Cache-Control': 'max-age=3600',
        },
      });
    } catch {
      return new Response('Erro', { status: 500 });
    }
  });
}

function registerIpc(): void {
  ipcMain.handle('library:get', (): Work[] => loadLibrary());

  ipcMain.handle('library:save', (_event, work: Work): Work[] => upsertWork(work));

  ipcMain.handle('library:delete', (_event, id: string): Work[] => deleteWork(id));

  ipcMain.handle('cover:pick', async (event): Promise<string | null> => {
    const options = {
      title: 'Escolher imagem da capa',
      properties: ['openFile' as const],
      filters: [
        { name: 'Imagens', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'] },
      ],
    };
    const window = BrowserWindow.fromWebContents(event.sender);
    const result =
      window !== null
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options);
    const first = result.filePaths[0];
    if (result.canceled || first === undefined || first === '') return null;
    return importCover(first);
  });

  ipcMain.handle('settings:get', (): AppSettings => loadSettings());

  ipcMain.handle('settings:set', (_event, settings: AppSettings): AppSettings =>
    saveSettings(settings),
  );

  ipcMain.handle('drive:status', (): DriveStatus => getStatus());
  ipcMain.handle('drive:auth', () => authorize());
  ipcMain.handle('drive:backup', () => backupNow());
  ipcMain.handle('drive:restore', () => restoreNow());
  ipcMain.handle('drive:backup-info', () => backupInfo());
  ipcMain.handle('drive:disconnect', (): DriveStatus => disconnect());

  onStatus((status) => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('drive:status-changed', status);
    }
  });
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app
    .whenReady()
    .then(() => {
      registerCoverProtocol();
      registerIpc();
      initDrive();
      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
      });
    })
    .catch((error: unknown) => {
      console.error('Falha ao iniciar o aplicativo:', error);
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
