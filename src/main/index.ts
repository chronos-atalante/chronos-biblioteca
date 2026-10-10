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
  resetLibrary,
  shredCovers,
  upsertWork,
} from '@zero/main/library';
import { loadSettings, saveSettings } from '@zero/main/settings';
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
  purgeRemote,
  restoreNow,
} from '@zero/main/drive';
import {
  createVault,
  destroyVault,
  isVaultError,
  lockVault,
  unlockVault,
  vaultDir,
  vaultSession,
  vaultStatus,
} from '@zero/main/vault';
import { runDiskCleanup } from '@zero/main/cleanup';
import { currentMessages } from '@zero/main/i18n';
import { openExternalSafe } from '@zero/main/external';
import { APP_ORIGIN, registerAppProtocol, registerCoverProtocol } from '@zero/main/protocols';
import type {
  AppSettings,
  DriveStatus,
  LibraryReset,
  PurgeResult,
  VaultResult,
  VaultStatus,
  Work,
} from '@zero/types';

app.setPath('userData', cacheDir());

/** Diretórios XDG do app no boot (cada escrita também recria os seus). */
(function ensureAppDirs(): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.mkdirSync(configDir(), { recursive: true });
    coversDir();
  } catch {
    // melhor esforço: settings e library recriam no primeiro uso
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
    title: 'Cronologia',
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
 * scheme `cronologia://` em produção. Qualquer frame fora desse host (ex.: um
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
 * Recusa IPC cujo emissor não é a página oficial do app (scheme `cronologia://`
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

  // Destrutivo: apaga todo o acervo sobrescrevendo. Devolve a contagem real,
  // nunca um "foi" genérico.
  ipcMain.handle('library:reset', (event): LibraryReset => {
    assertAppFrame(event);
    try {
      resetLibrary();
      return { ok: true, shredded: 0, failed: 0 };
    } catch (error) {
      if (isVaultError(error)) {
        return { ok: false, shredded: 0, failed: 0, code: error.code };
      }
      throw error;
    }
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

  // Grava idioma no disco e segredos no cofre: exige cofre aberto (a UI abre
  // antes), então a rejeição vira mensagem localizada em vez de erro cru.
  ipcMain.handle('settings:set', (event, settings: AppSettings): AppSettings => {
    assertAppFrame(event);
    try {
      // A janela não tem campo de App key: `''` ali significa "sem campo",
      // não "limpar". Mantém a chave já gravada no cofre (override gravado
      // por fora, de desenvolvimento; ver `docs/dropbox.md` §1).
      const driveClientId =
        settings.driveClientId === '' ? loadSettings().driveClientId : settings.driveClientId;
      return saveSettings({ ...settings, driveClientId });
    } catch (error) {
      if (isVaultError(error)) {
        throw new Error(currentMessages().vault.errors[error.code], { cause: error });
      }
      throw error;
    }
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
  ipcMain.handle('drive:purge', async (event): Promise<PurgeResult> => {
    assertAppFrame(event);
    return purgeRemote();
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
    const status = lockVault();
    // Com o cofre fechado a sessão do Dropbox não sobrevive em memória.
    reloadDriveState();
    return status;
  });

  // Destrutivo: apaga o cofre e o acervo local. Sem a chave, todo `.enc` do
  // acervo já é irrecuperável, mas eles são sobrescritos mesmo assim para não
  // deixar resíduo ilegível no disco. O backup na nuvem **não** é tocado aqui:
  // é `drive:purge`, operação separada e explícita.
  ipcMain.handle('vault:destroy', (event): VaultResult => {
    assertAppFrame(event);
    destroyVault();
    shredCovers();
    reloadDriveState();
    return { ok: true, status: vaultStatus() };
  });

  vaultSession.onAutoLock(() => {
    reloadDriveState();
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vault:locked');
    }
  });

  // Atividade da interface alimenta a janela de ociosidade do cofre. O
  // throttling fica na sessão (`touch`): aqui é só repassar o sinal.
  ipcMain.handle('vault:touch', (event): void => {
    assertAppFrame(event);
    vaultSession.touch();
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

/**
 * Apaga a chave-mestra do cofre da memória antes do processo morrer
 * (`before-quit`, antes do `will-quit` do atalho F11; ver `docs/cofre.md`).
 */
function registerVaultShutdown(): void {
  app.on('before-quit', () => {
    vaultSession.dispose();
  });
}

/**
 * Inicialização em passos isolados: o que toca disco ou a nuvem não pode
 * deixar o app sem janela (um EIO/EACCES vira `error` no log e o app segue
 * no modo que conseguir); só a falha na própria janela encerra o processo,
 * com caixa de erro, em vez de ficar um processo sem interface.
 */
function initApp(): void {
  // Manutenção de disco antes de qualquer handler responder. Não pode derrubar
  // o app: `runDiskCleanup` engole a própria falha de propósito.
  runDiskCleanup(vaultDir());

  registerCoverProtocol();
  registerAppProtocol();
  registerIpc();
  try {
    initDrive();
  } catch (error) {
    console.error('Falha ao inicializar o backup em nuvem:', error);
  }
  removeApplicationMenu();
  registerPermissionPolicy();
  registerFullscreenShortcut();
  registerVaultShutdown();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
    .then(initApp)
    .catch((error: unknown) => {
      console.error('Falha ao iniciar o aplicativo:', error);
      dialog.showErrorBox('Cronologia', currentMessages().app.startupFailed(String(error)));
      app.quit();
    });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
