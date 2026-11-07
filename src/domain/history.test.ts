/**
 * Tests des lectures de l'historique : rappel du carnet, ressenti de séance, comparaison encourageante.
 */
import { describe, expect, it } from 'vitest';
import { compareWithLast, lastSessionFeel, lastSetsByVariant, type WorkoutRecord } from './history';

/** Séance minimale pour les tests. */
function workout(startedAt: string, entries: WorkoutRecord['entries'], extra: Partial<WorkoutRecord> = {}): WorkoutRecord {
  return { startedAt, endedAt: startedAt, locationId: 'home', duration: 20, kneeScore: 0, entries, ...extra };
}

describe('lastSetsByVariant', () => {
  it('garde les séries de la séance la plus récente, même si l’historique est dans le désordre', () => {
    const history = [
      workout('2026-11-10T18:00:00Z', [{ movementId: 'push-h', variantId: 'pushup', level: 1, sets: [{ value: 12 }, { value: 11 }] }]),
      workout('2026-11-08T18:00:00Z', [{ movementId: 'push-h', variantId: 'pushup', level: 1, sets: [{ value: 9 }] }]),
    ];
    expect(lastSetsByVariant(history)).toEqual({ pushup: [12, 11] });
  });

  it('ignore les exercices sans série', () => {
    const history = [workout('2026-11-10T18:00:00Z', [{ movementId: 'push-h', variantId: 'pushup', level: 1, sets: [] }])];
    expect(lastSetsByVariant(history)).toEqual({});
  });
});

describe('lastSessionFeel', () => {
  it('renvoie le ressenti de la dernière séance', () => {
    const history = [
      workout('2026-11-08T18:00:00Z', [], { sessionFeel: 'too-easy' }),
      workout('2026-11-10T18:00:00Z', [], { sessionFeel: 'too-hard', locationId: 'park' }),
    ];
    expect(lastSessionFeel(history)).toEqual({ feel: 'too-hard', startedAt: '2026-11-10T18:00:00Z', locationId: 'park' });
  });

  it('ne rappelle rien si la dernière séance n’a pas de ressenti (même si une plus ancienne en a un)', () => {
    const history = [workout('2026-11-08T18:00:00Z', [], { sessionFeel: 'too-hard' }), workout('2026-11-10T18:00:00Z', [])];
    expect(lastSessionFeel(history)).toBeUndefined();
    expect(lastSessionFeel([])).toBeUndefined();
  });
});

describe('compareWithLast', () => {
  it('signale un progrès par rapport à la même série', () => {
    expect(compareWithLast(9, [8, 8, 7], 1)).toEqual({ kind: 'better', delta: 1 });
    expect(compareWithLast(9, [8, 8, 7], 3)).toEqual({ kind: 'better', delta: 2 });
  });

  it('signale l’égalité', () => {
    expect(compareWithLast(8, [8, 8, 7], 2)).toEqual({ kind: 'equal' });
  });

  it('ne dit rien en cas de recul ou sans référence (pas de culpabilisation)', () => {
    expect(compareWithLast(6, [8, 8, 7], 1)).toBeUndefined();
    expect(compareWithLast(10, [8], 2)).toBeUndefined();
    expect(compareWithLast(10, undefined, 1)).toBeUndefined();
  });
});
