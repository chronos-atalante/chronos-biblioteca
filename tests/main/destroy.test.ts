import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createVault,
  destroyVault,
  isVaultDestroyed,
  unlockVault,
  vaultPath,
} from '@zero/main/vault';
import { VaultError, isVaultError } from '@zero/main/vault/errors';
import { setSecret } from '@zero/main/vault/vault';
import {
  coversDir,
  loadLibrary,
  resetLibrary,
  saveLibrary,
  writeCoverFile,
} from '@zero/main/library';
import { sweepLegacySecrets, sweepPlaintextLibrary, sweepStaleTempFiles } from '@zero/main/cleanup';
import { configDir, dataDir } from '@zero/main/paths';
import { FAST_KDF, PASSWORD } from '../helpers/vault.ts';
import { makeWork } from '../helpers/fixtures.ts';
import { resetSandbox } from '../helpers/sandbox.ts';

/**
 * Destruição de dados: o que precisa ser provado é que **não dá para voltar**
 * e que **nada recria** o que foi apagado por acidente.
 *
 * "O arquivo sumiu" é o teste fraco. Os que importam aqui são: o shred
 * realmente sobrescreveu, o container não renasce depois do destroy, e a
 * varredura de legados não toca nos dados vivos.
 */

async function expectVaultError(run: () => unknown, code: string): Promise<void> {
  try {
    await run();
  } catch (error) {
    expect(isVaultError(error) && error.code).toBe(code);
    return;
  }
  throw new Error(`esperava ${code}`);
}

describe('destruição do cofre', () => {
  beforeEach(async () => {
    resetSandbox();
    // `destroyVault` do import anterior não existe ainda na primeira volta:
    // `createVault` limpa a marca de destruição, então a ordem basta.
    destroyVault();
    await createVault(PASSWORD, FAST_KDF);
  });

  it('apaga o container e o temporário do cofre', () => {
    setSecret('qualquer', 'valor');
    expect(fs.existsSync(vaultPath())).toBe(true);
    expect(fs.existsSync(`${vaultPath()}.tmp`)).toBe(false);

    destroyVault();

    expect(fs.existsSync(vaultPath())).toBe(false);
    expect(fs.existsSync(`${vaultPath()}.tmp`)).toBe(false);
    expect(isVaultDestroyed()).toBe(true);
  });

  it('apaga um temporário órfão que carrega a chave embrulhada', () => {
    const tmp = `${vaultPath()}.tmp`;
    fs.writeFileSync(tmp, Buffer.from('blob-de-chave-embrulhada'), { mode: 0o600 });

    destroyVault();

    expect(fs.existsSync(tmp)).toBe(false);
  });

  it('não recria o container depois da destruição', async () => {
    destroyVault();

    // Nenhum caminho de escrita pode ressuscitar o cofre sem `createVault`.
    await expectVaultError(() => setSecret('qualquer', 'valor'), 'vaultLocked');
    expect(fs.existsSync(vaultPath())).toBe(false);
    expect(isVaultDestroyed()).toBe(true);
  });

  it('só createVault limpa a marca de destruição', async () => {
    destroyVault();
    await createVault(PASSWORD, FAST_KDF);
    expect(isVaultDestroyed()).toBe(false);

    setSecret('segredo', 'valor');
    expect(fs.existsSync(vaultPath())).toBe(true);
  });

  it('depois de destruído, desbloquear não ressuscita nem recusa como adulterado', async () => {
    destroyVault();
    // Sem arquivo, o desbloqueio é "cofre ausente", não "adulterado": é a
    // diferença entre uma mensagem honesta e uma falha de instalação.
    await expectVaultError(() => unlockVault(PASSWORD), 'vaultMissing');
    expect(fs.existsSync(vaultPath())).toBe(false);
  });
});

describe('destruição do acervo', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await createVault(PASSWORD, FAST_KDF);
  });

  it('apaga biblioteca e capas, deixando as pastas utilizáveis', () => {
    saveLibrary([makeWork({ title: 'obra' })]);
    writeCoverFile('a.png', Buffer.from('capa-a'));
    writeCoverFile('b.png', Buffer.from('capa-b'));

    resetLibrary();

    expect(loadLibrary()).toEqual([]);
    expect(fs.readdirSync(coversDir())).toEqual([]);
    expect(fs.statSync(coversDir()).isDirectory()).toBe(true);
    // Dá para gravar de novo depois do reset.
    expect(saveLibrary([makeWork({ title: 'depois' })])).toHaveLength(1);
  });

  it('sem cofre aberto, o acervo não é tocado', async () => {
    saveLibrary([makeWork({ title: 'preservado' })]);
    const file = path.join(dataDir(), 'library.enc');
    destroyVault();

    await expectVaultError(() => resetLibrary(), 'vaultLocked');
    expect(fs.existsSync(file)).toBe(true);
  });
});

