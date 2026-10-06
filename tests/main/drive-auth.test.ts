import fs from 'fs';
import http from 'http';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveStatus } from '@zero/types';
import { authorize, disconnect, getStatus, initDrive, onStatus } from '@zero/main/drive';
import { SCOPE_VERSION } from '@zero/main/drive/constants';
import { saveSettings } from '@zero/main/settings';
import { shell } from '../mocks/electron.ts';
import { APP_KEY, connect, json, resetDrive, stubFetch, tokensPath } from '../helpers/drive.ts';

// Este arquivo também cobre o caminho "sem chave nenhuma" (build sem chave
// embutida e sem override no settings.json), então a chave embutida é anulada
// aqui; os demais testes sempre apontam `driveClientId` para APP_KEY.
vi.mock('@zero/main/drive/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zero/main/drive/constants')>();
  return { ...actual, EMBEDDED_APP_KEY: '' };
});

describe('estado do Dropbox', { timeout: 60_000 }, () => {
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

  it('initDrive descarta a sessão do provedor anterior', () => {
    fs.mkdirSync(path.dirname(tokensPath()), { recursive: true });
    const legacy = path.join(path.dirname(tokensPath()), 'drive-tokens.json');
    fs.writeFileSync(
      legacy,
      JSON.stringify({
        accessToken: 'token-google',
        expiresAt: Date.now() + 3_600_000,
        accountEmail: 'leitor@example.com',
        lastSync: null,
        scopeVersion: 2,
      }),
      'utf-8',
    );
    initDrive();
    expect(getStatus().connected).toBe(false);
    expect(fs.existsSync(legacy)).toBe(false);
  });
});

describe('authorize', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('recusa sem abrir o navegador quando não há chave do aplicativo', async () => {
    saveSettings({
      driveClientId: '',
      driveClientSecret: '',
      drivePassphrase: 'frase',
      language: 'pt-BR',
    });
    const result = await authorize();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('chave do aplicativo Dropbox');
    expect(getStatus().lastError).toContain('chave do aplicativo Dropbox');
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('abre o OAuth com PKCE, offline e redirect fixo', async () => {
    saveSettings({
      driveClientId: APP_KEY,
      driveClientSecret: '',
      drivePassphrase: 'frase',
      language: 'pt-BR',
    });
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
    const params = new URL(opened).searchParams;
    expect(params.get('client_id')).toBe(APP_KEY);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).not.toBeNull();
    expect(params.get('token_access_type')).toBe('offline');
    // Porta fixa quando livre; efêmera sob contenção (suíte em paralelo).
    expect(params.get('redirect_uri')).toMatch(/^http:\/\/localhost:\d+\/callback$/);
    expect(opened).not.toContain('client_secret');
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
    saveSettings({
      driveClientId: APP_KEY,
      driveClientSecret: '',
      drivePassphrase: '',
      language: 'pt-BR',
    });
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

  it('recusa a concessão sem todos os escopos', async () => {
    saveSettings({
      driveClientId: APP_KEY,
      driveClientSecret: '',
      drivePassphrase: '',
      language: 'pt-BR',
    });
    shell.openExternal.mockImplementationOnce((url: string): Promise<void> => {
      const redirect = new URL(url).searchParams.get('redirect_uri');
      if (redirect !== null) {
        const request = http.get(`${redirect}?code=codigo-valido`);
        request.on('error', () => undefined);
      }
      return Promise.resolve();
    });
    stubFetch((call) => {
      if (call.url.endsWith('/oauth2/token')) {
        return json({
          access_token: 'token-parcial',
          refresh_token: 'refresh-parcial',
          expires_in: 3600,
          scope: 'account_info.read files.content.read',
        });
      }
      return json({ error_summary: 'inesperado' }, 500);
    });
    const result = await authorize();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Faltam permissões no app Dropbox');
    expect(result.error).toContain('files.metadata.read');
    expect(getStatus().connected).toBe(false);
  });

  it('reporta falha na troca do código por tokens', async () => {
    saveSettings({
      driveClientId: APP_KEY,
      driveClientSecret: '',
      drivePassphrase: '',
      language: 'pt-BR',
    });
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
