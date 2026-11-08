/**
 * Tests de la grille du calendrier.
 */
import { describe, expect, it } from 'vitest';
import { mondayOf, monthGrid, monthOf, shiftMonth, weeklyCounts } from './calendar';

describe('calendrier', () => {
  it('trouve le lundi de la semaine', () => {
    expect(mondayOf('2026-11-14')).toBe('2026-11-09'); // samedi → lundi
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09'); // dimanche
  });

  it('couvre un mois en semaines complètes, du lundi au dimanche', () => {
    const weeks = monthGrid('2026-11');
    // Novembre 2026 : commence un dimanche, finit un lundi → 6 semaines.
    expect(weeks).toHaveLength(6);
    expect(weeks[0]![0]).toBe('2026-10-26');
    expect(weeks[0]![6]).toBe('2026-11-01');
    expect(weeks.at(-1)![0]).toBe('2026-11-30');
    expect(weeks.flat().filter((d) => monthOf(d) === '2026-11')).toHaveLength(30);
  });

  it('passe d’un mois à l’autre, années comprises', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthGrid('2027-02').flat().filter((d) => monthOf(d) === '2027-02')).toHaveLength(28);
  });
});

describe('weeklyCounts', () => {
  it('compte renfos et imposées par semaine, la semaine en cours en dernier', () => {
    // 2026-01-14 est un mercredi ; semaines du 29/12, du 5/01 et du 12/01.
    const counts = weeklyCounts(['2026-01-05', '2026-01-07', '2026-01-13', '2025-12-01'], ['2026-01-04'], '2026-01-14', 3);
    expect(counts).toEqual([
      { monday: '2025-12-29', renfo: 0, other: 1 },
      { monday: '2026-01-05', renfo: 2, other: 0 },
      { monday: '2026-01-12', renfo: 1, other: 0 },
    ]);
  });
});
