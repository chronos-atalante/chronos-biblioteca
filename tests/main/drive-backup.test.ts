import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backupInfo, backupNow, getStatus, restoreNow } from '@zero/main/drive';
import {
  MANIFEST_FILE,
  buildManifest,
  encryptWith,
  manifestKeyFor,
  nameKeyFor,
  remoteName,
} from '@zero/main/drive/crypto';
import { loadLibrary, saveLibrary } from '@zero/main/library';
import { makeWork } from '../helpers/fixtures.ts';
import {
  FakeDropbox,
  LIST_FOLDER_ENDPOINT,
  PASSPHRASE,
  UPLOAD_ENDPOINT,
  bodyField,
  connect,
  coversPath,
  defer,
  headerOf,
  json,
  resetDrive,
  stubFetch,
} from '../helpers/drive.ts';

function uploadedNames(drive: FakeDropbox): string[] {
  return [...drive.files.values()].map((file) => file.name);
}

describe('backupNow', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('exige conta conectada', async () => {
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Conecte a conta Dropbox primeiro.',
    });
  });

  it('exige uma biblioteca local', async () => {
    await connect();
    const drive = new FakeDropbox();
    stubFetch((call) => drive.handle(call));
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
      if (call.url === LIST_FOLDER_ENDPOINT) return gate.promise;
      return json({});
    });
    const first = backupNow();
    await vi.waitFor(() => expect(getStatus().syncing).toBe(true));
    expect(await backupNow()).toEqual({
      ok: false,
      error: 'Sincronização já em andamento.',
    });
    gate.resolve(json({ error_summary: 'cancelado' }, 500));
    const outcome = await first;
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBe('cancelado');
    expect(getStatus().syncing).toBe(false);
  });

  it('exige senha de criptografia antes de enviar', async () => {
    await connect('');
    saveLibrary([makeWork({ id: 'obra-2' })]);
    const drive = new FakeDropbox();
    stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Defina uma senha de criptografia do backup nas configurações.');
    expect(getStatus().lastError).toBe(
      'Defina uma senha de criptografia do backup nas configurações.',
    );
    expect(getStatus().syncing).toBe(false);
  });

  it('envia cifrado para a pasta do app e registra o resumo', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-3', title: 'Título Sigiloso' })]);
    const drive = new FakeDropbox();
    stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(true);
    expect(result.summary?.name).toBe('library.json');
    expect(result.summary?.id).toBe('novo');
    expect(result.summary?.works).toBe(1);
    expect(result.summary?.size ?? 0).toBeGreaterThan(0);
    expect(getStatus().lastSync).not.toBeNull();

    const uploads = [...drive.files.values()].map((file) => file.content);
    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads.some((body) => body.includes(Buffer.from('WTENC3')))).toBe(true);
    expect(uploads.some((body) => body.includes(Buffer.from('Título Sigiloso')))).toBe(false);
  });

  it('envia o upload no contrato exato da API (booleanos de verdade)', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-tipos' })]);
    const drive = new FakeDropbox();
    const calls = stubFetch((call) => drive.handle(call));

    const result = await backupNow();
    expect(result.ok).toBe(true);
    const upload = calls.find((call) => call.url === UPLOAD_ENDPOINT);
    expect(upload).toBeDefined();
    if (upload === undefined) throw new Error('Upload ausente no teste.');
    const arg = JSON.parse(headerOf(upload, 'Dropbox-API-Arg')) as {
      mode?: unknown;
      autorename?: unknown;
      mute?: unknown;
    };
    expect(arg.mode).toBe('overwrite');
    expect(arg.autorename).toBe(false);
    expect(arg.mute).toBe(true);
  });

  it('atualiza arquivos existentes e apaga remotos órfãos', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-4' })]);
    const drive = new FakeDropbox();
    // Manifesto v2 com salt conhecido: os nomes do backup anterior são estáveis.
    const nameSalt = Buffer.alloc(16, 7);
    const key = nameKeyFor(PASSPHRASE, nameSalt);
    const libraryRemote = remoteName('library.json', key);
    const orphanRemote = remoteName('capa-antiga.png', key);
    const libraryId = drive.seed(libraryRemote, Buffer.from('[]'));
    const orphanId = drive.seed(orphanRemote, Buffer.from('png'));
    const legacyId = drive.seed('capa-legada.png', Buffer.from('png'));
    drive.seed(
      remoteName(MANIFEST_FILE, manifestKeyFor(PASSPHRASE)),
      encryptWith(buildManifest({ [libraryRemote]: 'library.json' }, nameSalt), PASSPHRASE),
    );
    const deleted: string[] = [];
    const original = drive.handle.bind(drive);
    stubFetch((call) => {
      if (call.url.endsWith('/files/delete_v2')) {
        const target = bodyField(call, 'path');
        if (target !== '') deleted.push(target);
      }
      return original(call);
    });

    const result = await backupNow();
    expect(result.ok).toBe(true);
    expect(result.summary?.id).toBe(libraryId);
    expect(deleted).toContain(orphanId);
    expect(deleted).toContain(legacyId);
    expect(drive.files.has(orphanId)).toBe(false);
    expect(drive.findByName(libraryRemote)).toBeDefined();
    const names = uploadedNames(drive);
    expect(names).not.toContain('library.json');
    expect(names).not.toContain('capa-antiga.png');
    expect(names).not.toContain('capa-legada.png');
  });

  it('pagina a listagem quando há mais arquivos que o limite', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.pageSize = 2;
    for (let i = 0; i < 5; i += 1) {
      drive.seed(`arquivo-${i}.bin`, Buffer.from([i]));
    }
    const calls = stubFetch((call) => drive.handle(call));

    expect(await backupInfo()).toBeNull();
    const continued = calls.filter((call) => call.url.endsWith('/list_folder/continue'));
    expect(continued.length).toBeGreaterThanOrEqual(2);
  });

  it('traduz falta de escopo em ação concreta', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-escopo' })]);
    stubFetch(() =>
      json(
        {
          error_summary:
            'missing_scope/Your app (ID: 8812259) is not permitted to access this endpoint ' +
            "because it does not have the required scope 'files.metadata.read'",
        },
        400,
      ),
    );
    const result = await backupNow();
    expect(result).toEqual({
      ok: false,
      error:
        'Faltam permissões no app Dropbox. Marque todos os escopos na aba Permissions ' +
        'do App Console, Desconecte e Conecte de novo.',
    });
  });

  it('reporta erro vindo da API do Dropbox', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-5' })]);
    stubFetch(() => json({ error_summary: 'insufficient_space' }, 409));
    const result = await backupNow();
    expect(result).toEqual({ ok: false, error: 'insufficient_space' });
    expect(getStatus().lastError).toBe('insufficient_space');
    expect(getStatus().syncing).toBe(false);
  });

  it('reporta erro sem corpo JSON aproveitável', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-6' })]);
    stubFetch(() => new Response('erro interno', { status: 500 }));
    const result = await backupNow();
    expect(result).toEqual({
      ok: false,
      error: 'Erro do Dropbox (HTTP 500). Resposta: erro interno',
    });
  });
});

