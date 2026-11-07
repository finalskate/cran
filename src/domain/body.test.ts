import { describe, expect, it } from 'vitest';
import {
  bodySummary,
  GAP_DAYS,
  nextGoal,
  photoDue,
  photoMonths,
  trendAt,
  trendSeries,
  waistDue,
  type MeasureEntry,
  type PhotoMeta,
} from './body';
import { addDays } from './days';
import type { WeightEntry } from './nutrition';

/** Pesée fictive (valeurs de test, sans rapport avec un utilisateur réel). */
const w = (day: string, kg: number): WeightEntry => ({ day, at: `${day}T07:00:00.000Z`, kg });

/** Pesées tous les `every` jours depuis `start`, en perdant `perWeek` kg par semaine. */
function series(start: string, count: number, every: number, startKg: number, perWeek: number): WeightEntry[] {
  return Array.from({ length: count }, (_, i) => w(addDays(start, i * every), startKg + (perWeek / 7) * i * every));
}

describe('trendSeries', () => {
  it('démarre sur la première pesée', () => {
    expect(trendSeries([w('2026-01-10', 80)])).toEqual([{ day: '2026-01-10', kg: 80, trend: 80, gapBefore: false }]);
  });

  it('lisse : une pesée isolée plus haute ne déplace la tendance que de 10 % le lendemain', () => {
    const t = trendSeries([w('2026-01-10', 80), w('2026-01-11', 81)]);
    expect(t[1]!.trend).toBeCloseTo(80.1, 5);
  });

  it('tolère les trous : après 3 semaines sans pesée, la nouvelle pesée compte pour ~90 %', () => {
    const t = trendSeries([w('2026-01-01', 80), w('2026-01-22', 78)]);
    // α effectif = 1 − 0,9^21 ≈ 0,89
    expect(t[1]!.trend).toBeCloseTo(80 - 2 * (1 - 0.9 ** 21), 5);
    expect(t[1]!.gapBefore).toBe(true);
  });

  it(`signale une interruption au-delà de ${GAP_DAYS} jours seulement`, () => {
    const t = trendSeries([w('2026-01-01', 80), w('2026-01-11', 80), w('2026-01-22', 80)]);
    expect(t.map((p) => p.gapBefore)).toEqual([false, false, true]);
  });

  it('trie les pesées par jour', () => {
    const t = trendSeries([w('2026-01-05', 79), w('2026-01-01', 80)]);
    expect(t.map((p) => p.day)).toEqual(['2026-01-01', '2026-01-05']);
  });
});

describe('nextGoal', () => {
  it('vise l’étape la plus haute encore au-dessus de la tendance', () => {
    expect(nextGoal([68, 65], 72)).toBe(68);
    expect(nextGoal([65, 68], 67.9)).toBe(65);
    expect(nextGoal([68, 65], 64.9)).toBeNull();
    expect(nextGoal([], 72)).toBeNull();
  });
});

