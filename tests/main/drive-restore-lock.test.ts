import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreNow } from '@zero/main/drive';
import { PassphraseError, decryptWith, encryptWith } from '@zero/main/drive/crypto';
import {
  registerRestoreFailure,
  resetRestoreLock,
  restoreLockRemainingSec,
} from '@zero/main/drive/restore-lock';
import { makeWork } from '../helpers/fixtures.ts';
import { FakeDropbox, PASSPHRASE, connect, json, resetDrive, stubFetch } from '../helpers/drive.ts';

describe('trava exponencial da restauração', () => {
  /** Relógio congelado: a trava mede o tempo por `Date.now`. */
  let now = 0;

  beforeEach(() => {
    resetRestoreLock();
    now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRestoreLock();
  });

  it('duas falhas seguidas de senha ficam livres de trava', () => {
    registerRestoreFailure();
    registerRestoreFailure();
    expect(restoreLockRemainingSec()).toBe(0);
  });

  it('a espera só começa na terceira falha e cresce até saturar em 15 min', () => {
    for (const delay of [0, 0, 10, 30, 60, 300, 900, 900]) {
      registerRestoreFailure();
      expect(restoreLockRemainingSec()).toBe(delay);
    }
  });

  it('libera sozinha assim que a espera acabar', () => {
    registerRestoreFailure();
    registerRestoreFailure();
    registerRestoreFailure();
    expect(restoreLockRemainingSec()).toBe(10);

    now += 9_000;
    expect(restoreLockRemainingSec()).toBe(1);
    now += 1_000;
    expect(restoreLockRemainingSec()).toBe(0);
  });

  it('reset zera tentativas e trava', () => {
    registerRestoreFailure();
    registerRestoreFailure();
    registerRestoreFailure();
    expect(restoreLockRemainingSec()).toBe(10);

    resetRestoreLock();
    expect(restoreLockRemainingSec()).toBe(0);
    registerRestoreFailure();
    expect(restoreLockRemainingSec()).toBe(0);
  });

  it('senha errada lança PassphraseError, para contar na trava', () => {
    const blob = encryptWith(Buffer.from('conteudo-do-backup'), 'senha-certa');
    expect(decryptWith(blob, 'senha-certa').toString('utf-8')).toBe('conteudo-do-backup');
    expect(() => decryptWith(blob, 'senha-certa-errada')).toThrow(PassphraseError);
  });
});

describe('restoreNow com a trava', { timeout: 60_000 }, () => {
  const WRONG_PASSPHRASE_ERROR = 'Senha de criptografia incorreta ou backup corrompido.';
  const LOCKED_ERROR =
    'Muitas tentativas de restauração com senha errada. Tente novamente em 10 segundos.';

  beforeEach(async () => {
    await resetDrive();
    resetRestoreLock();
  });

  afterEach(() => {
    resetRestoreLock();
  });

  function seedEncrypted(drive: FakeDropbox, passphrase: string): void {
    const payload = JSON.stringify([makeWork({ id: 'restaurada' })]);
    drive.seed('library.json', encryptWith(Buffer.from(payload), passphrase));
  }

  it('recusa a tentativa travada antes de qualquer chamada de rede', async () => {
    await connect();
    const drive = new FakeDropbox();
    seedEncrypted(drive, PASSPHRASE);
    const calls = stubFetch((call) => drive.handle(call));
    registerRestoreFailure();
    registerRestoreFailure();
    registerRestoreFailure();

    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({ ok: false, error: LOCKED_ERROR });
    expect(calls).toHaveLength(0);
  });

  it('erro de rede não conta como falha de senha na trava', async () => {
    await connect();
    const drive = new FakeDropbox();
    seedEncrypted(drive, 'outra-senha');
    stubFetch((call) => drive.handle(call));

    expect((await restoreNow(PASSPHRASE)).error).toBe(WRONG_PASSPHRASE_ERROR);
    expect((await restoreNow(PASSPHRASE)).error).toBe(WRONG_PASSPHRASE_ERROR);
    expect(restoreLockRemainingSec()).toBe(0);

    stubFetch(() => json({ error_summary: 'erro-de-rede' }, 503));
    expect(await restoreNow(PASSPHRASE)).toEqual({ ok: false, error: 'erro-de-rede' });
    expect(restoreLockRemainingSec()).toBe(0);
  });

  it('restauração bem-sucedida zera tentativas anteriores', async () => {
    await connect();
    const drive = new FakeDropbox();
    seedEncrypted(drive, 'outra-senha');
    stubFetch((call) => drive.handle(call));
    expect((await restoreNow(PASSPHRASE)).error).toBe(WRONG_PASSPHRASE_ERROR);
    expect((await restoreNow(PASSPHRASE)).error).toBe(WRONG_PASSPHRASE_ERROR);
    expect(restoreLockRemainingSec()).toBe(0);

    drive.files.clear();
    seedEncrypted(drive, PASSPHRASE);
    expect(await restoreNow(PASSPHRASE)).toEqual({ ok: true, works: 1 });

    registerRestoreFailure();
    expect(restoreLockRemainingSec()).toBe(0);
  });
});
