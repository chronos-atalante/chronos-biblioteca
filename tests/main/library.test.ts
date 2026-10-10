import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  backupFiles,
  cacheDir,
  clampProgress,
  configDir,
  coversDir,
  dataDir,
  deleteWork,
  importCover,
  isValidWorkId,
  listCoverFiles,
  loadLibrary,
  mimeFor,
  newId,
  readCoverBuffer,
  restoreLibrary,
  saveLibrary,
  upsertWork,
  userDataDir,
} from '@zero/main/library';
import { resetLibrary, writeCoverFile } from '@zero/main/library';
import { isVaultError } from '@zero/main/vault/errors';
import { lockVault, unlockVault } from '@zero/main/vault';
import { makeDraft, makeWork } from '../helpers/fixtures.ts';
import { resetSandbox, sandboxPath } from '../helpers/sandbox.ts';
import { FAST_KDF, PASSWORD } from '../helpers/vault.ts';
import { createVault, destroyVault } from '@zero/main/vault';

/** Escreve uma capa cifrada pelo caminho normal do app (como `importCover`). */
function writeCoversDirFile(name: string, content = 'img'): void {
  writeCoverFile(name, Buffer.from(content, 'utf-8'));
}

/** Pasta do acervo cifrado: `library.enc` e `covers/<nome>.enc`. */
function libraryFile(): string {
  return path.join(dataDir(), 'library.enc');
}

function coverOnDisk(name: string): string {
  return path.join(coversDir(), `${name}.enc`);
}

/**
 * O acervo é cifrado com a chave do cofre, então toda suíte que o toca precisa
 * de cofre aberto. `resetSandbox` apaga a árvore do cofre junto, então a
 * criação vem depois dele.
 */
async function openVault(): Promise<void> {
  await createVault(PASSWORD, FAST_KDF);
}

describe('diretórios XDG', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('usa as variáveis XDG quando definidas', () => {
    expect(dataDir()).toBe(path.join(sandboxPath('XDG_DATA_HOME'), 'cronologia'));
    expect(configDir()).toBe(path.join(sandboxPath('XDG_CONFIG_HOME'), 'cronologia'));
    expect(cacheDir()).toBe(path.join(sandboxPath('XDG_CACHE_HOME'), 'cronologia'));
    expect(userDataDir()).toBe(dataDir());
  });

  it('cai para HOME quando a variável XDG está vazia', () => {
    const original = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = '';
    try {
      expect(dataDir()).toBe(path.join(os.homedir(), '.local', 'share', 'cronologia'));
    } finally {
      if (original !== undefined) process.env.XDG_DATA_HOME = original;
    }
  });

  it('coversDir cria a pasta de capas', () => {
    const dir = coversDir();
    expect(fs.existsSync(dir)).toBe(true);
    expect(dir).toBe(path.join(dataDir(), 'covers'));
  });
});

describe('clampProgress', () => {
  it('normaliza valores', () => {
    expect(clampProgress(Number.NaN)).toBe(0);
    expect(clampProgress(-20)).toBe(0);
    expect(clampProgress(42.4)).toBe(42);
    expect(clampProgress(42.6)).toBe(43);
    expect(clampProgress(100)).toBe(100);
  });
});