describe('bodySummary', () => {
  const today = '2026-02-01';

  it('sans pesée : rien à dire, mais l’objectif est connu', () => {
    const s = bodySummary([], [68], today);
    expect(s.trend).toBeNull();
    expect(s.goal).toBe(68);
    expect(s.projection).toBeNull();
  });

  it('pas de rythme avant 4 pesées sur 10 jours, et dit ce qui manque', () => {
    const s = bodySummary([w('2026-01-28', 75), w('2026-01-30', 74.8)], [68], today);
    expect(s.rate).toBeNull();
    expect(s.missing).toEqual({ weighIns: 2, spanDays: 8 });
  });

  it('mesure le rythme et projette l’arrivée quand la tendance est stable', () => {
    // 0,5 kg/semaine de perte, une pesée tous les 2 jours pendant 4 semaines.
    const weights = series('2026-01-05', 14, 2, 75, -0.5);
    const s = bodySummary(weights, [68, 65], today);
    expect(s.rate).toBeCloseTo(-0.5, 5);
    expect(s.direction).toBe('down');
    expect(s.goal).toBe(68);
    expect(s.projection).not.toBeNull();
    // (tendance − 68) / 0,5 semaines
    expect(s.projection!.weeks).toBeCloseTo((s.trend! - 68) / 0.5, 5);
    expect(s.projection!.day > today).toBe(true);
    expect(s.sinceStart!).toBeLessThan(0);
  });

  it('pas de projection sur moins de 14 jours de recul', () => {
    const weights = series('2026-01-20', 6, 2, 75, -0.5); // 10 jours
    const s = bodySummary(weights, [68], today);
    expect(s.rate).not.toBeNull();
    expect(s.projection).toBeNull();
  });

  it('pas de projection quand le poids remonte, ni quand la perte est irréaliste', () => {
    expect(bodySummary(series('2026-01-05', 14, 2, 74, 0.3), [68], today).projection).toBeNull();
    expect(bodySummary(series('2026-01-05', 14, 2, 80, -2), [68], today).projection).toBeNull();
  });

  it('pas de projection au-delà d’un an', () => {
    const s = bodySummary(series('2026-01-05', 14, 2, 90, -0.15), [68], today);
    expect(s.rate).not.toBeNull();
    expect(s.projection).toBeNull();
  });

  it('qualifie une tendance stable', () => {
    const s = bodySummary(series('2026-01-05', 14, 2, 72, 0.02), [68], today);
    expect(s.direction).toBe('stable');
  });

  it('ne donne plus de rythme si la dernière pesée date de plus de 2 semaines', () => {
    const weights = series('2025-12-01', 14, 2, 75, -0.5);
    const s = bodySummary(weights, [68], today);
    expect(s.trend).not.toBeNull();
    expect(s.rate).toBeNull();
    expect(s.missing).toBeNull();
  });
});

describe('waistDue', () => {
  const m = (day: string): MeasureEntry => ({ id: `waist:${day}`, kind: 'waist', day, at: `${day}T08:00:00Z`, value: 80 });

  it('propose la première mesure, puis une fois par semaine', () => {
    expect(waistDue([], '2026-01-10')).toBe(true);
    expect(waistDue([m('2026-01-05')], '2026-01-10')).toBe(false);
    expect(waistDue([m('2026-01-03')], '2026-01-10')).toBe(true);
  });

  it('respecte une invitation repoussée', () => {
    expect(waistDue([], '2026-01-10', '2026-01-15')).toBe(false);
    expect(waistDue([], '2026-01-15', '2026-01-15')).toBe(true);
  });
});

describe('photos', () => {
  const p = (day: string, pose: PhotoMeta['pose'] = 'front'): PhotoMeta => ({ day, month: day.slice(0, 7), pose });

  it('propose les photos une fois par mois, au moins 3 semaines après les précédentes', () => {
    expect(photoDue([], '2026-01-10')).toBe(true);
    expect(photoDue([p('2026-01-02')], '2026-01-25')).toBe(false); // déjà ce mois-ci
    expect(photoDue([p('2026-01-28')], '2026-02-03')).toBe(false); // trop tôt
    expect(photoDue([p('2026-01-28')], '2026-02-18')).toBe(true);
  });

  it('liste les mois d’une pose, sans doublon, dans l’ordre', () => {
    const photos = [p('2026-02-02'), p('2026-01-02'), p('2026-01-02', 'side'), p('2026-01-20')];
    expect(photoMonths(photos, 'front')).toEqual(['2026-01', '2026-02']);
    expect(photoMonths(photos, 'side')).toEqual(['2026-01']);
  });

  it('légende une photo avec la tendance du jour', () => {
    const t = trendSeries([w('2026-01-01', 80), w('2026-01-10', 79)]);
    expect(trendAt(t, '2025-12-31')).toBeNull();
    expect(trendAt(t, '2026-01-05')).toBe(80);
    expect(trendAt(t, '2026-01-31')).toBe(t[1]!.trend);
  });
});
