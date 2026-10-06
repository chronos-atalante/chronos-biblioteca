import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backupInfo, backupNow, getStatus, initDrive } from '@zero/main/drive';
import { SCOPE_VERSION } from '@zero/main/drive/constants';
import { saveLibrary } from '@zero/main/library';
import { saveSettings } from '@zero/main/settings';
import { makeWork } from '../helpers/fixtures.ts';
import {
  APP_KEY,
  FakeDropbox,
  LIST_FOLDER_ENDPOINT,
  PASSPHRASE,
  TOKEN_ENDPOINT,
  bodyText,
  connect,
  json,
  resetDrive,
  stubFetch,
  tokensPath,
} from '../helpers/drive.ts';

// Este arquivo também cobre o caminho "sem chave nenhuma" (build sem chave
// embutida e sem override no settings.json), então a chave embutida é anulada
// aqui; os demais testes sempre apontam `driveClientId` para APP_KEY.
vi.mock('@zero/main/drive/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zero/main/drive/constants')>();
  return { ...actual, EMBEDDED_APP_KEY: '' };
});

describe('backupInfo', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('devolve null quando não há conta conectada', async () => {
    expect(await backupInfo()).toBeNull();
  });

  it('devolve null quando ainda não existe backup', async () => {
    await connect();
    const drive = new FakeDropbox();
    stubFetch((call) => drive.handle(call));
    expect(await backupInfo()).toBeNull();
  });

  it('devolve null quando não há library.json remoto', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.seed('outro-arquivo.bin', Buffer.from('x'));
    stubFetch((call) => drive.handle(call));
    expect(await backupInfo()).toBeNull();
  });

  it('resume o backup remoto com o tamanho informado pelo Dropbox', async () => {
    await connect();
    const drive = new FakeDropbox();
    const id = drive.seed(
      'library.json',
      Buffer.from(JSON.stringify([makeWork(), makeWork({ id: 'b' })])),
      2048,
    );
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info).toEqual({
      id,
      name: 'library.json',
      modifiedTime: '2026-02-03T04:05:06.000Z',
      size: 2048,
      works: 2,
    });
  });

  it('usa o tamanho do buffer quando o Dropbox não informa', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.seedWithoutSize('library.json', Buffer.from('[]'));
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info?.size).toBe(2);
    expect(info?.works).toBe(0);
  });

  it('conta zero obras quando o backup remoto não é uma lista', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.seed('library.json', Buffer.from('{"x":1}'), 9);
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info?.works).toBe(0);
    expect(info?.size).toBe(9);
  });

  it('devolve null quando o backup remoto é inválido', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.seed('library.json', Buffer.from('não é json'));
    stubFetch((call) => drive.handle(call));
    expect(await backupInfo()).toBeNull();
  });
});

describe('renovação de sessão', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  function seedExpiredTokens(refreshToken: string | undefined): void {
    fs.mkdirSync(path.dirname(tokensPath()), { recursive: true });
    fs.writeFileSync(
      tokensPath(),
      JSON.stringify({
        accessToken: 'antigo',
        refreshToken,
        expiresAt: Date.now() - 1000,
        accountEmail: 'leitor@example.com',
        lastSync: null,
        scopeVersion: SCOPE_VERSION,
      }),
      'utf-8',
    );
    saveSettings({
      driveClientId: APP_KEY,
      driveClientSecret: '',
      drivePassphrase: PASSPHRASE,
      language: 'pt-BR',
    });
    initDrive();
  }

  it('renova o access token expirado antes de chamar a API', async () => {
    seedExpiredTokens('refresh-legal');
    const drive = new FakeDropbox();
    drive.seed('library.json', Buffer.from('[]'));
    const calls = stubFetch((call) =>
      call.url === TOKEN_ENDPOINT
        ? json({ access_token: 'renovado', expires_in: 3600 })
        : drive.handle(call),
    );

    expect(await backupInfo()).not.toBeNull();
    const refresh = calls.find((call) => call.url === TOKEN_ENDPOINT);
    expect(refresh).toBeDefined();
    const body = bodyText(refresh);
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=refresh-legal');
    expect(body).toContain(`client_id=${APP_KEY}`);
    expect(body).not.toContain('client_secret');
    expect(getStatus().connected).toBe(true);
  });

  it('sem refresh token, orienta reconectar a conta', async () => {
    seedExpiredTokens(undefined);
    saveLibrary([makeWork({ id: 'obra-8' })]);
    stubFetch(() => json({}));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Sessão expirada. Conecte a conta Dropbox novamente.',
    });
    expect(getStatus().lastError).toBe('Sessão expirada. Conecte a conta Dropbox novamente.');
  });

  it('sem chave do aplicativo, orienta configurar a chave', async () => {
    seedExpiredTokens('refresh-legal');
    saveSettings({
      driveClientId: '',
      driveClientSecret: '',
      drivePassphrase: PASSPHRASE,
      language: 'pt-BR',
    });
    saveLibrary([makeWork({ id: 'obra-9' })]);
    const drive = new FakeDropbox();
    drive.seed('library.json', Buffer.from('[]'));
    stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(false);
    expect(result.error).toContain('chave do aplicativo Dropbox');
  });

  it('reporta falha quando a renovação é recusada', async () => {
    seedExpiredTokens('refresh-legal');
    saveLibrary([makeWork({ id: 'obra-10' })]);
    stubFetch(() => json({ error_summary: 'invalid_grant/' }, 400));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Não foi possível renovar a sessão do Dropbox.',
    });
    expect(getStatus().lastError).toBe('Não foi possível renovar a sessão do Dropbox.');
  });
});

describe('retry após 401', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('renova o token e repete a chamada', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.seed('library.json', Buffer.from('[]'));
    let unauthorized = true;
    const calls = stubFetch((call) => {
      if (call.url === TOKEN_ENDPOINT) {
        return json({ access_token: 'renovado', expires_in: 3600 });
      }
      if (unauthorized && call.url === LIST_FOLDER_ENDPOINT) {
        unauthorized = false;
        return json({}, 401);
      }
      return drive.handle(call);
    });

    expect(await backupInfo()).not.toBeNull();
    expect(calls.filter((call) => call.url === LIST_FOLDER_ENDPOINT)).toHaveLength(2);
  });
});