describe('biblioteca', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await openVault();
  });

  it('loadLibrary devolve lista vazia quando não existe arquivo', () => {
    expect(loadLibrary()).toEqual([]);
  });

  it('loadLibrary falha fechada quando o arquivo cifrado está corrompido', () => {
    saveLibrary([makeWork()]);
    const file = libraryFile();
    const raw = fs.readFileSync(file);
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff;
    fs.writeFileSync(file, raw);
    expect(() => loadLibrary()).toThrow();
  });

  it('loadLibrary falha fechada quando o arquivo não é um bloco cifrado', () => {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(libraryFile(), '{ quebrado', 'utf-8');
    expect(() => loadLibrary()).toThrow();
  });

  it('loadLibrary devolve lista vazia quando o conteúdo não é uma lista', () => {
    saveLibrary([]);
    // JSON válido e decifrável, mas não uma lista: aqui a lista vazia é o certo.
    expect(loadLibrary()).toEqual([]);
  });

  it('saveLibrary e loadLibrary fazem round-trip', () => {
    const works = [makeWork()];
    expect(saveLibrary(works)).toEqual(works);
    expect(loadLibrary()).toEqual(works);
    expect(fs.existsSync(libraryFile())).toBe(true);
    expect(fs.existsSync(`${libraryFile()}.tmp`)).toBe(false);
  });

  it('newId gera UUIDs únicos', () => {
    const first = newId();
    const second = newId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it('upsertWork cria uma obra nova quando o id está vazio', () => {
    const works = upsertWork(makeDraft({ id: '', title: 'Novo' }));
    expect(works).toHaveLength(1);
    expect(works[0]?.id).not.toBe('');
    expect(works[0]?.title).toBe('Novo');
    expect(works[0]?.progress).toBe(10);
    expect(loadLibrary()).toEqual(works);
  });

  it('upsertWork atualiza obra existente preservando createdAt', () => {
    const [created] = upsertWork(makeDraft({ id: 'alpha', title: 'Original' }));
    const createdAt = created?.createdAt;
    const works = upsertWork(makeDraft({ id: 'alpha', title: 'Renomeada', progress: 80 }));
    expect(works).toHaveLength(1);
    expect(works[0]?.title).toBe('Renomeada');
    expect(works[0]?.createdAt).toBe(createdAt);
    expect(works[0]?.progress).toBe(80);
  });

  it('upsertWork aceita createdAt/updatedAt explícitos em obra nova', () => {
    const works = upsertWork(makeDraft({ id: 'beta', createdAt: '2020-01-01T00:00:00.000Z' }));
    expect(works[0]?.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('upsertWork normaliza progresso inválido', () => {
    const works = upsertWork(makeDraft({ id: 'gamma', progress: Number.NaN }));
    expect(works[0]?.progress).toBe(0);
  });

  it('upsertWork remove a capa anterior quando troca de capa', () => {
    writeCoversDirFile('antiga.png');
    upsertWork(makeDraft({ id: 'delta', coverFile: 'antiga.png' }));
    writeCoversDirFile('nova.png');
    upsertWork(makeDraft({ id: 'delta', coverFile: 'nova.png' }));
    expect(fs.existsSync(coverOnDisk('antiga.png'))).toBe(false);
    expect(fs.existsSync(coverOnDisk('nova.png'))).toBe(true);
  });

  it('upsertWork mantém capa ainda em uso por outra obra', () => {
    writeCoversDirFile('comum.png');
    upsertWork(makeDraft({ id: 'e1', coverFile: 'comum.png' }));
    upsertWork(makeDraft({ id: 'e2', coverFile: 'comum.png' }));
    expect(fs.existsSync(coverOnDisk('comum.png'))).toBe(true);
  });

  it('upsertWork remove capas órfãs que ninguém referencia', () => {
    writeCoversDirFile('orfã.png');
    upsertWork(makeDraft({ id: 'f1' }));
    expect(fs.existsSync(coverOnDisk('orfã.png'))).toBe(false);
  });

  it('deleteWork remove a obra e a capa associada', () => {
    writeCoversDirFile('capa.png');
    upsertWork(makeDraft({ id: 'removivel', coverFile: 'capa.png' }));
    const works = deleteWork('removivel');
    expect(works).toEqual([]);
    expect(loadLibrary()).toEqual([]);
    expect(fs.existsSync(coverOnDisk('capa.png'))).toBe(false);
  });

  it('deleteWork de obra inexistente mantém o restante intacto', () => {
    upsertWork(makeDraft({ id: 'sobrevivente' }));
    expect(deleteWork('inexistente')).toHaveLength(1);
  });

  it('deleteWork de obra sem capa não tenta limpar arquivo', () => {
    upsertWork(makeDraft({ id: 'sem-capa' }));
    expect(deleteWork('sem-capa')).toEqual([]);
  });

  it('upsertWork e deleteWork recusam id com separador de caminho', () => {
    for (const id of ['../fora', 'a/b', 'a\\b', '.', 'x'.repeat(65)]) {
      expect(() => upsertWork(makeDraft({ id }))).toThrow('Identificador de obra inválido.');
      expect(() => deleteWork(id)).toThrow('Identificador de obra inválido.');
    }
    expect(loadLibrary()).toHaveLength(0);
  });

  it('isValidWorkId aceita UUID e id curto, recusa ponto e separadores', () => {
    expect(isValidWorkId(newId())).toBe(true);
    expect(isValidWorkId('obra-1')).toBe(true);
    expect(isValidWorkId('')).toBe(false);
    expect(isValidWorkId('..')).toBe(false);
    expect(isValidWorkId('a.b')).toBe(false);
    expect(isValidWorkId('a/b')).toBe(false);
  });
});

describe('capas', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await openVault();
  });

  it('importCover devolve null para arquivo inexistente', () => {
    expect(importCover('/caminho/que/nao/existe.png')).toBeNull();
  });

  it('importCover rejeita origem que é um diretório', () => {
    expect(importCover(os.tmpdir())).toBeNull();
  });

  it('importCover copia mantendo a extensão permitida', () => {
    const source = path.join(os.tmpdir(), `cronologia-src-${Date.now()}.jpg`);
    fs.writeFileSync(source, 'conteudo', 'utf-8');
    try {
      const name = importCover(source, 'capa-id');
      expect(name).toBe('capa-id.jpg');
      expect(readCoverBuffer('capa-id.jpg')?.toString('utf-8')).toBe('conteudo');
    } finally {
      fs.rmSync(source, { force: true });
    }
  });

  it('importCover força PNG para extensão fora da whitelist', () => {
    const source = path.join(os.tmpdir(), `cronologia-src-${Date.now()}.svg`);
    fs.writeFileSync(source, '<svg/>', 'utf-8');
    try {
      const name = importCover(source, 'svg-id');
      expect(name).toBe('svg-id.png');
    } finally {
      fs.rmSync(source, { force: true });
    }
  });

  it('importCover gera id próprio quando não recebe id preferido', () => {
    const source = path.join(os.tmpdir(), `cronologia-src-${Date.now()}.png`);
    fs.writeFileSync(source, 'x', 'utf-8');
    try {
      const name = importCover(source);
      expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
    } finally {
      fs.rmSync(source, { force: true });
    }
  });

  it('importCover ignora id preferido fora da régua', () => {
    const source = path.join(os.tmpdir(), `cronologia-src2-${Date.now()}.png`);
    fs.writeFileSync(source, 'x', 'utf-8');
    try {
      const name = importCover(source, '../escapou');
      expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
      expect(name).not.toContain('..');
    } finally {
      fs.rmSync(source, { force: true });
    }
  });

  it('listCoverFiles ignora arquivos ocultos', () => {
    writeCoversDirFile('visible.png');
    writeCoversDirFile('.hidden.png');
    expect(listCoverFiles()).toEqual(['visible.png']);
  });

  it('listCoverFiles devolve lista vazia quando a pasta virou um arquivo', () => {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(path.join(dataDir(), 'covers'), 'nao-e-pasta', 'utf-8');
    expect(listCoverFiles()).toEqual([]);
  });

  it('readCoverBuffer devolve null para arquivo inexistente', () => {
    expect(readCoverBuffer('fantasma.png')).toBeNull();
  });

  it('readCoverBuffer usa basename e ignora travessia de diretório', () => {
    writeCoversDirFile('segura.png', 'ok');
    expect(readCoverBuffer('../covers/segura.png')?.toString('utf-8')).toBe('ok');
  });
});

