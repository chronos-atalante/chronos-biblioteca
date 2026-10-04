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
  listCoverFiles,
  loadLibrary,
  mimeFor,
  newId,
  readCoverBuffer,
  restoreLibrary,
  saveLibrary,
  upsertWork,
  userDataDir,
} from '../../src/main/library';
import { makeDraft, makeWork, flushAsync } from '../helpers/fixtures';
import { resetSandbox, sandboxPath } from '../helpers/sandbox';

function writeCoversDirFile(name: string, content = 'img'): void {
  fs.mkdirSync(coversDir(), { recursive: true });
  fs.writeFileSync(path.join(coversDir(), name), content, 'utf-8');
}

describe('diretórios XDG', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('usa as variáveis XDG quando definidas', () => {
    expect(dataDir()).toBe(path.join(sandboxPath('XDG_DATA_HOME'), 'webtoons-biblioteca'));
    expect(configDir()).toBe(path.join(sandboxPath('XDG_CONFIG_HOME'), 'webtoons-biblioteca'));
    expect(cacheDir()).toBe(path.join(sandboxPath('XDG_CACHE_HOME'), 'webtoons-biblioteca'));
    expect(userDataDir()).toBe(dataDir());
  });

  it('cai para HOME quando a variável XDG está vazia', () => {
    const original = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = '';
    try {
      expect(dataDir()).toBe(path.join(os.homedir(), '.local', 'share', 'webtoons-biblioteca'));
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
  beforeEach(() => {
    resetSandbox();
  });

  it('loadLibrary devolve lista vazia quando não existe arquivo', () => {
    expect(loadLibrary()).toEqual([]);
  });

  it('loadLibrary devolve lista vazia para JSON inválido', () => {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(path.join(dataDir(), 'library.json'), '{ quebrado', 'utf-8');
    expect(loadLibrary()).toEqual([]);
  });

  it('loadLibrary devolve lista vazia quando o arquivo não é uma lista', () => {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(path.join(dataDir(), 'library.json'), '{"title":"x"}', 'utf-8');
    expect(loadLibrary()).toEqual([]);
  });

  it('saveLibrary e loadLibrary fazem round-trip', () => {
    const works = [makeWork()];
    expect(saveLibrary(works)).toEqual(works);
    expect(loadLibrary()).toEqual(works);
    expect(fs.existsSync(path.join(dataDir(), 'library.json'))).toBe(true);
    expect(fs.existsSync(path.join(dataDir(), 'library.json.tmp'))).toBe(false);
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
    const works = upsertWork(
      makeDraft({ id: 'beta', createdAt: '2020-01-01T00:00:00.000Z' }),
    );
    expect(works[0]?.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });

  it('upsertWork normaliza progresso inválido', () => {
    const works = upsertWork(makeDraft({ id: 'gamma', progress: Number.NaN }));
    expect(works[0]?.progress).toBe(0);
  });

  it('upsertWork remove a capa anterior quando troca de capa', async () => {
    writeCoversDirFile('antiga.png');
    upsertWork(makeDraft({ id: 'delta', coverFile: 'antiga.png' }));
    writeCoversDirFile('nova.png');
    upsertWork(makeDraft({ id: 'delta', coverFile: 'nova.png' }));
    await flushAsync();
    expect(fs.existsSync(path.join(coversDir(), 'antiga.png'))).toBe(false);
    expect(fs.existsSync(path.join(coversDir(), 'nova.png'))).toBe(true);
  });

  it('upsertWork mantém capa ainda em uso por outra obra', () => {
    writeCoversDirFile('comum.png');
    upsertWork(makeDraft({ id: 'e1', coverFile: 'comum.png' }));
    upsertWork(makeDraft({ id: 'e2', coverFile: 'comum.png' }));
    expect(fs.existsSync(path.join(coversDir(), 'comum.png'))).toBe(true);
  });

  it('upsertWork remove capas órfãs que ninguém referencia', async () => {
    writeCoversDirFile('orfã.png');
    upsertWork(makeDraft({ id: 'f1' }));
    await flushAsync();
    expect(fs.existsSync(path.join(coversDir(), 'orfã.png'))).toBe(false);
  });

  it('deleteWork remove a obra e a capa associada', async () => {
    writeCoversDirFile('capa.png');
    upsertWork(makeDraft({ id: 'removivel', coverFile: 'capa.png' }));
    const works = deleteWork('removivel');
    expect(works).toEqual([]);
    expect(loadLibrary()).toEqual([]);
    await flushAsync();
    expect(fs.existsSync(path.join(coversDir(), 'capa.png'))).toBe(false);
  });

  it('deleteWork de obra inexistente mantém o restante intacto', () => {
    upsertWork(makeDraft({ id: 'sobrevivente' }));
    expect(deleteWork('inexistente')).toHaveLength(1);
  });

  it('deleteWork de obra sem capa não tenta limpar arquivo', () => {
    upsertWork(makeDraft({ id: 'sem-capa' }));
    expect(deleteWork('sem-capa')).toEqual([]);
  });
});

describe('capas', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('importCover devolve null para arquivo inexistente', () => {
    expect(importCover('/caminho/que/nao/existe.png')).toBeNull();
  });

  it('importCover rejeita origem que é um diretório', () => {
    expect(importCover(os.tmpdir())).toBeNull();
  });

  it('importCover copia mantendo a extensão permitida', () => {
    const source = path.join(os.tmpdir(), `webtoons-src-${Date.now()}.jpg`);
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
    const source = path.join(os.tmpdir(), `webtoons-src-${Date.now()}.svg`);
    fs.writeFileSync(source, '<svg/>', 'utf-8');
    try {
      const name = importCover(source, 'svg-id');
      expect(name).toBe('svg-id.png');
    } finally {
      fs.rmSync(source, { force: true });
    }
  });

  it('importCover gera id próprio quando não recebe id preferido', () => {
    const source = path.join(os.tmpdir(), `webtoons-src-${Date.now()}.png`);
    fs.writeFileSync(source, 'x', 'utf-8');
    try {
      const name = importCover(source);
      expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
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
  beforeEach(() => {
    resetSandbox();
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
});

describe('backupFiles / mimeFor', () => {
  beforeEach(() => {
    resetSandbox();
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
  beforeEach(() => {
    resetSandbox();
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
