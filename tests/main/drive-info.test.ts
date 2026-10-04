import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { backupInfo, backupNow, getStatus, initDrive } from '@zero/main/drive';
import { EMBEDDED_CLIENT_ID, SCOPE_VERSION } from '@zero/main/drive/constants';
import { saveLibrary } from '@zero/main/library';
import { saveSettings } from '@zero/main/settings';
import { makeWork } from '../helpers/fixtures.ts';
import {
  CLIENT_ID,
  FakeDrive,
  PASSPHRASE,
  SECRET,
  TOKEN_ENDPOINT,
  bodyText,
  connect,
  json,
  resetDrive,
  stubFetch,
  tokensPath,
} from '../helpers/drive.ts';

describe('backupInfo', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('devolve null quando não há conta conectada', async () => {
    expect(await backupInfo()).toBeNull();
  });

  it('devolve null quando ainda não existe pasta de backup', async () => {
    await connect();
    stubFetch(() => json({ files: [] }));
    expect(await backupInfo()).toBeNull();
  });

  it('devolve null quando não há library.json remoto', async () => {
    await connect();
    const drive = new FakeDrive();
    stubFetch((call) => drive.handle(call));
    expect(await backupInfo()).toBeNull();
  });

  it('resume o backup remoto com o tamanho informado pelo Drive', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.seed(
      'library.json',
      Buffer.from(JSON.stringify([makeWork(), makeWork({ id: 'b' })])),
      '2048',
    );
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info).toEqual({
      id: 'remote-library.json',
      name: 'library.json',
      modifiedTime: '2026-02-03T04:05:06.000Z',
      size: 2048,
      works: 2,
    });
  });

  it('usa o tamanho do buffer quando o Drive não informa', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.seed('library.json', Buffer.from('[]'));
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info?.size).toBe(2);
    expect(info?.works).toBe(0);
  });

  it('conta zero obras quando o backup remoto não é uma lista', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.seed('library.json', Buffer.from('{"x":1}'), '9');
    stubFetch((call) => drive.handle(call));

    const info = await backupInfo();
    expect(info?.works).toBe(0);
    expect(info?.size).toBe(9);
  });

  it('devolve null quando o backup remoto é inválido', async () => {
    await connect();
    const drive = new FakeDrive();
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
      driveClientId: CLIENT_ID,
      driveClientSecret: SECRET,
      drivePassphrase: PASSPHRASE,
    });
    initDrive();
  }

  it('renova o access token expirado antes de chamar a API', async () => {
    seedExpiredTokens('refresh-legal');
    const drive = new FakeDrive();
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
    expect(getStatus().connected).toBe(true);
  });

  it('sem refresh token, orienta reconectar a conta', async () => {
    seedExpiredTokens(undefined);
    saveLibrary([makeWork({ id: 'obra-8' })]);
    stubFetch(() => json({}));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Sessão expirada. Conecte a conta Google novamente.',
    });
    expect(getStatus().lastError).toBe('Sessão expirada. Conecte a conta Google novamente.');
  });

  it('renova com as credenciais embutidas sem configuração própria', async () => {
    seedExpiredTokens('refresh-legal');
    saveSettings({ driveClientId: '', driveClientSecret: '', drivePassphrase: PASSPHRASE });
    saveLibrary([makeWork({ id: 'obra-9' })]);
    const drive = new FakeDrive();
    drive.seed('library.json', Buffer.from('[]'));
    const calls = stubFetch((call) =>
      call.url === TOKEN_ENDPOINT
        ? json({ access_token: 'renovado', expires_in: 3600 })
        : drive.handle(call),
    );

    const result = await backupNow();
    expect(result.ok).toBe(true);
    const refresh = calls.find((call) => call.url === TOKEN_ENDPOINT);
    expect(refresh).toBeDefined();
    expect(bodyText(refresh)).toContain(`client_id=${EMBEDDED_CLIENT_ID}`);
    expect(getStatus().connected).toBe(true);
  });

  it('reporta falha quando a renovação é recusada', async () => {
    seedExpiredTokens('refresh-legal');
    saveLibrary([makeWork({ id: 'obra-10' })]);
    stubFetch(() => json({ error: 'invalid_grant' }, 400));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Não foi possível renovar a sessão do Google Drive.',
    });
    expect(getStatus().lastError).toBe('Não foi possível renovar a sessão do Google Drive.');
  });
});

describe('retry após 401', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('renova o token e repete a chamada', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.seed('library.json', Buffer.from('[]'));
    let unauthorized = true;
    const calls = stubFetch((call) => {
      if (call.url === TOKEN_ENDPOINT) {
        return json({ access_token: 'renovado', expires_in: 3600 });
      }
      if (unauthorized && call.url.includes('pageSize=1000')) {
        unauthorized = false;
        return json({}, 401);
      }
      return drive.handle(call);
    });

    expect(await backupInfo()).not.toBeNull();
    expect(calls.filter((call) => call.url.includes('pageSize=1000'))).toHaveLength(2);
  });
});
