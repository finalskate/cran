/**
 * Tests de l'ajustement adaptatif. Données fictives : aucune donnée réelle (dépôt public).
 */
import { describe, expect, it } from 'vitest';
import {
  adjustmentWindow,
  adoptedExpenditure,
  computeAdjustment,
  dayCounts,
  isPartialDay,
  weightSlope,
  type AdjustInput,
} from './adaptive';
import { addDays } from './days';
import type { WeightEntry } from './nutrition';

const FROM = '2026-03-01';
const TO = addDays(FROM, 13);

const w = (offset: number, kg: number): WeightEntry => ({ day: addDays(FROM, offset), at: '', kg });

/** 14 jours notés à `kcal`, sauf les décalages listés dans `skip`. */
function days(kcal: number, skip: number[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < 14; i++) if (!skip.includes(i)) out[addDays(FROM, i)] = kcal;
  return out;
}

function input(over: Partial<AdjustInput> = {}): AdjustInput {
  return {
    from: FROM,
    to: TO,
    dayKcal: days(2000),
    overrides: {},
    // −0,5 kg en 14 jours, pesées étalées.
    weights: [w(0, 80), w(4, 79.86), w(9, 79.68), w(13, 79.5)],
    expenditure: 2500,
    currentKcal: 2050,
    floor: 1700,
    ...over,
  };
}

describe('journées comptées', () => {
  it('met de côté une journée sous 60 % de la dépense', () => {
    expect(isPartialDay(1400, 2500)).toBe(true);
    expect(isPartialDay(1500, 2500)).toBe(false);
  });

  it('ne compte jamais une journée vide, même à la demande', () => {
    expect(dayCounts(0, 2500, 'count')).toBe(false);
  });

  it('laisse le choix manuel l’emporter', () => {
    expect(dayCounts(900, 2500, 'count')).toBe(true);
    expect(dayCounts(2400, 2500, 'skip')).toBe(false);
    expect(dayCounts(2400, 2500)).toBe(true);
  });
});

describe('pente du poids', () => {
  it('suit une droite', () => {
    const s = weightSlope([w(0, 80), w(7, 79.3), w(14, 78.6)], FROM, addDays(FROM, 14))!;
    expect(s.kgPerDay).toBeCloseTo(-0.1, 6);
    expect(s.count).toBe(3);
    expect(s.spanDays).toBe(14);
  });

  it('ignore les pesées hors période et refuse un seul point', () => {
    expect(weightSlope([w(-3, 90), w(2, 80)], FROM, TO)).toBeNull();
  });
});

