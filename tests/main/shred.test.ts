import fs from 'fs';
import path from 'path';
import os from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHRED_PASSES, shredDirectory, shredFile } from '@zero/main/shred';

/**
 * `shred.ts` é o único lugar do app que sobrescreve arquivo antes de apagar.
 * O que importa testar aqui não é "o arquivo sumiu" (isso `unlink` já faz),
 * e sim: o conteúdo intermediário **não** é o original, o symlink **não** é
 * seguido, e nada lança quando o alvo não existe.
 */

let root = '';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'cronologia-shred-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function write(name: string, content: string): string {
  const file = path.join(root, name);
  fs.writeFileSync(file, content);
  return file;
}

describe('shredFile', () => {
  it('apaga o arquivo', () => {
    const file = write('alvo.txt', 'conteudo secreto');
    expect(shredFile(file)).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('nunca escreve o conteúdo original de volta no arquivo', () => {
    // Maior que o bloco de 64 KiB, para a sobrescrita passar por vários
    // blocos e o teste não depender só do primeiro.
    const secret = 'sinopse-que-nao-pode-sobrar-'.repeat(6000);
    const file = write('obra.txt', secret);

    // O shred é síncrono e bloqueia o event loop, então "observar de fora"
    // durante a execução não funciona. O que importa é inspecionar **os bytes
    // que foram realmente escritos** no arquivo.
    const original = fs.writeSync;
    const chunks: Buffer[] = [];
    const spy = vi.spyOn(fs, 'writeSync').mockImplementation(((
      fd: number,
      chunk: Buffer,
      offset: number,
      length: number,
      position: number | null,
    ) => {
      chunks.push(Buffer.from(chunk.subarray(offset, offset + length)));
      return original(fd, chunk, offset, length, position);
    }) as unknown as typeof fs.writeSync);

    try {
      shredFile(file, 1);
    } finally {
      spy.mockRestore();
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.some((chunk) => chunk.includes(Buffer.from(secret)))).toBe(false);
    // Com um passe só, o padrão é aleatório: nenhuma escrita pode ser zero.
    expect(chunks.some((chunk) => chunk.equals(Buffer.alloc(chunk.length)))).toBe(false);
  });

  it('termina o shred em zeros, para não deixar padrão reconhecível', () => {
    const file = write('zeros.txt', 'conteudo');
    const original = fs.writeSync;
    const chunks: Buffer[] = [];
    const spy = vi.spyOn(fs, 'writeSync').mockImplementation(((
      fd: number,
      chunk: Buffer,
      offset: number,
      length: number,
      position: number | null,
    ) => {
      chunks.push(Buffer.from(chunk.subarray(offset, offset + length)));
      return original(fd, chunk, offset, length, position);
    }) as unknown as typeof fs.writeSync);

    try {
      shredFile(file, 2);
    } finally {
      spy.mockRestore();
    }

    // 2 passes: o primeiro aleatório, o segundo (índice ímpar) de zeros.
    const last = chunks[chunks.length - 1];
    expect(last).toBeDefined();
    expect(last?.equals(Buffer.alloc(last.length))).toBe(true);
  });

  it('não segue symlink: o alvo fora continua intacto', () => {
    const alvo = write('fora.txt', 'nao pode ser sobrescrito');
    const link = path.join(root, 'atalho');
    fs.symlinkSync(alvo, link);

    expect(shredFile(link)).toBe(false);
    expect(fs.readFileSync(alvo, 'utf-8')).toBe('nao pode ser sobrescrito');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
  });

  it('devolve false sem lançar para arquivo inexistente', () => {
    expect(shredFile(path.join(root, 'nao-existe.txt'))).toBe(false);
  });

  it('devolve false sem lançar quando o alvo é diretório', () => {
    const dir = path.join(root, 'pasta');
    fs.mkdirSync(dir);
    expect(shredFile(dir)).toBe(false);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('sobrescreve arquivo vazio sem quebrar', () => {
    const file = write('vazio.txt', '');
    expect(shredFile(file)).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('sobrescreve arquivo maior que o bloco de 64 KiB', () => {
    const file = write('grande.bin', 'x'.repeat(200_000));
    expect(shredFile(file)).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('aceita número de passes e recusa valor inválido ou absurdo', () => {
    expect(shredFile(write('um.txt', 'a'), 1)).toBe(true);
    expect(shredFile(write('zero.txt', 'a'), 0)).toBe(true);
    expect(shredFile(write('negativo.txt', 'a'), -5)).toBe(true);
    // 999 passes é limitado pelo teto; o arquivo é sobrescrito e some igual.
    expect(shredFile(write('muitos.txt', 'a'), 999)).toBe(true);
  });

  it('usa o padrão de passes declarado', () => {
    expect(SHRED_PASSES).toBe(3);
  });
});

describe('shredDirectory', () => {
  it('sobrescreve tudo o que é arquivo e remove a pasta', () => {
    const dir = path.join(root, 'covers');
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'a.jpg'), 'imagem-a');
    fs.writeFileSync(path.join(dir, 'b.png'), 'imagem-b');

    const result = shredDirectory(dir);
    expect(result).toEqual({ shredded: 2, failed: 0 });
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('não conta pasta inexistente como falha', () => {
    expect(shredDirectory(path.join(root, 'nao-existe'))).toEqual({ shredded: 0, failed: 0 });
  });
});
