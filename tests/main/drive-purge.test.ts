import { beforeEach, describe, expect, it } from 'vitest';
import { getStatus, purgeRemote } from '@zero/main/drive';
import { lockVault } from '@zero/main/vault';
import { json, FakeDropbox, connect, resetDrive, stubFetch } from '../helpers/drive.ts';

/**
 * Apagar o backup na nuvem é a única forma de o usuário realmente remover os
 * dados de lá: `disconnect()` só limpa a sessão local.
 *
 * O que precisa ser provado aqui é o que a operação **promete** e o que ela
 * **recusa**:
 *
 * - apaga tudo da App folder, sem depender da senha de backup;
 * - falha parcial é contada, não escondida;
 * - tokens locais **não** são zerados quando a nuvem falha, porque aí ainda
 *   há o que apagar;
 * - sem cofre aberto não age (não há token para usar).
 */

function seedThree(drive: FakeDropbox): void {
  drive.seed('blobs-opacos-1', Buffer.from('a'));
  drive.seed('blobs-opacos-2', Buffer.from('b'));
  drive.seed('manifesto-opaco', Buffer.from('c'));
}

describe('purgeRemote', () => {
  beforeEach(async () => {
    await resetDrive();
  });

  it('apaga todos os arquivos da App folder', async () => {
    await connect();
    const drive = new FakeDropbox();
    seedThree(drive);
    stubFetch((call) => drive.handle(call));

    const result = await purgeRemote();

    expect(result).toEqual({ ok: true, deleted: 3, failed: 0 });
    expect(drive.files.size).toBe(0);
  });

  it('desconecta a sessão local quando tudo é apagado', async () => {
    await connect();
    const drive = new FakeDropbox();
    seedThree(drive);
    stubFetch((call) => drive.handle(call));

    await purgeRemote();

    expect(getStatus().connected).toBe(false);
  });

  it('não apaga nada sem conta conectada', async () => {
    const drive = new FakeDropbox();
    seedThree(drive);
    stubFetch((call) => drive.handle(call));

    const result = await purgeRemote();

    expect(result.ok).toBe(false);
    expect(result.deleted).toBe(0);
    // Os arquivos continuam lá: nada foi tentado.
    expect(drive.files.size).toBe(3);
  });

  it('não age com o cofre fechado, mesmo com conta conectada', async () => {
    await connect();
    const drive = new FakeDropbox();
    seedThree(drive);
    stubFetch((call) => drive.handle(call));
    lockVault();

    const result = await purgeRemote();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('cofre está fechado');
    expect(drive.files.size).toBe(3);
  });

  it('conta a falha parcial e mantém a sessão conectada para tentar de novo', async () => {
    await connect();
    const drive = new FakeDropbox();
    seedThree(drive);

    let failuresLeft = 2;
    stubFetch((call) => {
      const response = drive.handle(call);
      if (call.url.endsWith('/files/delete_v2') && failuresLeft > 0) {
        failuresLeft -= 1;
        return json({ error_summary: 'internal_error' }, 500);
      }
      return response;
    });

    const result = await purgeRemote();

    expect(result.ok).toBe(false);
    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.error).toContain('1');
    expect(result.error).toContain('2');
    // Ainda dá para apagar o que faltou: a conta segue conectada.
    expect(getStatus().connected).toBe(true);
  });

  it('não zera os tokens locais quando a listagem remota falha', async () => {
    await connect();
    stubFetch(() => json({ error_summary: 'internal_error' }, 500));

    const result = await purgeRemote();

    expect(result.ok).toBe(false);
    expect(result.deleted).toBe(0);
    expect(getStatus().connected).toBe(true);
  });
});
