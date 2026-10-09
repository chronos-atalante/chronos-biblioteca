import { describe, expect, it } from 'vitest';
import {
  KDF_DEFAULTS,
  MASTER_KEY_BYTES,
  deriveDataKey,
  deriveKek,
  kdfParamsInRange,
  newMasterKey,
  newSalt,
  passwordProblem,
  seal,
  unseal,
} from '@zero/main/vault/crypto';

/** Perfil barato para a suíte: o cofre de produção usa `KDF_DEFAULTS`. */
export const FAST_KDF = { memoryKiB: 16_384, iterations: 1, parallelism: 1 };

describe('vault/crypto: Argon2id e AES-256-GCM', () => {
  it('deriveKek é determinística para a mesma senha, salt e parâmetros', async () => {
    const salt = newSalt();
    const a = await deriveKek('senha longa de teste 123', salt, FAST_KDF);
    const b = await deriveKek('senha longa de teste 123', salt, FAST_KDF);
    expect(a.equals(b)).toBe(true);
    expect(a.length).toBe(MASTER_KEY_BYTES);
  });

  it('deriveKek muda com a senha e com o salt', async () => {
    const salt = newSalt();
    const a = await deriveKek('senha longa de teste 123', salt, FAST_KDF);
    const b = await deriveKek('outra senha longa de teste', salt, FAST_KDF);
    const c = await deriveKek('senha longa de teste 123', newSalt(), FAST_KDF);
    expect(a.equals(b)).toBe(false);
    expect(a.equals(c)).toBe(false);
  });

  it('seal/unseal faz roundtrip do texto cifrado', () => {
    const key = newMasterKey();
    const sealed = seal(key, Buffer.from('conteúdo sigiloso', 'utf-8'));
    const opened = unseal(key, sealed);
    expect(opened?.toString('utf-8')).toBe('conteúdo sigiloso');
    expect(sealed.data.toString('utf-8')).not.toContain('sigiloso');
  });

  it('unseal devolve null com o dado adulterado', () => {
    const key = newMasterKey();
    const sealed = seal(key, Buffer.from('conteúdo sigiloso', 'utf-8'));
    sealed.data[0] = (sealed.data[0] ?? 0) ^ 0xff;
    expect(unseal(key, sealed)).toBeNull();
  });

  it('unseal devolve null com a tag adulterada ou IV de tamanho errado', () => {
    const key = newMasterKey();
    const sealed = seal(key, Buffer.from('conteúdo sigiloso', 'utf-8'));
    sealed.tag[0] = (sealed.tag[0] ?? 0) ^ 0xff;
    expect(unseal(key, sealed)).toBeNull();
    expect(unseal(key, { ...sealed, iv: Buffer.alloc(8) })).toBeNull();
    expect(unseal(newMasterKey(), seal(key, Buffer.from('x')))).toBeNull();
  });

  it('deriveDataKey é determinística e diferente da chave mestra', () => {
    const master = newMasterKey();
    const salt = newSalt();
    const dataKey = deriveDataKey(master, salt);
    expect(dataKey.equals(deriveDataKey(master, salt))).toBe(true);
    expect(dataKey.equals(master)).toBe(false);
    expect(dataKey.length).toBe(MASTER_KEY_BYTES);
  });

  it('kdfParamsInRange aceita a faixa e recusa fora dela', () => {
    expect(kdfParamsInRange(KDF_DEFAULTS)).toBe(true);
    expect(kdfParamsInRange(FAST_KDF)).toBe(true);
    expect(kdfParamsInRange({ memoryKiB: 8_192, iterations: 1, parallelism: 1 })).toBe(false);
    expect(kdfParamsInRange({ memoryKiB: 2_097_152, iterations: 1, parallelism: 1 })).toBe(false);
    expect(kdfParamsInRange({ memoryKiB: 65_536, iterations: 0, parallelism: 1 })).toBe(false);
    expect(kdfParamsInRange({ memoryKiB: 65_536, iterations: 9, parallelism: 1 })).toBe(false);
    expect(kdfParamsInRange({ memoryKiB: 65_536, iterations: 2, parallelism: 0 })).toBe(false);
    expect(kdfParamsInRange({ memoryKiB: 65_536, iterations: 2, parallelism: 9 })).toBe(false);
  });
});

describe('vault/crypto: força da senha mestra', () => {
  it('recusa senha curta', () => {
    expect(passwordProblem('curta12')).toBe('short');
    expect(passwordProblem('12345678901')).toBe('short');
    expect(passwordProblem('123456789012')).toBe('trivial');
  });

  it('recusa padrão degenerado (repetido, sequência e bloco)', () => {
    expect(passwordProblem('aaaaaaaaaaaa')).toBe('trivial');
    expect(passwordProblem('abcdefghijkl')).toBe('trivial');
    expect(passwordProblem('123456789012')).toBe('trivial');
    expect(passwordProblem('abcabcabcabc')).toBe('trivial');
  });

  it('recusa fragmento comum (senha, password, chronos…)', () => {
    expect(passwordProblem('minha-senha-forte-1')).toBe('trivial');
    expect(passwordProblem('MyPasswordIsGreat12')).toBe('trivial');
    expect(passwordProblem('ChronosBiblioteca1!')).toBe('trivial');
  });

  it('aceita senha longa sem padrão óbvio', () => {
    expect(passwordProblem('uva-preta-42-estrela')).toBeNull();
    expect(passwordProblem('Corvo#Nove7Ravina!')).toBeNull();
  });
});
