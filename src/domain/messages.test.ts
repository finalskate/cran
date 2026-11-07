import { describe, expect, it } from 'vitest';
import { addDays } from './days';
import { dailyMessage, nthMessage, shuffledOrder } from './messages';

const POOL = ['a', 'b', 'c', 'd', 'e'];

describe('shuffledOrder', () => {
  it('est une permutation, identique pour une même graine', () => {
    const order = shuffledOrder(10, 'graine');
    expect([...order].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(shuffledOrder(10, 'graine')).toEqual(order);
  });
});

describe('nthMessage', () => {
  it('sert toute la liste à chaque tour', () => {
    for (let cycle = 0; cycle < 5; cycle++) {
      const round = POOL.map((_, i) => nthMessage(POOL, cycle * POOL.length + i, 'test'));
      expect([...round].sort()).toEqual(POOL);
    }
  });

  it('ne répète jamais deux fois de suite, même d’un tour à l’autre', () => {
    for (const salt of ['repos', 'accueil', 'bilan']) {
      for (let n = 1; n < 200; n++) {
        expect(nthMessage(POOL, n, salt)).not.toBe(nthMessage(POOL, n - 1, salt));
      }
    }
  });

  it('est reproductible, et la graine change l’ordre', () => {
    const a = POOL.map((_, i) => nthMessage(POOL, i, 'un'));
    expect(POOL.map((_, i) => nthMessage(POOL, i, 'un'))).toEqual(a);
    const salts = ['deux', 'trois', 'quatre', 'cinq'];
    expect(salts.some((s) => POOL.map((_, i) => nthMessage(POOL, i, s)).join() !== a.join())).toBe(true);
  });

  it('accepte une liste d’un seul message et refuse une liste vide', () => {
    expect(nthMessage(['seul'], 7, 'x')).toBe('seul');
    expect(() => nthMessage([], 0, 'x')).toThrow();
  });
});

describe('dailyMessage', () => {
  it('change d’un jour à l’autre', () => {
    let day = '2026-11-01';
    for (let i = 0; i < 60; i++) {
      const next = addDays(day, 1);
      expect(dailyMessage(POOL, next, 'jour')).not.toBe(dailyMessage(POOL, day, 'jour'));
      day = next;
    }
  });
});
