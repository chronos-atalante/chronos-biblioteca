import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { writeJsonAtomic } from '@zero/main/jsonfile';
import { resetSandbox, sandboxPath } from '../helpers/sandbox.ts';

function target(): string {
  return path.join(sandboxPath('XDG_CONFIG_HOME'), 'cronologia', 'secrets.json');
}

function mode(file: string): number {
  return fs.statSync(file).mode & 0o777;
}

describe('writeJsonAtomic', () => {
  beforeEach(() => {
    resetSandbox();
  });

  it('grava o JSON e não deixa temporário para trás', () => {
    writeJsonAtomic(target(), { a: 1 });
    expect(JSON.parse(fs.readFileSync(target(), 'utf-8'))).toEqual({ a: 1 });
    expect(fs.existsSync(`${target()}.tmp`)).toBe(false);
  });

  it('aplica o mode pedido na criação', () => {
    writeJsonAtomic(target(), { a: 1 }, 0o600);
    expect(mode(target())).toBe(0o600);
  });

  it('reaplica o mode quando o .tmp já existe com permissão maior', () => {
    fs.mkdirSync(path.dirname(target()), { recursive: true });
    // Queda anterior no meio da gravação: o .tmp sobrou 0644.
    fs.writeFileSync(`${target()}.tmp`, '{}', { encoding: 'utf-8', mode: 0o644 });
    fs.chmodSync(`${target()}.tmp`, 0o644);

    writeJsonAtomic(target(), { secret: 'x' }, 0o600);

    expect(mode(target())).toBe(0o600);
    expect(fs.existsSync(`${target()}.tmp`)).toBe(false);
  });

  it('mantém o mode padrão de criação quando nenhum mode é pedido', () => {
    const control = path.join(sandboxPath('XDG_CONFIG_HOME'), 'controle.json');
    fs.writeFileSync(control, '{}', 'utf-8');
    writeJsonAtomic(target(), { a: 1 });
    expect(mode(target())).toBe(mode(control));
  });
});
