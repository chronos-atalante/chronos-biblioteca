import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AppSettings, Work } from '@zero/types';
import { configDir, coversDir, dataDir } from '@zero/main/library';
import { makeDraft, makeWork } from '../helpers/fixtures';
import { sandboxPath } from '../helpers/sandbox';
import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from '../mocks/electron';
import type { IpcHandler, WindowEventHandler } from '../mocks/electron';

const LEGACY_ROOT = path.join(os.tmpdir(), 'webtoons-tests-legacy');

function handler(channel: string): IpcHandler {
  const call = ipcMain.handle.mock.calls.find((entry) => entry[0] === channel);
  if (call === undefined) throw new Error(`Handler IPC ausente: ${channel}`);
  return call[1];
}

const FAKE_EVENT = { sender: {} };

function invoke(channel: string, ...args: unknown[]): unknown {
  return handler(channel)(FAKE_EVENT, ...args);
}

function invokeAsync<T>(channel: string, ...args: unknown[]): Promise<T> {
  return invoke(channel, ...args) as Promise<T>;
}

function appListener(event: string): WindowEventHandler {
  const call = app.on.mock.calls.find((entry) => entry[0] === event);
  if (call === undefined) throw new Error(`Listener de app ausente: ${event}`);
  return call[1];
}

function windowEvent(win: BrowserWindow, event: string): WindowEventHandler {
  const call = win.on.mock.calls.find((entry) => entry[0] === event);
  if (call === undefined) throw new Error(`Listener de janela ausente: ${event}`);
  return call[1];
}

function onceEvent(win: BrowserWindow, event: string): WindowEventHandler {
  const call = win.once.mock.calls.find((entry) => entry[0] === event);
  if (call === undefined) throw new Error(`Listener one-shot ausente: ${event}`);
  return call[1];
}

function coverHandler(): (request: { url: string }) => Response {
  const call = protocol.handle.mock.calls.find((entry) => entry[0] === 'cover');
  if (call === undefined) throw new Error('Protocolo cover não registrado.');
  return call[1] as (request: { url: string }) => Response;
}

const expectedChannels = [
  'library:get',
  'library:save',
  'library:delete',
  'cover:pick',
  'settings:get',
  'settings:set',
  'drive:status',
  'drive:auth',
  'drive:backup',
  'drive:restore',
  'drive:backup-info',
  'drive:disconnect',
];

beforeAll(async () => {
  fs.rmSync(LEGACY_ROOT, { recursive: true, force: true });
  const legacyData = path.join(LEGACY_ROOT, 'Webtoons Biblioteca');
  fs.mkdirSync(path.join(legacyData, 'covers'), { recursive: true });
  fs.writeFileSync(path.join(legacyData, 'library.json'), JSON.stringify([makeWork()]), 'utf-8');
  fs.writeFileSync(path.join(legacyData, 'covers', 'legada.png'), 'legacy-image', 'utf-8');
  fs.writeFileSync(path.join(legacyData, 'settings.json'), JSON.stringify({ driveClientId: 'id-legado' }), 'utf-8');
  fs.writeFileSync(
    path.join(legacyData, 'drive-tokens.json'),
    JSON.stringify({
      accessToken: 'token-legado',
      refreshToken: 'refresh-legado',
      expiresAt: Date.now() + 3_600_000,
      accountEmail: 'legado@exemplo.com',
      lastSync: '2026-01-10T12:00:00.000Z',
    }),
    'utf-8',
  );

  app.getPath.mockReturnValue(LEGACY_ROOT);
  await import('@zero/main/index');
  await vi.waitFor(() => expect(ipcMain.handle).toHaveBeenCalled());
});

describe('inicialização', () => {
  it('registra o scheme cover como privilegiado', () => {
    expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      {
        scheme: 'cover',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          stream: true,
        },
      },
    ]);
  });

  it('move o userData para o cache XDG', () => {
    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      path.join(sandboxPath('XDG_CACHE_HOME'), 'webtoons-biblioteca'),
    );
  });

  it('registra todos os canais de IPC', () => {
    const channels = ipcMain.handle.mock.calls.map((call) => call[0]);
    expect(channels).toEqual(expectedChannels);
  });

  it('cria a janela com sandbox e context isolation', () => {
    expect(BrowserWindow.instances).toHaveLength(1);
    const win = BrowserWindow.instances[0];
    expect(win).toBeDefined();
    const options = win?.options as {
      width: number;
      minWidth: number;
      title: string;
      webPreferences: Record<string, unknown>;
    };
    expect(options.width).toBe(1200);
    expect(options.minWidth).toBe(860);
    expect(options.title).toBe('Webtoons Biblioteca');
    expect(options.webPreferences.contextIsolation).toBe(true);
    expect(options.webPreferences.nodeIntegration).toBe(false);
    expect(options.webPreferences.sandbox).toBe(true);
    expect(options.webPreferences.webSecurity).toBe(true);
    expect(String(options.webPreferences.preload)).toContain(
      path.join('preload', 'index.js'),
    );
    expect(win?.loadFile.mock.calls[0]?.[0]).toContain(path.join('renderer', 'index.html'));
    expect(win?.loadURL).not.toHaveBeenCalled();
  });

  it('trava o app em uma única instância', () => {
    expect(app.requestSingleInstanceLock).toHaveBeenCalled();
    expect(app.quit).not.toHaveBeenCalled();
  });
});