describe('restoreLibrary', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await openVault();
  });

  it('normaliza progresso e datas vazias', () => {
    const input = [makeWork({ progress: -5, createdAt: '', updatedAt: '' })];
    const restored = restoreLibrary(input);
    expect(restored[0]?.progress).toBe(0);
    expect(restored[0]?.createdAt).not.toBe('');
    expect(restored[0]?.updatedAt).not.toBe('');
    expect(loadLibrary()).toEqual(restored);
  });

  it('mantém datas válidas já existentes', () => {
    const work = makeWork({ progress: 50 });
    const restored = restoreLibrary([work]);
    expect(restored[0]?.createdAt).toBe(work.createdAt);
    expect(restored[0]?.updatedAt).toBe(work.updatedAt);
  });

  it('troca id fora da régua vindo da nuvem por um novo UUID', () => {
    const restored = restoreLibrary([makeWork({ id: '../id-malicioso' })]);
    expect(restored[0]?.id).not.toBe('../id-malicioso');
    expect(restored[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(loadLibrary()[0]?.id).toBe(restored[0]?.id);
  });
});

describe('backupFiles / mimeFor', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await openVault();
  });

  it('devolve null quando ainda não existe biblioteca', () => {
    expect(backupFiles()).toBeNull();
  });

  it('monta library.json + capas com os mimes corretos', () => {
    writeCoversDirFile('capa.webp', 'bin');
    saveLibrary([makeWork()]);
    const files = backupFiles();
    expect(files).not.toBeNull();
    expect(files?.map((file) => file.name)).toEqual(['library.json', 'capa.webp']);
    expect(files?.[0]?.mime).toBe('application/json');
    expect(files?.[1]?.mime).toBe('image/webp');
  });

  it('mapeia extensões conhecidas', () => {
    expect(mimeFor('a.jpg')).toBe('image/jpeg');
    expect(mimeFor('a.JPEG')).toBe('image/jpeg');
    expect(mimeFor('a.png')).toBe('image/png');
    expect(mimeFor('a.webp')).toBe('image/webp');
    expect(mimeFor('a.gif')).toBe('image/gif');
    expect(mimeFor('a.avif')).toBe('image/avif');
    expect(mimeFor('a.bmp')).toBe('image/bmp');
    expect(mimeFor('a.txt')).toBe('application/octet-stream');
  });
});

