import { describe, expect, it } from 'vitest';
import { VAULT_VERSION, decodeContainer, encodeContainer } from '@zero/main/vault/container';
import type { VaultContainer } from '@zero/main/vault/container';
import { newMasterKey, newSalt, seal } from '@zero/main/vault/crypto';

/** Container de exemplo com KDF barato; payload e wrap cifrados de verdade. */
function fixture(): VaultContainer {
  const kek = newMasterKey();
  const masterKey = newMasterKey();
  const salt = newSalt();
  return {
    version: VAULT_VERSION,
    createdAt: 1_700_000_000_000,
    kdf: { memoryKiB: 16_384, iterations: 1, parallelism: 1 },
    attempts: 2,
    lockUntil: 1_700_000_010_000,
    wrap: { salt, ...seal(kek, masterKey) },
    payload: seal(masterKey, Buffer.from('{"version":1,"secrets":{}}', 'utf-8')),
  };
}

describe('vault/container: formato do vault.zkv', () => {
  it('faz roundtrip encode/decode preservando todos os campos', () => {
    const container = fixture();
    const decoded = decodeContainer(encodeContainer(container));
    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(container);
  });

  it('grava e lê tentativas e trava (campos em claro do cabeçalho)', () => {
    const decoded = decodeContainer(encodeContainer(fixture()));
    expect(decoded?.attempts).toBe(2);
    expect(decoded?.lockUntil).toBe(1_700_000_010_000);
  });

  it('devolve null para buffer truncado (qualquer ponto do arquivo)', () => {
    const buffer = encodeContainer(fixture());
    for (const cut of [1, 8, 44, 45, 60, buffer.length - 1]) {
      expect(decodeContainer(buffer.subarray(0, cut))).toBeNull();
    }
  });

  it('devolve null para byte a mais no fim', () => {
    const buffer = encodeContainer(fixture());
    expect(decodeContainer(Buffer.concat([buffer, Buffer.from([0])]))).toBeNull();
  });

  it('devolve null para magic ou versão errados', () => {
    const buffer = encodeContainer(fixture());
    const wrongMagic = Buffer.from(buffer);
    wrongMagic.write('XXXXXXX1', 0, 'ascii');
    expect(decodeContainer(wrongMagic)).toBeNull();

    const wrongVersion = Buffer.from(buffer);
    wrongVersion.writeUInt32BE(99, 8);
    expect(decodeContainer(wrongVersion)).toBeNull();
  });

  it('devolve null para parâmetro de KDF fora da faixa (anti-DoS)', () => {
    const buffer = encodeContainer(fixture());
    const hugeMemory = Buffer.from(buffer);
    hugeMemory.writeUInt32BE(4_294_967_295, 20);
    expect(decodeContainer(hugeMemory)).toBeNull();

    const zeroIterations = Buffer.from(buffer);
    zeroIterations.writeUInt32BE(0, 24);
    expect(decodeContainer(zeroIterations)).toBeNull();

    const manyThreads = Buffer.from(buffer);
    manyThreads.writeUInt32BE(64, 28);
    expect(decodeContainer(manyThreads)).toBeNull();
  });

  it('devolve null para tentativas impossíveis', () => {
    const buffer = encodeContainer(fixture());
    const bogus = Buffer.from(buffer);
    bogus.writeUInt32BE(4_294_967_295, 32);
    expect(decodeContainer(bogus)).toBeNull();
  });

  it('devolve null quando um bloco declara tamanho maior que o arquivo', () => {
    const buffer = encodeContainer(fixture());
    const lying = Buffer.from(buffer);
    // tamanho do bloco de wrap: offsets 45 + salt(16) + iv(16) + tag(16)
    lying.writeUInt32BE(buffer.length, 45 + 16 + 16 + 16);
    expect(decodeContainer(lying)).toBeNull();
  });
});