describe('migração de dados legados', () => {
  it('copia biblioteca, capas, settings e tokens antigos', () => {
    expect(fs.existsSync(path.join(dataDir(), 'library.json'))).toBe(true);
    expect(fs.readFileSync(path.join(dataDir(), 'covers', 'legada.png'), 'utf-8')).toBe(
      'legacy-image',
    );
    expect(fs.existsSync(path.join(configDir(), 'settings.json'))).toBe(true);
    expect(fs.existsSync(path.join(configDir(), 'drive-tokens.json'))).toBe(true);
    expect(fs.existsSync(coversDir())).toBe(true);
  });
});

describe('handlers de biblioteca', () => {
  it('library:get devolve a biblioteca migrada', () => {
    const works = invoke('library:get') as Work[];
    expect(works).toHaveLength(1);
    expect(works[0]?.title).toBe('Solo Leveling');
  });

  it('library:save insere e library:delete remove', () => {
    const saved = invoke('library:save', makeDraft({ id: 'nova', title: 'Nova obra' })) as Work[];
    expect(saved).toHaveLength(2);
    expect(saved.some((work) => work.id === 'nova')).toBe(true);

    const deleted = invoke('library:delete', 'nova') as Work[];
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.id).not.toBe('nova');
  });
});

describe('handlers de configurações e Drive', () => {
  it('settings:get devolve as credenciais migradas', () => {
    const settings = invoke('settings:get') as AppSettings;
    expect(settings).toEqual({
      driveClientId: 'id-legado',
      driveClientSecret: '',
      drivePassphrase: '',
    });
  });

  it('drive:status reflete os tokens migrados', () => {
    const status = invoke('drive:status') as { connected: boolean; accountEmail: string | null };
    expect(status.connected).toBe(true);
    expect(status.accountEmail).toBe('legado@exemplo.com');
  });

  it('drive:auth falha sem client secret', async () => {
    const result = await invokeAsync<{ ok: boolean; error?: string }>('drive:auth');
    expect(result.ok).toBe(false);
    expect(result.error).toBe(
      'Configure o Client ID e o Client Secret do Google nas configurações.',
    );
  });

  it('drive:disconnect limpa a sessão e avisa a janela', () => {
    const win = BrowserWindow.instances[0];
    win?.webContents.send.mockClear();
    const status = invoke('drive:disconnect') as { connected: boolean; lastError: string | null };
    expect(status.connected).toBe(false);
    expect(status.lastError).toBeNull();
    expect(win?.webContents.send).toHaveBeenCalledWith(
      'drive:status-changed',
      expect.objectContaining({ connected: false }),
    );
    expect(fs.existsSync(path.join(configDir(), 'drive-tokens.json'))).toBe(false);
  });

  it('drive:backup, restore e backup-info exigem conexão', async () => {
    expect(await invokeAsync('drive:backup')).toEqual({
      ok: false,
      error: 'Conecte a conta Google primeiro.',
    });
    expect(await invokeAsync('drive:restore')).toEqual({
      ok: false,
      error: 'Conecte a conta Google primeiro.',
    });
    expect(await invokeAsync('drive:backup-info')).toBeNull();
  });

  it('settings:set grava e normaliza as credenciais', () => {
    const saved = invoke('settings:set', {
      driveClientId: '  novo-id  ',
      driveClientSecret: '  novo-segredo  ',
      drivePassphrase: 'frase',
    }) as AppSettings;
    expect(saved).toEqual({
      driveClientId: 'novo-id',
      driveClientSecret: 'novo-segredo',
      drivePassphrase: 'frase',
    });
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(configDir(), 'settings.json'), 'utf-8'),
    ) as AppSettings;
    expect(onDisk).toEqual(saved);
  });
});

