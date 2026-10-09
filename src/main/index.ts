import fs from 'fs';
import path from 'path';
import { URL } from 'url';
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
  emit,
  getStatus,
  initDrive,
  listProviders,
  loadState,
  onStatus,
  restoreNow,
} from '@zero/main/drive';
import {
  createVault,
  isVaultError,
  lockVault,
  unlockVault,
  vaultSession,
  vaultStatus,
} from '@zero/main/vault';
import { currentMessages } from '@zero/main/i18n';
import { openExternalSafe } from '@zero/main/external';
import type { AppSettings, DriveStatus, VaultResult, VaultStatus, Work } from '@zero/types';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'cover',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
  {
    // Scheme que serve a página do app em produção (via protocol.handle), no
    // lugar de file:// (recomendado pela doc de 2026 do Electron).
    scheme: 'chronos',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const APP_SCHEME = 'chronos';
const APP_ORIGIN = `${APP_SCHEME}://app`;

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
  const targetUrl = devUrl !== undefined && devUrl !== '' ? devUrl : `${APP_ORIGIN}/index.html`;
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== targetUrl) event.preventDefault();
  });

  void mainWindow.loadURL(targetUrl);

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

/** Extenação → tipo MIME mínimo para servir a SPA local. */
function rendererMime(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serve a SPA empacotada sob o scheme `chronos://` (em vez de `file://`,
 * recomendado pela doc atual do Electron): todo `/assets/...` resolve dentro de
 * `out/renderer`, com path traversal rejeitado por `path.resolve` + prefix.
 */
function registerAppProtocol(): void {
  const root = path.join(__dirname, '../renderer');
  protocol.handle(APP_SCHEME, (request) => {
    try {
      const u = new URL(request.url);
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      const full = path.resolve(root, rel === '' ? 'index.html' : rel);
      if (!full.startsWith(`${root}${path.sep}`)) {
        return new Response('Forbidden', { status: 403 });
      }
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return new Response('Não encontrado.', { status: 404 });
      }
      return new Response(new Uint8Array(fs.readFileSync(full)), {
        headers: { 'Content-Type': rendererMime(full) },
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

/**
 * Só aceita URL da página oficial do app: dev server do Vite em dev, ou o
 * scheme `chronos://` em produção. Qualquer frame fora desse host (ex.: um
 * `<webview>` injetado) é bloqueado antes do handler de domínio rodar.
 */
function isAppFrameUrl(url: string | undefined): boolean {
  if (url === undefined) return false;
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const base = devUrl !== undefined && devUrl !== '' ? devUrl : `${APP_ORIGIN}/index.html`;
  try {
    const frame = new URL(url);
    const expected = new URL(base);
    return (
      frame.protocol === expected.protocol &&
      frame.host === expected.host &&
      frame.port === expected.port
    );
  } catch {
    return false;
  }
}

/**
 * Recusa IPC cujo emissor não é a página oficial do app (scheme `chronos://`
 * em produção ou dev server do Vite em dev). Requer `event.senderFrame`.
 */
function assertAppFrame(event: unknown): void {
  const sf = (event as { senderFrame?: { url?: unknown } | null } | null | undefined)?.senderFrame;
  const url = sf?.url;
  if (!isAppFrameUrl(typeof url === 'string' ? url : undefined)) {
    throw new Error('IPC bloqueado: frame fora da página oficial do app.');
  }
}

/**
 * Converte o `VaultError` do domínio no envelope de resposta dos canais de
 * cofre (o main nunca lança no IPC: o renderer localiza `code` no bundle).
 */
function vaultFailure(error: unknown): VaultResult {
  if (isVaultError(error)) {
    return { ok: false, code: error.code, retryInMs: error.retryInMs ?? 0 };
  }
  console.error('Erro inesperado no cofre:', error);
  return { ok: false, code: 'vaultTampered', retryInMs: 0 };
}

function registerIpc(): void {
  ipcMain.handle('library:get', (event): Work[] => {
    assertAppFrame(event);
    return loadLibrary();
  });

  ipcMain.handle('library:save', (event, work: Work): Work[] => {
    assertAppFrame(event);
    return upsertWork(work);
  });

  ipcMain.handle('library:delete', (event, id: string): Work[] => {
    assertAppFrame(event);
    return deleteWork(id);
  });

  ipcMain.handle('cover:pick', async (event): Promise<string | null> => {
    assertAppFrame(event);
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

  ipcMain.handle('settings:get', (event): AppSettings => {
    assertAppFrame(event);
    return loadSettings();
  });

  ipcMain.handle('settings:set', (event, settings: AppSettings): AppSettings => {
    assertAppFrame(event);
    return saveSettings(settings);
  });

  ipcMain.handle('settings:keyring', (event): boolean => {
    assertAppFrame(event);
    return isKeyringAvailable();
  });

  ipcMain.handle('drive:status', (event): DriveStatus => {
    assertAppFrame(event);
    return getStatus();
  });
  ipcMain.handle('drive:providers', (event) => {
    assertAppFrame(event);
    return listProviders();
  });
  ipcMain.handle('drive:auth', (event) => {
    assertAppFrame(event);
    return authorize();
  });
  ipcMain.handle('drive:backup', (event) => {
    assertAppFrame(event);
    return backupNow();
  });
  ipcMain.handle('drive:restore', (event, passphrase: string) => {
    assertAppFrame(event);
    return restoreNow(passphrase);
  });
  ipcMain.handle('drive:backup-info', (event) => {
    assertAppFrame(event);
    return backupInfo();
  });
  ipcMain.handle('drive:disconnect', (event): DriveStatus => {
    assertAppFrame(event);
    return disconnect();
  });

  // Com o cofre criado/desbloqueado o estado do drive é relido: os tokens
  // podem ter migrado para dentro e o renderer recebe o status novo.
  const reloadDriveState = (): void => {
    loadState();
    emit();
  };

  ipcMain.handle('vault:status', (event): VaultStatus => {
    assertAppFrame(event);
    return vaultStatus();
  });

  ipcMain.handle('vault:create', async (event, password: string): Promise<VaultResult> => {
    assertAppFrame(event);
    try {
      const status = await createVault(password);
      reloadDriveState();
      return { ok: true, status };
    } catch (error) {
      return vaultFailure(error);
    }
  });

  ipcMain.handle('vault:unlock', async (event, password: string): Promise<VaultResult> => {
    assertAppFrame(event);
    try {
      const status = await unlockVault(password);
      reloadDriveState();
      return { ok: true, status };
    } catch (error) {
      return vaultFailure(error);
    }
  });

  ipcMain.handle('vault:lock', (event): VaultStatus => {
    assertAppFrame(event);
    return lockVault();
  });

  vaultSession.onAutoLock(() => {
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vault:locked');
    }
  });

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
      registerAppProtocol();
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