describe('varredura de legados', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('apaga tokens e cofre antigo em claro', () => {
    const config = configDir();
    fs.mkdirSync(path.join(config, '.vault'), { recursive: true });
    fs.writeFileSync(path.join(config, 'dropbox-tokens.json'), '{"accessToken":"abc"}');
    fs.writeFileSync(path.join(config, 'drive-tokens.json'), '{"accessToken":"def"}');
    fs.writeFileSync(path.join(config, '.vault', 'vault.zkv'), 'chave-em-claro');

    const result = sweepLegacySecrets();

    expect(result).toEqual({ shredded: 3, failed: 0 });
    expect(fs.existsSync(path.join(config, 'dropbox-tokens.json'))).toBe(false);
    expect(fs.existsSync(path.join(config, 'drive-tokens.json'))).toBe(false);
    expect(fs.existsSync(path.join(config, '.vault'))).toBe(false);
  });

  it('apaga settings.json legado, que guardava a chave do backup em claro', () => {
    const config = configDir();
    fs.mkdirSync(config, { recursive: true });
    fs.writeFileSync(path.join(config, 'settings.json'), '{"language":"pt-BR","enc":"chave"}');

    expect(sweepLegacySecrets().shredded).toBe(1);
    expect(fs.existsSync(path.join(config, 'settings.json'))).toBe(false);
  });

  it('NÃO toca no settings.json vivo, que só tem o idioma', () => {
    const config = configDir();
    fs.mkdirSync(config, { recursive: true });
    const live = path.join(config, 'settings.json');
    fs.writeFileSync(live, '{"language":"pt-BR"}');

    expect(sweepLegacySecrets().shredded).toBe(0);
    expect(fs.existsSync(live)).toBe(true);
  });

  it('NÃO toca no acervo nem no cofre atual', async () => {
    destroyVault();
    await createVault(PASSWORD, FAST_KDF);
    saveLibrary([makeWork()]);
    const library = path.join(dataDir(), 'library.enc');
    const vault = vaultPath();

    sweepLegacySecrets();

    expect(fs.existsSync(library)).toBe(true);
    expect(fs.existsSync(vault)).toBe(true);
    expect(loadLibrary()).toHaveLength(1);
  });

  it('rodar sem nenhum resto não é erro', () => {
    expect(sweepLegacySecrets()).toEqual({ shredded: 0, failed: 0 });
  });
});

describe('varredura do acervo em claro', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('apaga o library.json e as capas em claro da versão anterior', async () => {
    destroyVault();
    await createVault(PASSWORD, FAST_KDF);
    const data = dataDir();
    fs.mkdirSync(path.join(data, 'covers'), { recursive: true });
    fs.writeFileSync(path.join(data, 'library.json'), '[{"title":"em claro"}]');
    fs.writeFileSync(path.join(data, 'covers', 'antiga.png'), 'capa-em-claro');

    const result = sweepPlaintextLibrary();

    expect(result).toEqual({ shredded: 2, failed: 0 });
    expect(fs.existsSync(path.join(data, 'library.json'))).toBe(false);
    expect(fs.existsSync(path.join(data, 'covers', 'antiga.png'))).toBe(false);
  });

  it('NÃO toca no acervo cifrado de hoje', async () => {
    destroyVault();
    await createVault(PASSWORD, FAST_KDF);
    saveLibrary([makeWork()]);
    writeCoverFile('capa.png', Buffer.from('cifrada'));
    const library = path.join(dataDir(), 'library.enc');
    const cover = path.join(coversDir(), 'capa.png.enc');

    expect(sweepPlaintextLibrary()).toEqual({ shredded: 0, failed: 0 });
    expect(fs.existsSync(library)).toBe(true);
    expect(fs.existsSync(cover)).toBe(true);
    expect(loadLibrary()).toHaveLength(1);
  });

  it('sem pasta de capas, apaga só o library.json', () => {
    const data = dataDir();
    fs.mkdirSync(data, { recursive: true });
    fs.writeFileSync(path.join(data, 'library.json'), '[]');
    expect(sweepPlaintextLibrary()).toEqual({ shredded: 1, failed: 0 });
  });
});

describe('varredura de temporários órfãos', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('apaga .tmp mais velho que o limite e preserva o novo', () => {
    const dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    const antigo = path.join(dir, 'library.enc.tmp');
    const novo = path.join(dir, 'outro.tmp');
    fs.writeFileSync(antigo, 'velho');
    fs.writeFileSync(novo, 'novo');
    const passado = Date.now() - 10_000_000;
    fs.utimesSync(antigo, passado / 1000, passado / 1000);

    sweepStaleTempFiles(vaultPath(), 60 * 60_000);

    expect(fs.existsSync(antigo)).toBe(false);
    expect(fs.existsSync(novo)).toBe(true);
  });

  it('não apaga arquivo que não é .tmp', () => {
    const dir = dataDir();
    fs.mkdirSync(dir, { recursive: true });
    const library = path.join(dir, 'library.enc');
    fs.writeFileSync(library, 'cifrado');

    sweepStaleTempFiles(vaultPath(), 0);

    expect(fs.existsSync(library)).toBe(true);
  });
});

describe('Erro de domínio', () => {
  it('expõe code e retryInMs', () => {
    const error = new VaultError('vaultLockedOut', 5000);
    expect(error.code).toBe('vaultLockedOut');
    expect(error.retryInMs).toBe(5000);
    expect(new VaultError('vaultLocked').retryInMs).toBeNull();
  });
});