describe('handler cover:pick', () => {
  it('devolve null quando o diálogo é cancelado', async () => {
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await invokeAsync<string | null>('cover:pick')).toBeNull();
  });

  it('devolve null quando nenhum arquivo foi escolhido', async () => {
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [''] });
    expect(await invokeAsync<string | null>('cover:pick')).toBeNull();
  });

  it('importa a imagem escolhida para a pasta de capas', async () => {
    const source = path.join(os.tmpdir(), `webtoons-pick-${Date.now()}.png`);
    fs.writeFileSync(source, 'imagem-escolhida', 'utf-8');
    try {
      dialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: [source] });
      const name = await invokeAsync<string | null>('cover:pick');
      expect(name).toMatch(/\.png$/);
      expect(fs.readFileSync(path.join(coversDir(), name ?? 'x'), 'utf-8')).toBe(
        'imagem-escolhida',
      );
    } finally {
      fs.rmSync(source, { force: true });
    }
  });

  it('abre o diálogo na janela de origem quando disponível', async () => {
    const win = BrowserWindow.instances[0];
    if (win === undefined) throw new Error('Janela não criada.');
    BrowserWindow.fromWebContents.mockReturnValueOnce(win);
    dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    await invokeAsync<string | null>('cover:pick');
    expect(dialog.showOpenDialog).toHaveBeenCalledWith(win, expect.anything());
  });
});

describe('protocolo cover://', () => {
  it('serve a imagem com mime e cache', () => {
    fs.writeFileSync(path.join(coversDir(), 'existe.png'), 'conteudo-da-capa', 'utf-8');
    const response = coverHandler()({ url: 'cover://app/existe.png' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe('max-age=3600');
  });

  it('devolve 404 para capa inexistente', () => {
    const response = coverHandler()({ url: 'cover://app/fantasma.png' });
    expect(response.status).toBe(404);
  });

  it('devolve 404 para caminho vazio', () => {
    const response = coverHandler()({ url: 'cover://app/' });
    expect(response.status).toBe(404);
  });

  it('devolve 500 para URL inválida', () => {
    const response = coverHandler()({ url: ':::nao-e-url' });
    expect(response.status).toBe(500);
  });
});

describe('ciclo de vida da janela', () => {
  it('mostra a janela quando pronta', () => {
    const win = BrowserWindow.instances[0];
    if (win === undefined) throw new Error('Janela não criada.');
    win.show.mockClear();
    onceEvent(win, 'ready-to-show')();
    expect(win.show).toHaveBeenCalledTimes(1);
  });

  it('abre links externos no navegador e nega janelas novas', () => {
    const win = BrowserWindow.instances[0];
    if (win === undefined) throw new Error('Janela não criada.');
    shell.openExternal.mockClear();
    const opener = win.webContents.setWindowOpenHandler.mock.calls[0]?.[0];
    if (opener === undefined) throw new Error('Window open handler ausente.');
    const decision = opener({ url: 'https://exemplo.com/docs' }) as { action: string };
    expect(decision.action).toBe('deny');
    expect(shell.openExternal).toHaveBeenCalledWith('https://exemplo.com/docs');
  });

  it('foca (e restaura) a janela na segunda instância', () => {
    const win = BrowserWindow.instances[0];
    if (win === undefined) throw new Error('Janela não criada.');
    win.focus.mockClear();
    win.restore.mockClear();
    const listener = appListener('second-instance');

    listener();
    expect(win.focus).toHaveBeenCalledTimes(1);
    expect(win.restore).not.toHaveBeenCalled();

    win.isMinimized.mockReturnValueOnce(true);
    listener();
    expect(win.restore).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(2);
  });

  it('encerra o app quando todas as janelas fecham', () => {
    app.quit.mockClear();
    appListener('window-all-closed')();
    expect(app.quit).toHaveBeenCalledTimes(1);
  });

  it('recria a janela no activate quando não há janelas', () => {
    const before = BrowserWindow.instances.length;
    BrowserWindow.getAllWindows.mockReturnValueOnce([]);
    appListener('activate')();
    expect(BrowserWindow.instances.length).toBe(before + 1);
  });
});

describe('status do Drive para o renderer', () => {
  it('para de enviar status depois que a janela é fechada', () => {
    const win = BrowserWindow.instances[0];
    if (win === undefined) throw new Error('Janela não criada.');
    windowEvent(win, 'closed')();
    win.webContents.send.mockClear();

    invoke('drive:disconnect');
    expect(win.webContents.send).not.toHaveBeenCalled();
  });
});
