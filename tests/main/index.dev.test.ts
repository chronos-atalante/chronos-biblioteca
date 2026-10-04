import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain, app } from '../mocks/electron.ts';
import { resetSandbox } from '../helpers/sandbox.ts';

beforeAll(async () => {
  resetSandbox();
  process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173';
  await import('@zero/main/index');
  await vi.waitFor(() => expect(BrowserWindow.instances).toHaveLength(1));
});

afterAll(() => {
  delete process.env.ELECTRON_RENDERER_URL;
});

describe('modo desenvolvimento', () => {
  it('carrega a URL do renderer quando ELECTRON_RENDERER_URL está definida', () => {
    const win = BrowserWindow.instances[0];
    expect(win).toBeDefined();
    expect(win?.loadURL).toHaveBeenCalledWith('http://localhost:5173');
    expect(win?.loadFile).not.toHaveBeenCalled();
  });

  it('registra os canais de IPC e pede a única instância', () => {
    expect(ipcMain.handle).toHaveBeenCalled();
    expect(app.requestSingleInstanceLock).toHaveBeenCalled();
  });
});
