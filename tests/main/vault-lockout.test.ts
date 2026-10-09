import { describe, expect, it } from 'vitest';
import {
  LAST_DELAY_MS,
  LOCKOUT_DELAYS_MS,
  delayFor,
  lockUntilFor,
  lockoutState,
} from '@zero/main/vault/lockout';

describe('vault/lockout: trava exponencial', () => {
  it('escala 10 s → 30 s → 1 min → 1 h → 24 h', () => {
    expect(LOCKOUT_DELAYS_MS).toEqual([10_000, 30_000, 60_000, 3_600_000, 86_400_000]);
    expect(delayFor(1)).toBe(10_000);
    expect(delayFor(2)).toBe(30_000);
    expect(delayFor(3)).toBe(60_000);
    expect(delayFor(4)).toBe(3_600_000);
    expect(delayFor(5)).toBe(86_400_000);
  });

  it('acima da quinta falha repete sempre 24 h', () => {
    expect(delayFor(6)).toBe(LAST_DELAY_MS);
    expect(delayFor(50)).toBe(LAST_DELAY_MS);
    expect(delayFor(0)).toBe(10_000);
  });

  it('lockUntilFor soma a espera de agora', () => {
    const now = 1_700_000_000_000;
    expect(lockUntilFor(1, now)).toBe(now + 10_000);
    expect(lockUntilFor(3, now)).toBe(now + 60_000);
  });

  it('lockoutState distingue espera de liberado', () => {
    const now = 1_700_000_000_000;
    expect(lockoutState(now + 5_000, now)).toEqual({ locked: true, retryInMs: 5_000 });
    expect(lockoutState(now, now)).toEqual({ locked: false, retryInMs: 0 });
    expect(lockoutState(now - 1, now)).toEqual({ locked: false, retryInMs: 0 });
    expect(lockoutState(0, now)).toEqual({ locked: false, retryInMs: 0 });
  });
});
