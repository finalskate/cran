import { describe, expect, it } from 'vitest';
import { dayTicks, nearestIndex, niceStep, splitAtGaps, valueAxis } from './chart';

describe('niceStep', () => {
  it('choisit 1, 2 ou 5 × 10ⁿ', () => {
    expect(niceStep(4, 4)).toBe(1);
    expect(niceStep(7, 4)).toBe(2);
    expect(niceStep(15, 4)).toBe(5);
    expect(niceStep(0.8, 4)).toBe(0.2);
  });
});

describe('valueAxis', () => {
  it('arrondit les bornes au pas et liste les graduations', () => {
    expect(valueAxis([71.6, 74.6], 2)).toEqual({ min: 71, max: 75, ticks: [71, 72, 73, 74, 75] });
  });

  it('impose une amplitude minimale (200 g ne doit pas ressembler à une chute)', () => {
    const a = valueAxis([72.1, 72.3], 2);
    expect(a.max - a.min).toBeGreaterThanOrEqual(2);
  });

  it('se débrouille sans valeur', () => {
    expect(valueAxis([], 2).ticks.length).toBeGreaterThan(0);
  });
});

describe('dayTicks', () => {
  it('met un lundi par semaine sur un mois', () => {
    // 2026-01-01 est un jeudi : premier lundi le 5.
    expect(dayTicks('2026-01-01', '2026-01-31')).toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26']);
  });

  it('espace les lundis de 2 semaines au-delà de 5 semaines', () => {
    expect(dayTicks('2026-01-01', '2026-02-20')).toEqual(['2026-01-05', '2026-01-19', '2026-02-02', '2026-02-16']);
  });

  it('met le 1er de chaque mois sur une longue période', () => {
    expect(dayTicks('2025-11-08', '2026-02-10')).toEqual(['2025-12-01', '2026-01-01', '2026-02-01']);
  });
});

describe('splitAtGaps', () => {
  it('coupe aux interruptions', () => {
    const pts = [{ gapBefore: false }, { gapBefore: false }, { gapBefore: true }, { gapBefore: false }];
    expect(splitAtGaps(pts).map((s) => s.length)).toEqual([2, 2]);
  });
});

describe('nearestIndex', () => {
  it('trouve le point le plus proche', () => {
    expect(nearestIndex([0, 10, 20], 14)).toBe(1);
    expect(nearestIndex([], 3)).toBe(-1);
  });
});
