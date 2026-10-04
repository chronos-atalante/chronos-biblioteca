import fs from 'fs';
import http from 'http';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveStatus } from '@zero/types';
import { authorize, disconnect, getStatus, initDrive, onStatus } from '@zero/main/drive';
import { EMBEDDED_CLIENT_ID, SCOPE_VERSION } from '@zero/main/drive/constants';
import { saveSettings } from '@zero/main/settings';
import { shell } from '../mocks/electron.ts';
import {
  CLIENT_ID,
  SECRET,
  connect,
  json,
  resetDrive,
  stubFetch,
  tokensPath,
} from '../helpers/drive.ts';

describe('estado do Drive', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('inicia desconectado e sem erros', () => {
    const status = getStatus();
    expect(status.connected).toBe(false);
    expect(status.syncing).toBe(false);
    expect(status.lastSync).toBeNull();
    expect(status.lastError).toBeNull();
    expect(status.accountEmail).toBeNull();
    disconnect();
    expect(getStatus().connected).toBe(false);
  });

  it('onStatus recebe o status a cada transição', async () => {
    const listener = vi.fn<(status: DriveStatus) => void>();
    onStatus(listener);
    await connect();
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls.at(-1)?.[0].connected).toBe(true);
    disconnect();
    expect(listener.mock.calls.at(-1)?.[0].connected).toBe(false);
  });

  it('initDrive recarrega os tokens persistidos', async () => {
    await connect();
    expect(fs.existsSync(tokensPath())).toBe(true);
    expect(fs.statSync(tokensPath()).mode & 0o777).toBe(0o600);
    disconnect();
    expect(fs.existsSync(tokensPath())).toBe(false);

    fs.writeFileSync(
      tokensPath(),
      JSON.stringify({
        accessToken: 'renovado',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 3_600_000,
        accountEmail: 'outra@x.com',
        lastSync: '2026-01-05T00:00:00.000Z',
        scopeVersion: SCOPE_VERSION,
      }),
      'utf-8',
    );
    initDrive();
    const status = getStatus();
    expect(status.connected).toBe(true);
    expect(status.accountEmail).toBe('outra@x.com');
    expect(status.lastSync).toBe('2026-01-05T00:00:00.000Z');
    expect(status.lastError).toBeNull();
  });

  it('initDrive ignora arquivo de tokens corrompido', () => {
    fs.mkdirSync(path.dirname(tokensPath()), { recursive: true });
    fs.writeFileSync(tokensPath(), '{ corrompido', 'utf-8');
    initDrive();
    expect(getStatus().connected).toBe(false);
  });
});

describe('authorize', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('usa as credenciais embutidas quando não há configuração própria', async () => {
    shell.openExternal.mockImplementationOnce((url: string): Promise<void> => {
      const redirect = new URL(url).searchParams.get('redirect_uri');
      if (redirect !== null) {
        const request = http.get(`${redirect}?error=access_denied`);
        request.on('error', () => undefined);
      }
      return Promise.resolve();
    });

    const result = await authorize();

    expect(result.ok).toBe(false);
    expect(result.error).toBe('access_denied');
    expect(getStatus().lastError).toBe('access_denied');
    expect(shell.openExternal).toHaveBeenCalledTimes(1);
    const opened = shell.openExternal.mock.calls[0]?.[0] ?? '';
    expect(opened).toContain(`client_id=${EMBEDDED_CLIENT_ID}`);
  });

  it('conclui o OAuth pelo callback local e grava o e-mail da conta', async () => {
    await connect();
    const status = getStatus();
    expect(status.connected).toBe(true);
    expect(status.accountEmail).toBe('leitor@example.com');
    expect(status.lastError).toBeNull();
    expect(shell.openExternal).toHaveBeenCalledTimes(1);
  });

  it('propaga o erro quando o usuário recusa a autorização', async () => {
    saveSettings({ driveClientId: CLIENT_ID, driveClientSecret: SECRET, drivePassphrase: '' });
    shell.openExternal.mockImplementationOnce((url: string): Promise<void> => {
      const redirect = new URL(url).searchParams.get('redirect_uri');
      if (redirect !== null) {
        const request = http.get(`${redirect}?error=access_denied`);
        request.on('error', () => undefined);
      }
      return Promise.resolve();
    });
    const result = await authorize();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('access_denied');
    expect(getStatus().lastError).toBe('access_denied');
  });

  it('reporta falha na troca do código por tokens', async () => {
    saveSettings({ driveClientId: CLIENT_ID, driveClientSecret: SECRET, drivePassphrase: '' });
    shell.openExternal.mockImplementationOnce((url: string): Promise<void> => {
      const redirect = new URL(url).searchParams.get('redirect_uri');
      if (redirect !== null) {
        const request = http.get(`${redirect}?code=codigo-valido`);
        request.on('error', () => undefined);
      }
      return Promise.resolve();
    });
    stubFetch(() => json({ error: 'invalid_grant' }, 400));
    const result = await authorize();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Falha ao obter tokens (400).');
    expect(getStatus().lastError).toBe('Falha ao obter tokens (400).');
  });
});

afterEach(() => {
  onStatus(() => undefined);
});
