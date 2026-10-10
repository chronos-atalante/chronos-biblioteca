import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { backupInfo, backupNow, restoreNow } from '@zero/main/drive';
import {
  MANIFEST_FILE,
  decryptWith,
  encryptWith,
  manifestKeyFor,
  nameKeyFor,
  parseManifest,
  remoteName,
} from '@zero/main/drive/crypto';
import type { Manifest } from '@zero/main/drive/crypto';
import { coversDir, dataDir, loadLibrary, saveLibrary } from '@zero/main/library';
import { makeWork } from '../helpers/fixtures.ts';
import { FakeDropbox, PASSPHRASE, connect, resetDrive, stubFetch } from '../helpers/drive.ts';

function remoteIdFor(drive: FakeDropbox, hmac: string): string {
  const found = drive.findByName(hmac);
  if (found === undefined) throw new Error(`Arquivo remoto ausente no teste: ${hmac}`);
  return found.id;
}

function remoteNames(drive: FakeDropbox): string[] {
  return [...drive.files.values()].map((file) => file.name);
}

/** Baixa e decifra o manifesto usando a chave localizadora (salt fixo). */
function readManifest(drive: FakeDropbox): Manifest {
  const manifestId = remoteIdFor(drive, remoteName(MANIFEST_FILE, manifestKeyFor(PASSPHRASE)));
  const manifestEntry = drive.files.get(manifestId);
  if (manifestEntry === undefined) throw new Error('Manifesto ausente no teste.');
  return parseManifest(decryptWith(manifestEntry.content, PASSPHRASE));
}

async function backupWithCover(): Promise<FakeDropbox> {
  await connect();
  fs.writeFileSync(path.join(coversDir(), 'capa.png'), 'bytes-da-capa');
  saveLibrary([makeWork({ id: 'obra-1', coverFile: 'capa.png' })]);
  const drive = new FakeDropbox();
  stubFetch((call) => drive.handle(call));
  const result = await backupNow();
  expect(result.ok).toBe(true);
  return drive;
}

describe('nomes remotos opacos', { timeout: 60_000 }, () => {
  beforeEach(async () => {
    await resetDrive();
  });

  it('backup sobe só nomes opacos com manifesto cifrado', async () => {
    const drive = await backupWithCover();
    const manifestKey = manifestKeyFor(PASSPHRASE);
    const names = remoteNames(drive);

    expect(names).toHaveLength(3);
    expect(names).toContain(remoteName(MANIFEST_FILE, manifestKey));

    const manifest = readManifest(drive);
    if (manifest.nameSalt === null) throw new Error('Manifesto v1 não era esperado.');
    expect(manifest.nameSalt).toHaveLength(16);

    const key = nameKeyFor(PASSPHRASE, manifest.nameSalt);
    expect(manifest.files).toEqual({
      [remoteName('library.json', key)]: 'library.json',
      [remoteName('capa.png', key)]: 'capa.png',
    });
    expect(names).toContain(remoteName('library.json', key));
    expect(names).toContain(remoteName('capa.png', key));

    // Nem o salt fixo legado (o mesmo que localiza o manifesto) deriva esses
    // nomes: a cadeia de conteúdo usa o salt aleatório do manifesto v2.
    expect(remoteName('library.json', key)).not.toBe(remoteName('library.json', manifestKey));
  });

  it('reaproveita o salt do manifesto e mantém os nomes entre backups', async () => {
    const drive = await backupWithCover();
    const first = remoteNames(drive);
    const firstSalt = readManifest(drive).nameSalt;
    if (firstSalt === null) throw new Error('Manifesto sem salt no teste.');

    const again = await backupNow();
    expect(again.ok).toBe(true);
    expect(remoteNames(drive).sort()).toEqual(first.sort());
    expect(readManifest(drive).nameSalt?.equals(firstSalt)).toBe(true);
  });

  it('migra manifesto v1 (sem salt) para v2 com salt aleatório', async () => {
    await connect();
    saveLibrary([makeWork({ id: 'obra-2' })]);
    const drive = new FakeDropbox();
    stubFetch((call) => drive.handle(call));

    // Backup no formato antigo: nomes com o salt fixo e manifesto sem salt.
    const legacyKey = manifestKeyFor(PASSPHRASE);
    const legacyLibrary = remoteName('library.json', legacyKey);
    const legacyManifest = { [legacyLibrary]: 'library.json' };
    drive.seed(legacyLibrary, Buffer.from('[]'));
    drive.seed(
      remoteName(MANIFEST_FILE, legacyKey),
      encryptWith(Buffer.from(JSON.stringify(legacyManifest), 'utf-8'), PASSPHRASE),
    );

    const result = await backupNow();
    expect(result.ok).toBe(true);

    const manifest = readManifest(drive);
    if (manifest.nameSalt === null) throw new Error('Manifesto não migrou para v2.');
    const key = nameKeyFor(PASSPHRASE, manifest.nameSalt);
    expect(remoteName('library.json', key)).not.toBe(legacyLibrary);
    expect(manifest.files).toEqual({ [remoteName('library.json', key)]: 'library.json' });
    expect(drive.findByName(legacyLibrary)).toBeUndefined();
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
    const manifestId = remoteIdFor(drive, remoteName(MANIFEST_FILE, manifestKeyFor(PASSPHRASE)));
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
    const manifest = readManifest(drive);
    const libraryRemote = Object.entries(manifest.files).find(
      ([, local]) => local === 'library.json',
    )?.[0];
    if (libraryRemote === undefined) throw new Error('library.json ausente do manifesto.');

    const info = await backupInfo();
    expect(info?.name).toBe('library.json');
    expect(info?.works).toBe(1);
    expect(info?.id).toBe(remoteIdFor(drive, libraryRemote));
  });
});
