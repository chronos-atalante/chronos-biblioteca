import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { app, BrowserWindow, dialog, ipcMain } from '../mocks/electron.ts';

/**
 * Uma falha de disco na inicialização (`EACCES`/`EIO` em `initDrive`, que é o
 * primeiro passo que toca o sistema de arquivos) não pode deixar o app como
 * processo sem janela: o passo é isolado e o arranque continua.
 */
vi.mock('@zero/main/drive', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zero/main/drive')>();
  return {
    ...actual,
    initDrive: () => {
      throw new Error("EACCES: permission denied, mkdir '/home/e2e/.config'");
    },
  };
});

beforeAll(async () => {
  app.getPath.mockReturnValue(path.join(os.tmpdir(), 'cronologia-tests-startup'));
  await import('@zero/main/index');
  await vi.waitFor(() => expect(BrowserWindow.instances.length).toBeGreaterThan(0));
});

describe('arranque resiliente', () => {
  it('cria a janela mesmo quando o initDrive lança', () => {
    expect(BrowserWindow.instances.length).toBeGreaterThan(0);
    expect(app.quit).not.toHaveBeenCalled();
    expect(dialog.showErrorBox).not.toHaveBeenCalled();
  });

  it('registra os canais de IPC mesmo com o initDrive falho', () => {
    const channels = ipcMain.handle.mock.calls.map((call) => call[0]);
    expect(channels).toContain('library:get');
    expect(channels).toContain('vault:unlock');
  });
});
