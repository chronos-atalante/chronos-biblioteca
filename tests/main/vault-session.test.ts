import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_LOCK_MS, VaultSessionManager } from '@zero/main/vault/session';
import { newMasterKey } from '@zero/main/vault/crypto';

function session(): VaultSessionManager {
  return VaultSessionManager.getInstance();
}

describe('vault/session: Singleton da sessão', () => {
  afterEach(() => {
    session().wipe();
    session().onAutoLock(() => {
      // limpa o ouvinte registrado pelo teste
    });
    vi.useRealTimers();
  });

  it('nasce bloqueado', () => {
    expect(session().isUnlocked()).toBe(false);
    expect(session().key()).toBeNull();
  });

  it('adopt desbloqueia e wipe zera a chave', () => {
    const key = newMasterKey();
    session().adopt(key);
    expect(session().isUnlocked()).toBe(true);
    expect(session().key()?.equals(key)).toBe(true);
    session().wipe();
    expect(session().isUnlocked()).toBe(false);
    expect(session().key()).toBeNull();
  });

  it('adopt guarda uma cópia: mutar o buffer de origem não muda a sessão', () => {
    const key = newMasterKey();
    const original = Buffer.from(key);
    session().adopt(key);
    key.fill(0);
    expect(session().key()?.equals(original)).toBe(true);
  });

  it('wipe zera os bytes em memória (não é só null)', () => {
    const key = newMasterKey();
    session().adopt(key);
    const held = session().key();
    session().wipe();
    expect(held?.every((byte) => byte === 0)).toBe(true);
  });

  it('auto-lock derruba a sessão após a janela de ociosidade e avisa o ouvinte', () => {
    vi.useFakeTimers();
    const onLock = vi.fn();
    session().onAutoLock(onLock);
    session().adopt(newMasterKey());

    vi.advanceTimersByTime(IDLE_LOCK_MS - 1);
    expect(session().isUnlocked()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(session().isUnlocked()).toBe(false);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('touch adia o auto-lock', () => {
    vi.useFakeTimers();
    session().adopt(newMasterKey());

    vi.advanceTimersByTime(IDLE_LOCK_MS - 1_000);
    session().touch();
    vi.advanceTimersByTime(IDLE_LOCK_MS - 1_000);
    expect(session().isUnlocked()).toBe(true);

    vi.advanceTimersByTime(2_000);
    expect(session().isUnlocked()).toBe(false);
  });

  /**
   * Regressão do bug de semântica: `key()` **não** pode contar como
   * atividade. Medir acesso a segredo dava o resultado oposto do que o nome
   * promete — quem só usava a biblioteca perdia o cofre no minuto 5, e uma
   * única leitura interna reiniciava a janela inteira.
   */
  it('ler a chave não reinicia a janela de ociosidade', () => {
    vi.useFakeTimers();
    session().adopt(newMasterKey());

    vi.advanceTimersByTime(IDLE_LOCK_MS - 1_000);
    expect(session().key()).not.toBeNull();
    // Mais 1 s, sem `touch`: a janela original segue valendo.
    vi.advanceTimersByTime(1_000);
    expect(session().isUnlocked()).toBe(false);
  });

  it('touch repetido não vira rajada de timer (throttle de 30 s)', () => {
    vi.useFakeTimers();
    session().adopt(newMasterKey());

    // Atividade encadeada, como a de quem está digitando.
    for (let i = 0; i < 10; i += 1) {
      vi.advanceTimersByTime(1_000);
      session().touch();
    }
    // Ainda dentro da janela a partir do último toque efetivo.
    expect(session().isUnlocked()).toBe(true);

    vi.advanceTimersByTime(IDLE_LOCK_MS);
    expect(session().isUnlocked()).toBe(false);
  });

  it('touch não reabre sessão bloqueada', () => {
    vi.useFakeTimers();
    session().touch();
    expect(session().isUnlocked()).toBe(false);
    expect(session().key()).toBeNull();
  });

  it('getInstance devolve sempre a mesma instância', () => {
    expect(VaultSessionManager.getInstance()).toBe(session());
  });
});
