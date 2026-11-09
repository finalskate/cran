/**
 * Tests des records personnels. Données fictives.
 */
import { describe, expect, it } from 'vitest';
import type { WorkoutEntry, WorkoutRecord } from './history';
import type { Activity } from './recovery';
import { longestRun, newRecords, variantRecords } from './records';

let n = 0;
function workout(day: string, entries: WorkoutEntry[]): WorkoutRecord {
  n++;
  return { id: n, startedAt: `${day}T18:00:00.000Z`, endedAt: `${day}T18:30:00.000Z`, locationId: 'home', duration: 20, kneeScore: 0, entries };
}
const sets = (...values: number[]) => values.map((value) => ({ value }));
const band = (label: string, rank: number) => ({ label, rank, of: 3 });

const history = [
  workout('2026-11-10', [
    { movementId: 'push-h', variantId: 'archer', level: 5, sets: sets(10, 11, 12) },
    { movementId: 'warmup', variantId: 'arm-circles', level: 0, sets: sets(30) },
    { movementId: 'pull-h', variantId: 'band-row', level: 0, sets: sets(15), band: band('10 kg', 0) },
  ]),
  workout('2026-11-12', [
    { movementId: 'push-h', variantId: 'archer', level: 5, sets: sets(12, 12, 11) },
    { movementId: 'pull-h', variantId: 'band-row', level: 0, sets: sets(12), band: band('20 kg', 1) },
  ]),
];

describe('records', () => {
  it('meilleure série par variante et par élastique, datée de la 1re fois', () => {
    const records = variantRecords(history);
    expect(records).toHaveLength(3); // pas d'échauffement
    expect(records.find((r) => r.variantId === 'archer')).toMatchObject({ value: 12, at: '2026-11-10T18:00:00.000Z' });
    expect(records.filter((r) => r.variantId === 'band-row').map((r) => [r.band, r.value])).toEqual([
      ['10 kg', 15],
      ['20 kg', 12],
    ]);
  });

  it('fête un record battu, pas une 1re fois ni une égalité', () => {
    const today = workout('2026-11-14', [
      { movementId: 'push-h', variantId: 'archer', level: 5, sets: sets(13, 12, 14) },
      { movementId: 'pull-h', variantId: 'band-row', level: 0, sets: sets(12), band: band('20 kg', 1) },
      { movementId: 'legs', variantId: 'pistol', level: 7, sets: sets(5) },
    ]);
    // La séance du jour est déjà dans l'historique (comme dans l'appli) : elle n'est pas comparée à elle-même.
    expect(newRecords(today, [...history, today])).toEqual([{ movementId: 'push-h', variantId: 'archer', value: 14, previous: 12 }]);
  });

  it('plus longue course, imposées comprises', () => {
    const acts: Activity[] = [
      { type: 'run', day: '2026-11-15', at: '', minutes: 35, kind: 'easy', feel: 'ok', kneeAfter: 0 },
      { type: 'imposed', day: '2026-11-17', at: '', minutes: 50, kind: 'run', legs: true, intensity: 'medium' },
      { type: 'bike', day: '2026-11-18', at: '', minutes: 90, kind: 'easy', feel: 'ok' },
    ];
    expect(longestRun(acts)).toEqual({ minutes: 50, day: '2026-11-17' });
    expect(longestRun([])).toBeNull();
  });
});
