import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backupNow, getStatus, restoreNow } from '@zero/main/drive';
import { nameKeyFor, remoteName } from '@zero/main/drive/crypto';
import { loadLibrary, saveLibrary } from '@zero/main/library';
import { makeWork } from '../helpers/fixtures.ts';
import {
  FakeDrive,
  LEGACY_FOLDER_ID,
  PASSPHRASE,
  connect,
  coversPath,
  defer,
  encryptForTest,
  json,
  resetDrive,
  stubFetch,
} from '../helpers/drive.ts';

describe('backupNow', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('exige conta conectada', async () => {
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Conecte a conta Google primeiro.',
    });
  });

  it('exige uma biblioteca local', async () => {
    await connect();
    stubFetch(() => json({ files: [] }));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Nenhuma biblioteca local para backup. Adicione ao menos uma obra.',
    });
    expect(getStatus().syncing).toBe(false);
  });

  it('recusa execução paralela enquanto sincroniza', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-1' })]);
    const gate = defer();
    stubFetch((call) => {
      if (call.url.includes('pageSize=1')) return gate.promise;
      return json({});
    });
    const first = backupNow();
    await vi.waitFor(() => expect(getStatus().syncing).toBe(true));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Sincronização já em andamento.',
    });
    gate.resolve(json({ error: { message: 'cancelado' } }, 500));
    const outcome = await first;
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('cancelado');
    expect(getStatus().syncing).toBe(false);
  });

  it('exige senha de criptografia antes de enviar', async () => {
    await connect('');
    saveLibrary([makeWork({ id: 'obra-2' })]);
    const drive = new FakeDrive();
    stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Defina uma senha de criptografia do backup nas configurações.');
    expect(getStatus().lastError).toBe(
      'Defina uma senha de criptografia do backup nas configurações.',
    );
    expect(getStatus().syncing).toBe(false);
  });

  it('envia cifrado para o espaço oculto e registra o resumo', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-3', title: 'Título Sigiloso' })]);
    const drive = new FakeDrive();
    stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(true);
    expect(result.summary?.name).toBe('library.json');
    expect(result.summary?.id).toBe('novo');
    expect(result.summary?.works).toBe(1);
    expect(result.summary?.size ?? 0).toBeGreaterThan(0);
    expect(getStatus().lastSync).not.toBeNull();
    expect(drive.folderId).toBeNull();

    const uploads = [...drive.files.values()].map((file) => file.content);
    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads.some((body) => body.includes(Buffer.from('WTENC2')))).toBe(true);
    expect(uploads.some((body) => body.includes(Buffer.from('Título Sigiloso')))).toBe(false);
  });

  it('atualiza arquivos existentes e apaga remotos órfãos', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-4' })]);
    const drive = new FakeDrive();
    const key = nameKeyFor(PASSPHRASE);
    const libraryRemote = remoteName('library.json', key);
    const orphanRemote = remoteName('capa-antiga.png', key);
    drive.seed(libraryRemote, Buffer.from('[]'));
    drive.seed(orphanRemote, Buffer.from('png'));
    drive.seed('capa-legada.png', Buffer.from('png'));
    const deleted: string[] = [];
    const original = drive.handle.bind(drive);
    stubFetch((call) => {
      if ((call.init.method ?? 'GET').toUpperCase() === 'DELETE') {
        const id = /\/files\/([^/]+)$/.exec(new URL(call.url).pathname)?.[1] ?? '';
        deleted.push(id);
      }
      return original(call);
    });

    const result = await backupNow();
    expect(result.ok).toBe(true);
    expect(result.summary?.id).toBe(`remote-${libraryRemote}`);
    expect(deleted).toContain(`remote-${orphanRemote}`);
    expect(deleted).toContain('remote-capa-legada.png');
    expect(drive.files.has(`remote-${orphanRemote}`)).toBe(false);
    expect(drive.files.has(`remote-${libraryRemote}`)).toBe(true);
    const names = [...drive.files.keys()].map((id) => id.replace(/^remote-(?:\d+-)?/, ''));
    expect(names).not.toContain('library.json');
    expect(names).not.toContain('capa-antiga.png');
    expect(names).not.toContain('capa-legada.png');
  });

  it('escapa aspas na pasta e nos ids consultados', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-7' })]);
    const drive = new FakeDrive();
    drive.folderId = LEGACY_FOLDER_ID;
    drive.seed('library.json', Buffer.from('[]'));
    const calls = stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(true);
    const listCall = calls.find((call) => call.url.includes('pageSize=1000'));
    expect(listCall).toBeDefined();
    const decoded = decodeURIComponent(listCall?.url ?? '');
    expect(decoded).toContain("\\'");
    expect(decoded).toContain('\\\\barra');
    expect(drive.folderId).toBeNull();
  });

  it('reporta erro vindo da API do Drive', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-5' })]);
    stubFetch(() => json({ error: { message: 'Cota excedida.' } }, 403));
    const result = await backupNow();
    expect(result).toEqual({ ok: false, error: 'Cota excedida.' });
    expect(getStatus().lastError).toBe('Cota excedida.');
    expect(getStatus().syncing).toBe(false);
  });

  it('reporta erro sem corpo JSON aproveitável', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-6' })]);
    stubFetch(() => new Response('erro interno', { status: 500 }));
    const result = await backupNow();
    expect(result).toEqual({ ok: false, error: 'Erro do Google Drive (HTTP 500).' });
  });
});