describe('calcul de l’ajustement', () => {
  it('déduit la dépense des apports et de la perte de poids', () => {
    const r = computeAdjustment(input());
    expect(r.status).toBe('ready');
    if (r.status !== 'ready') return;
    // Pente ≈ −0,0357 kg/j → 275 kcal/j de déficit réel : dépense ≈ 2 275.
    expect(r.measured).toBeGreaterThanOrEqual(2260);
    expect(r.measured).toBeLessThanOrEqual(2290);
    expect(r.proposedKcal).toBe(Math.round((r.measured - 450) / 10) * 10);
    expect(r.kgPerWeek).toBeCloseTo(-0.25, 1);
    expect(r.countedDays).toBe(14);
  });

  it('écarte les journées partielles du calcul des apports', () => {
    const dayKcal = { ...days(2000), [addDays(FROM, 3)]: 600 };
    const r = computeAdjustment(input({ dayKcal }));
    expect(r.status === 'ready' && r.countedDays).toBe(13);
    expect(r.status === 'ready' && r.meanIntake).toBe(2000);
  });

  it('demande plus de journées si trop peu ont été notées', () => {
    const r = computeAdjustment(input({ dayKcal: days(2000, [0, 1, 2, 3, 4, 5, 6]) }));
    expect(r).toMatchObject({ status: 'not-enough', countedDays: 7, missingDays: 1, missingWeighIns: 0 });
  });

  it('demande plus de pesées si elles sont trop rares ou trop rapprochées', () => {
    expect(computeAdjustment(input({ weights: [w(0, 80), w(13, 79.5)] }))).toMatchObject({
      status: 'not-enough',
      missingWeighIns: 2,
    });
    // 4 pesées, mais sur 3 jours seulement.
    expect(computeAdjustment(input({ weights: [w(10, 80), w(11, 79.9), w(12, 79.9), w(13, 79.8)] }))).toMatchObject({
      status: 'not-enough',
      missingWeighIns: 1,
    });
  });

  it('limite l’écart à 250 kcal par ajustement', () => {
    // Poids stable à 3 000 kcal : dépense 3 000, cible brute 2 550, plafonnée à 2 050 + 250.
    const r = computeAdjustment(input({ dayKcal: days(3000), weights: [w(0, 80), w(5, 80), w(9, 80), w(13, 80)] }));
    expect(r).toMatchObject({ status: 'ready', measured: 3000, proposedKcal: 2300, capped: true });
  });

  it('ne baisse pas la cible quand la perte dépasse 1 % du poids par semaine', () => {
    // −2 kg en 13 jours à 80 kg ≈ −1,08 kg/semaine, mais apports bas : la formule voudrait baisser.
    const r = computeAdjustment(
      input({ dayKcal: days(1250), expenditure: 2000, currentKcal: 2050, weights: [w(0, 80), w(4, 79.4), w(9, 78.6), w(13, 78)] }),
    );
    expect(r).toMatchObject({ status: 'ready', fastLoss: true, proposedKcal: 2050 });
  });

  it('ne descend jamais sous le plancher', () => {
    const r = computeAdjustment(
      input({ dayKcal: days(1800), currentKcal: 1800, weights: [w(0, 80), w(5, 80), w(9, 80), w(13, 80)] }),
    );
    expect(r).toMatchObject({ status: 'ready', measured: 1800, proposedKcal: 1700, floored: true });
  });
});

describe('calendrier des ajustements', () => {
  it('attend 14 jours après le début, puis 14 jours après chaque décision', () => {
    expect(adjustmentWindow(FROM, addDays(FROM, 13))).toBeNull();
    expect(adjustmentWindow(FROM, addDays(FROM, 14))).toEqual({ from: FROM, to: addDays(FROM, 13) });
    expect(adjustmentWindow(FROM, addDays(FROM, 20), addDays(FROM, 14))).toBeNull();
    expect(adjustmentWindow(FROM, addDays(FROM, 28), addDays(FROM, 14))).toEqual({
      from: addDays(FROM, 14),
      to: addDays(FROM, 27),
    });
  });

  it('au retour d’éloignement : 14 jours de vraies notes avant le prochain point', () => {
    const back = addDays(FROM, 40);
    expect(adjustmentWindow(FROM, addDays(back, 10), addDays(FROM, 14), back)).toBeNull();
    expect(adjustmentWindow(FROM, addDays(back, 14), addDays(FROM, 14), back)).toEqual({ from: back, to: addDays(back, 13) });
    // Un retour plus ancien que la dernière décision ne change rien.
    expect(adjustmentWindow(FROM, addDays(FROM, 28), addDays(FROM, 14), FROM)).toEqual({ from: addDays(FROM, 14), to: addDays(FROM, 27) });
  });

  it('retient la dépense du dernier ajustement accepté', () => {
    const rec = (decision: 'accepted' | 'declined', expenditure: number) => ({
      day: FROM,
      decision,
      kcalBefore: 0,
      kcalAfter: 0,
      expenditure,
    });
    expect(adoptedExpenditure([])).toBeUndefined();
    expect(adoptedExpenditure([rec('accepted', 2400), rec('declined', 2600)])).toBe(2400);
    expect(adoptedExpenditure([rec('accepted', 2400), rec('accepted', 2300)])).toBe(2300);
  });
});