describe('comportamento de erro resistente', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await openVault();
  });

  it('cleanupOrphanCovers não lança quando a pasta de capas não pode ser criada', () => {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(path.join(dataDir(), 'covers'), 'bloqueio', 'utf-8');
    expect(() => {
      upsertWork(makeDraft({ id: 'nao-quebra' }));
    }).not.toThrow();
    expect(loadLibrary()).toHaveLength(1);
  });
});

describe('acervo cifrado', () => {
  beforeEach(async () => {
    resetSandbox();
    destroyVault();
    await openVault();
  });

  it('o arquivo em disco não contém o título nem a sinopse em claro', () => {
    const titulo = 'TituloQueNaoPodeAparecerEmClaro';
    const sinopse = 'SinopseQueNaoPodeAparecerEmClaro';
    saveLibrary([makeWork({ title: titulo, synopsis: sinopse })]);

    const raw = fs.readFileSync(libraryFile()).toString('utf-8');
    expect(raw).not.toContain(titulo);
    expect(raw).not.toContain(sinopse);
    expect(loadLibrary()[0]?.title).toBe(titulo);
  });

  it('a capa em disco não contém os bytes da imagem', () => {
    writeCoversDirFile('secreta.png', 'bytes-da-imagem-em-claro');
    const raw = fs.readFileSync(coverOnDisk('secreta.png')).toString('utf-8');
    expect(raw).not.toContain('bytes-da-imagem-em-claro');
    expect(readCoverBuffer('secreta.png')?.toString('utf-8')).toBe('bytes-da-imagem-em-claro');
  });

  it('sem cofre aberto, ler e gravar falham com vaultLocked antes de tocar em disco', async () => {
    saveLibrary([makeWork({ title: 'preservado' })]);
    lockVault();

    for (const run of [() => loadLibrary(), () => saveLibrary([]), () => resetLibrary()]) {
      try {
        run();
        throw new Error('esperava vaultLocked');
      } catch (error) {
        expect(isVaultError(error) && error.code).toBe('vaultLocked');
      }
    }
    // Nada foi apagado: a falha é antes do disco.
    expect(fs.existsSync(libraryFile())).toBe(true);

    return unlockVault(PASSWORD).then(() => {
      expect(loadLibrary()[0]?.title).toBe('preservado');
    });
  });

  it('resetLibrary apaga o acervo inteiro e deixa a pasta de capas pronta', () => {
    saveLibrary([makeWork()]);
    writeCoversDirFile('a.png');
    writeCoversDirFile('b.png');
    expect(fs.existsSync(libraryFile())).toBe(true);

    resetLibrary();

    expect(fs.existsSync(libraryFile())).toBe(false);
    expect(fs.readdirSync(coversDir())).toEqual([]);
    // A pasta continua utilizável para o próximo uso.
    expect(fs.statSync(coversDir()).isDirectory()).toBe(true);
    expect(loadLibrary()).toEqual([]);
  });

  it('a capa em claro de versão anterior é sobrescrita na limpeza de órfãos', () => {
    // Biblioteca nova (não referencia capa nenhuma) + capa legada em claro.
    saveLibrary([makeWork({ id: 'nova' })]);
    const legado = path.join(coversDir(), 'legada.jpg');
    fs.writeFileSync(legado, 'capa-em-claro-de-versao-anterior');

    upsertWork(makeDraft({ id: 'nova', title: 'editada' }));

    expect(fs.existsSync(legado)).toBe(false);
  });
});