describe('restoreNow', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('exige conta conectada', async () => {
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Conecte a conta Dropbox primeiro.',
    });
  });

  it('restaura biblioteca e capas a partir do backup', async () => {
    await connect();
    const drive = new FakeDropbox();
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
    const drive = new FakeDropbox();
    const payload = [makeWork({ id: 'cifrada' })];
    drive.seed('library.json', encryptWith(Buffer.from(JSON.stringify(payload)), PASSPHRASE));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({ ok: true, works: 1 });
    expect(loadLibrary()[0]?.id).toBe('cifrada');
  });

  it('recusa senha de criptografia errada', async () => {
    await connect();
    const drive = new FakeDropbox();
    const payload = [makeWork({ id: 'cifrada' })];
    drive.seed('library.json', encryptWith(Buffer.from(JSON.stringify(payload)), 'outra-senha'));
    stubFetch((call) => drive.handle(call));

    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({
      ok: false,
      error: 'Senha de criptografia incorreta ou backup corrompido.',
    });
  });

  it('falha quando não há library.json no Dropbox', async () => {
    await connect();
    const drive = new FakeDropbox();
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Nenhum backup encontrado na pasta do app no Dropbox.',
    });
  });

  it('falha quando o backup não é uma lista de obras válida', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.seed('library.json', Buffer.from(JSON.stringify([{ id: 42 }])));
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Backup inválido (library.json corrompido).',
    });
  });

  it('falha quando o conteúdo nem é uma lista', async () => {
    await connect();
    const drive = new FakeDropbox();
    drive.seed('library.json', Buffer.from(JSON.stringify({ obras: [] })));
    stubFetch((call) => drive.handle(call));
    expect(await restoreNow(PASSPHRASE)).toEqual({
      ok: false,
      error: 'Backup inválido (library.json corrompido).',
    });
  });

  it('reporta erro da API durante a restauração', async () => {
    await connect();
    stubFetch(() => json({ error_summary: 'no_permission' }, 403));
    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({ ok: false, error: 'no_permission' });
    expect(getStatus().lastError).toBe('no_permission');
  });
});
