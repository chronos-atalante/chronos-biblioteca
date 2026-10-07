import fs from 'fs';
import path from 'path';
import { URL, pathToFileURL } from 'url';
import {
  Menu,
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  protocol,
  session,
} from 'electron';
import {
  cacheDir,
  configDir,
  coversDir,
  dataDir,
  deleteWork,
  importCover,
  loadLibrary,
  mimeFor,
  upsertWork,
} from '@zero/main/library';
import { isKeyringAvailable, loadSettings, saveSettings } from '@zero/main/settings';
import {
  authorize,
  backupInfo,
  backupNow,
  disconnect,
  getStatus,
  initDrive,
  listProviders,
  onStatus,
  restoreNow,
} from '@zero/main/drive';
import { currentMessages } from '@zero/main/i18n';
import { openExternalSafe } from '@zero/main/external';
import type { AppSettings, DriveStatus, Work } from '@zero/types';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cover',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// Diretórios da marca anterior (Webtoons Biblioteca), mantidos para migração.
const legacyDirs = [
  path.join(app.getPath('appData'), 'Webtoons Biblioteca'),
  path.join(app.getPath('appData'), 'webtoons-biblioteca'),
];
app.setPath('userData', cacheDir());

(function migrateLegacyData(): void {
  try {
    for (const legacy of legacyDirs) {
      if (!fs.existsSync(legacy)) continue;
      const mapping: [string, string][] = [
        ['library.json', path.join(dataDir(), 'library.json')],
        ['covers', path.join(dataDir(), 'covers')],
        ['settings.json', path.join(configDir(), 'settings.json')],
      ];
      for (const [name, to] of mapping) {
        const from = path.join(legacy, name);
        if (fs.existsSync(from) && !fs.existsSync(to)) {
          fs.mkdirSync(path.dirname(to), { recursive: true });
          fs.cpSync(from, to, { recursive: true });
        }
      }
    }
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.mkdirSync(configDir(), { recursive: true });
    coversDir();
  } catch {
    // ignora falhas de migração
  }
})();

let mainWindow: BrowserWindow | null = null;

/**
 * O preload é emitido como `.cjs` (CommonJS) porque o Electron executa preload
 * **sandboxed** como script simples, sem loader ESM; `format: 'cjs'` está fixado
 * em `electron.vite.config.mts`. Resolve o que existir no bundle gerado.
 */
function preloadScript(): string {
  const dir = path.join(__dirname, '../preload');
  const found = ['index.cjs', 'index.mjs', 'index.js']
    .map((name) => path.join(dir, name))
    .find((file) => fs.existsSync(file));
  return found ?? path.join(dir, 'index.cjs');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // Mínimos pequenos o bastante para caber em meia/quarta tela (tiling do
    // Cinnamon/Muffin recusa encaixar se o mínimo não couber no retângulo):
    // metade de 1600x900 = 800x430; de 1366x768 = 683x364.
    minWidth: 520,
    minHeight: 360,
    title: 'Chronos Biblioteca',
    backgroundColor: '#000000',
    icon: nativeImage.createFromPath(path.join(__dirname, '../../build/icon.png')),
    show: false,
    webPreferences: {
      preload: preloadScript(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // Em produção o DevTools fica de fora: o atalho não expõe o renderer.
      devTools: !app.isPackaged,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });

  // O app é uma SPA local: navegação só vale para a própria página (o reload
  // mantém a mesma URL); qualquer salto para outra URL é recusado.
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const targetUrl =
    devUrl !== undefined && devUrl !== ''
      ? devUrl
      : pathToFileURL(path.join(__dirname, '../renderer/index.html')).toString();
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== targetUrl) event.preventDefault();
  });

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

/**
 * Nega toda permissão web do renderer (mídia, geolocalização, notificações…);
 * só o clipboard passa, usado pelo modal de doação para copiar o link.
 */
function registerPermissionPolicy(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write');
  });
}

function registerIpc(): void {
  ipcMain.handle('library:get', (): Work[] => loadLibrary());

  ipcMain.handle('library:save', (_event, work: Work): Work[] => upsertWork(work));

  ipcMain.handle('library:delete', (_event, id: string): Work[] => deleteWork(id));

  ipcMain.handle('cover:pick', async (event): Promise<string | null> => {
    const m = currentMessages();
    const options = {
      title: m.dialogs.pickCover,
      properties: ['openFile' as const],
      filters: [
        {
          name: m.dialogs.imageFilter,
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'],
        },
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

  ipcMain.handle('settings:keyring', (): boolean => isKeyringAvailable());

  ipcMain.handle('drive:status', (): DriveStatus => getStatus());
  ipcMain.handle('drive:providers', () => listProviders());
  ipcMain.handle('drive:auth', () => authorize());
  ipcMain.handle('drive:backup', () => backupNow());
  ipcMain.handle('drive:restore', (_event, passphrase: string) => restoreNow(passphrase));
  ipcMain.handle('drive:backup-info', () => backupInfo());
  ipcMain.handle('drive:disconnect', (): DriveStatus => disconnect());

  onStatus((status) => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('drive:status-changed', status);
    }
  });
}

/**
 * Sem barra de menus (sem File/Edit/View): o menu da aplicação é removido por
 * completo em vez de escondido.
 */
function removeApplicationMenu(): void {
  Menu.setApplicationMenu(null);
}

/**
 * F11 alterna a tela cheia sem precisar de barra de menus. O atalho só vale
 * com a janela focada, para não sequestrar a tecla de outros aplicativos.
 */
function toggleFullscreen(): void {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
}

function registerFullscreenShortcut(): void {
  app.on('browser-window-focus', () => {
    globalShortcut.register('F11', toggleFullscreen);
  });
  app.on('browser-window-blur', () => {
    globalShortcut.unregister('F11');
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
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
      removeApplicationMenu();
      registerPermissionPolicy();
      registerFullscreenShortcut();
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