describe('restoreNow', () => {
  beforeEach(() => {
    resetDrive();
  });

  it('exige conta conectada', async () => {
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Conecte a conta Google primeiro.',
    });
  });

  it('restaura biblioteca e capas a partir do backup', async () => {
    await connect();
    const drive = new FakeDrive();
    const works = [makeWork({ id: 'restaurada', coverFile: 'capa.png' })];
    drive.seed('library.json', Buffer.from(JSON.stringify(works)));
    drive.seed('capa.png', Buffer.from('bytes-da-capa'));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({ ok: true, works: 1 });
    expect(loadLibrary().map((work) => work.id)).toEqual(['restaurada']);
    expect(fs.readFileSync(coversPath('capa.png')).toString('utf-8')).toBe('bytes-da-capa');
  });

  it('descriptografa o backup com a senha configurada', async () => {
    await connect();
    const drive = new FakeDrive();
    const payload = [makeWork({ id: 'cifrada' })];
    drive.seed('library.json', encryptForTest(Buffer.from(JSON.stringify(payload)), PASSPHRASE));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({ ok: true, works: 1 });
    expect(loadLibrary()[0]?.id).toBe('cifrada');
  });

  it('recusa senha de criptografia errada', async () => {
    await connect();
    const drive = new FakeDrive();
    const payload = [makeWork({ id: 'cifrada' })];
    drive.seed('library.json', encryptForTest(Buffer.from(JSON.stringify(payload)), 'outra-senha'));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({
      ok: false,
      error: 'Senha de criptografia incorreta ou backup corrompido.',
    });
  });

  it('falha quando não há library.json no Drive', async () => {
    await connect();
    const drive = new FakeDrive();
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Nenhum backup encontrado no espaço oculto do Drive.',
    });
  });

  it('falha quando o backup não é uma lista de obras válida', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.seed('library.json', Buffer.from(JSON.stringify([{ id: 42 }])));
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Backup inválido (library.json corrompido).',
    });
  });

  it('falha quando o conteúdo nem é uma lista', async () => {
    await connect();
    const drive = new FakeDrive();
    drive.seed('library.json', Buffer.from(JSON.stringify({ obras: [] })));
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Backup inválido (library.json corrompido).',
    });
  });

  it('reporta erro da API durante a restauração', async () => {
    await connect();
    stubFetch(() => json({ error: { message: 'Sem permissão.' } }, 403));
    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({ ok: false, error: 'Sem permissão.' });
    expect(getStatus().lastError).toBe('Sem permissão.');
  });
});
