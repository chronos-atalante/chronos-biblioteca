import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { backupInfo, backupNow, restoreNow } from '@zero/main/drive';
import { MANIFEST_FILE, decryptWith, nameKeyFor, remoteName } from '@zero/main/drive/crypto';
import { coversDir, dataDir, loadLibrary, saveLibrary } from '@zero/main/library';
import { makeWork } from '../helpers/fixtures.ts';
import { FakeDrive, PASSPHRASE, connect, resetDrive, stubFetch } from '../helpers/drive.ts';

function remoteIdFor(drive: FakeDrive, hmac: string): string {
  const found = [...drive.files.keys()].find((id) => id.replace(/^remote-(?:\d+-)?/, '') === hmac);
  if (found === undefined) throw new Error(`Arquivo remoto ausente no teste: ${hmac}`);
  return found;
}

function remoteNames(drive: FakeDrive): string[] {
  return [...drive.files.keys()].map((id) => id.replace(/^remote-(?:\d+-)?/, ''));
}

async function backupWithCover(): Promise<FakeDrive> {
  await connect();
  fs.writeFileSync(path.join(coversDir(), 'capa.png'), 'bytes-da-capa');
  saveLibrary([makeWork({ id: 'obra-1', coverFile: 'capa.png' })]);
  const drive = new FakeDrive();
  stubFetch((call) => drive.handle(call));
  const result = await backupNow();
  expect(result.ok).toBe(true);
  return drive;
}

describe('nomes remotos opacos', { timeout: 60_000 }, () => {
  beforeEach(() => {
    resetDrive();
  });

  it('backup sobe só nomes opacos com manifesto cifrado', async () => {
    const drive = await backupWithCover();
    const key = nameKeyFor(PASSPHRASE);
    const names = remoteNames(drive);

    expect(names).toHaveLength(3);
    expect(names).toContain(remoteName('library.json', key));
    expect(names).toContain(remoteName('capa.png', key));
    expect(names).toContain(remoteName(MANIFEST_FILE, key));

    const manifestId = remoteIdFor(drive, remoteName(MANIFEST_FILE, key));
    const manifestEntry = drive.files.get(manifestId);
    if (manifestEntry === undefined) throw new Error('Manifesto ausente no teste.');
    const mapping = JSON.parse(
      decryptWith(manifestEntry.content, PASSPHRASE).toString('utf-8'),
    ) as Record<string, string>;
    expect(mapping).toEqual({
      [remoteName('library.json', key)]: 'library.json',
      [remoteName('capa.png', key)]: 'capa.png',
    });
  });

  it('restaura ponta a ponta a partir de nomes opacos', async () => {
    await backupWithCover();
    fs.rmSync(path.join(dataDir(), 'library.json'), { force: true });
    fs.rmSync(path.join(dataDir(), 'covers'), { recursive: true, force: true });

    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({ ok: true, works: 1 });
    expect(loadLibrary().map((work) => work.id)).toEqual(['obra-1']);
    expect(fs.readFileSync(path.join(coversDir(), 'capa.png'), 'utf-8')).toBe('bytes-da-capa');
  });

  it('manifesto adulterado falha fechado', async () => {
    const drive = await backupWithCover();
    const key = nameKeyFor(PASSPHRASE);
    const manifestId = remoteIdFor(drive, remoteName(MANIFEST_FILE, key));
    const manifestEntry = drive.files.get(manifestId);
    if (manifestEntry === undefined) throw new Error('Manifesto ausente no teste.');
    const tampered = Buffer.from(manifestEntry.content);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    manifestEntry.content = tampered;

    fs.rmSync(path.join(dataDir(), 'library.json'), { force: true });
    const result = await restoreNow(PASSPHRASE);
    expect(result).toEqual({
      ok: false,
      error: 'Senha de criptografia incorreta ou backup corrompido.',
    });
  });

  it('backupInfo resolve a biblioteca via manifesto', async () => {
    const drive = await backupWithCover();
    const key = nameKeyFor(PASSPHRASE);

    const info = await backupInfo();
    expect(info?.name).toBe('library.json');
    expect(info?.works).toBe(1);
    expect(info?.id).toBe(remoteIdFor(drive, remoteName('library.json', key)));
  });
});
