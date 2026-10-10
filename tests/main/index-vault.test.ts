import os from 'os';
import path from 'path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { VaultResult, VaultStatus } from '@zero/types';
import { IDLE_LOCK_MS, vaultSession } from '@zero/main/vault';
import { resetSandbox } from '../helpers/sandbox.ts';
import { BrowserWindow, app, ipcMain } from '../mocks/electron.ts';
import type { IpcHandler } from '../mocks/electron.ts';

function handler(channel: string): IpcHandler {
  const call = ipcMain.handle.mock.calls.find((entry) => entry[0] === channel);
  if (call === undefined) throw new Error(`Handler IPC ausente: ${channel}`);
  return call[1];
}

const APP_EVENT = { senderFrame: { url: 'cronologia://app/index.html' } };
const PASSWORD = 'uva-preta-42-estrela';

function invoke(channel: string, ...args: unknown[]): unknown {
  return handler(channel)(APP_EVENT, ...args);
}

function invokeAsync<T>(channel: string, ...args: unknown[]): Promise<T> {
  return invoke(channel, ...args) as Promise<T>;
}

beforeAll(async () => {
  resetSandbox();
  app.getPath.mockReturnValue(path.join(os.tmpdir(), 'cronologia-tests-vault'));
  await import('@zero/main/index');
  await vi.waitFor(() => expect(ipcMain.handle).toHaveBeenCalled());
});

describe('canais do cofre (vault:*)', () => {
  it('vault:status começa sem cofre', () => {
    expect(invoke('vault:status')).toEqual({
      exists: false,
      unlocked: false,
      attempts: 0,
      lockUntil: 0,
    });
  });

  it('vault:create recusa senha previsível antes do Argon2id', async () => {
    const result = await invokeAsync<VaultResult>('vault:create', 'curta12');
    expect(result).toEqual({ ok: false, code: 'vaultWeakPassword', retryInMs: 0 });
    expect(invoke('vault:status')).toMatchObject({ exists: false });
  });

  it('vault:create com senha boa cria e desbloqueia o cofre', async () => {
    const result = await invokeAsync<VaultResult>('vault:create', PASSWORD);
    expect(result).toEqual({
      ok: true,
      status: { exists: true, unlocked: true, attempts: 0, lockUntil: 0 },
    });
  });

  it('vault:lock fecha a sessão e vault:status espelha', () => {
    const status = invoke('vault:lock') as VaultStatus;
    expect(status).toEqual({ exists: true, unlocked: false, attempts: 0, lockUntil: 0 });
    expect(vaultSession.isUnlocked()).toBe(false);
  });

  it('vault:unlock com a senha certa reabre e relê o estado do drive', async () => {
    const result = await invokeAsync<VaultResult>('vault:unlock', PASSWORD);
    expect(result).toEqual({
      ok: true,
      status: { exists: true, unlocked: true, attempts: 0, lockUntil: 0 },
    });
  });

  it('senha errada soma tentativa e devolve a espera de 10 s', async () => {
    invoke('vault:lock');
    const result = await invokeAsync<VaultResult>('vault:unlock', 'senha-errada-xyz');
    expect(result).toEqual({
      ok: false,
      code: 'vaultWrongPassword',
      retryInMs: 10_000,
    });
    expect(invoke('vault:status')).toMatchObject({ attempts: 1, unlocked: false });
  });

  it('durante a espera o desbloqueio é recusado sem rodar o Argon2id', async () => {
    const result = await invokeAsync<VaultResult>('vault:unlock', PASSWORD);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('vaultLockedOut');
      expect(result.retryInMs).toBeGreaterThan(0);
      expect(result.retryInMs).toBeLessThanOrEqual(10_000);
    }
  });
});

describe('guarda de origem dos canais de cofre', () => {
  it('recusa chamada de frame fora da página do app', async () => {
    const evil = { senderFrame: { url: 'https://evil.example/pagina' } };
    expect(() => handler('vault:status')(evil)).toThrow('IPC bloqueado');
    expect(() => handler('vault:lock')(evil)).toThrow('IPC bloqueado');
    await expect(handler('vault:create')(evil, PASSWORD)).rejects.toThrow('IPC bloqueado');
    await expect(handler('vault:unlock')(evil, PASSWORD)).rejects.toThrow('IPC bloqueado');
  });
});

describe('auto-lock do cofre', () => {
  it('derruba a sessão após a ociosidade e envia vault:locked para a janela', () => {
    const win = BrowserWindow.instances[0];
    if (win === undefined) throw new Error('Janela não criada.');
    win.webContents.send.mockClear();

    vi.useFakeTimers();
    try {
      vaultSession.adopt(Buffer.alloc(32, 7));
      expect(vaultSession.isUnlocked()).toBe(true);
      vi.advanceTimersByTime(IDLE_LOCK_MS);
      expect(vaultSession.isUnlocked()).toBe(false);
      expect(win.webContents.send).toHaveBeenCalledWith('vault:locked');
    } finally {
      vi.useRealTimers();
      vaultSession.wipe();
    }
  });
});
