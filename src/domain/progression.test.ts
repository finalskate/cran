/**
 * Tests de la double progression et du test de placement. Historiques fictifs.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import type { SetResult, WorkoutRecord } from './history';
import {
  isBelow,
  isValidated,
  levelChanges,
  levelVerdict,
  nextPrefill,
  placementStep,
  volumeDelta,
} from './progression';
import type { Target } from './types';

const REPS: Target = { kind: 'reps', min: 6, max: 12 };
const TIME: Target = { kind: 'time', min: 20, max: 45 };
const sets = (...values: number[]): SetResult[] => values.map((value) => ({ value, feel: 'ok' }));

const PUSH = CATALOG.find((m) => m.id === 'push-h')!;
/** Variante du niveau 1 de « pousser horizontal » et sa fourchette. */
const V1 = PUSH.levels[1]!.variants[0]!;

let n = 0;
function workout(values: number[], level = 1, variantId = V1.id, feel: SetResult['feel'] = 'ok'): WorkoutRecord {
  n++;
  const at = new Date(Date.UTC(2026, 10, 1 + n, 18)).toISOString();
  return {
    startedAt: at,
    endedAt: at,
    locationId: 'home',
    duration: 20,
    kneeScore: 0,
    entries: [{ movementId: PUSH.id, variantId, level, sets: values.map((value) => ({ value, feel })) }],
  };
}

describe('séance validée ou sous la fourchette', () => {
  it('valide quand toutes les séries atteignent le haut, sans « Dur »', () => {
    expect(isValidated(sets(12, 12, 13), REPS)).toBe(true);
    expect(isValidated(sets(12, 12, 11), REPS)).toBe(false);
    expect(isValidated([{ value: 12, feel: 'hard' }, ...sets(12)], REPS)).toBe(false);
    // Une série isolée ne suffit pas.
    expect(isValidated(sets(15), REPS)).toBe(false);
  });

  it('est sous la fourchette quand même la meilleure série n’atteint pas le bas', () => {
    expect(isBelow(sets(5, 4), REPS)).toBe(true);
    expect(isBelow(sets(6, 4), REPS)).toBe(false);
  });
});

describe('objectif du jour', () => {
  it('commence en bas de la fourchette', () => {
    expect(nextPrefill(undefined, REPS)).toBe(6);
  });

  it('ajoute un cran à la série la plus faible, sauf après un « Dur »', () => {
    expect(nextPrefill(sets(10, 9, 8), REPS, 2)).toBe(9);
    expect(nextPrefill([{ value: 10, feel: 'hard' }, ...sets(8)], REPS, 2)).toBe(8);
    expect(nextPrefill(sets(30, 25), TIME, 2)).toBe(30); // + 5 s
  });

  it('reste dans la fourchette', () => {
    expect(nextPrefill(sets(14, 13), REPS, 2)).toBe(12);
    expect(nextPrefill(sets(3, 2), REPS, 2)).toBe(6);
  });

  it('repart deux crans plus bas après une pause de 10 jours', () => {
    expect(nextPrefill(sets(11, 10, 10), REPS, 12)).toBe(8);
  });
});

describe('déblocage et retour en arrière', () => {
  const top = V1.target.max;
  const bottom = V1.target.min;

  it('débloque après deux séances validées au niveau actuel', () => {
    const history = [workout([top, top, top]), workout([top - 2, top - 3]), workout([top, top + 1, top])];
    expect(levelVerdict(history, PUSH, 1)).toBe('unlock');
    expect(levelVerdict(history.slice(0, 2), PUSH, 1)).toBeNull();
  });

  it('ne compte que les séances depuis le dernier changement de niveau', () => {
    const old = workout([top, top, top]);
    const recent = workout([top, top, top]);
    expect(levelVerdict([old, recent], PUSH, 1, recent.startedAt)).toBeNull();
  });

  it('ignore les séances faites à un autre niveau (niveau abaissé, substitut)', () => {
    const history = [workout([top, top], 0), workout([top, top], 0)];
    expect(levelVerdict(history, PUSH, 1)).toBeNull();
  });

  it('propose de revenir en arrière après deux séances de suite sous la fourchette', () => {
    const history = [workout([bottom - 1, bottom - 2]), workout([bottom - 1, bottom - 1])];
    expect(levelVerdict(history, PUSH, 1)).toBe('step-back');
    expect(levelVerdict([...history, workout([bottom, bottom])], PUSH, 1)).toBeNull();
  });

  it('liste les changements après une séance, sans dépasser l’échelle', () => {
    const a = workout([top, top, top]);
    const b = workout([top, top, top]);
    const { unlocks, stepBacks } = levelChanges(b, [a, b], CATALOG, { [PUSH.id]: 1 }, {});
    expect(unlocks).toEqual([{ movementId: PUSH.id, from: 1, to: 2 }]);
    expect(stepBacks).toEqual([]);

    const last = PUSH.levels.length - 1;
    const v = PUSH.levels[last]!.variants[0]!;
    const c = workout([v.target.max, v.target.max], last, v.id);
    const d = workout([v.target.max, v.target.max], last, v.id);
    expect(levelChanges(d, [c, d], CATALOG, { [PUSH.id]: last }, {}).unlocks).toEqual([]);
  });

  it('ne propose pas de retour sous le premier niveau', () => {
    const v = PUSH.levels[0]!.variants[0]!;
    const a = workout([0, 0], 0, v.id);
    const b = workout([0, 0], 0, v.id);
    expect(levelChanges(b, [a, b], CATALOG, {}, {}).stepBacks).toEqual([]);
  });
});

describe('volume selon le ressenti global', () => {
  it('retire ou ajoute une série, jamais plus', () => {
    expect(volumeDelta('too-hard')).toBe(-1);
    expect(volumeDelta('too-easy')).toBe(1);
    expect(volumeDelta('right')).toBe(0);
    expect(volumeDelta(undefined)).toBe(0);
  });
});

describe('test de placement', () => {
  it('monte quand la série max dépasse la fourchette, descend quand elle est sous le bas', () => {
    expect(placementStep(2, 15, REPS, 6)).toEqual({ kind: 'up', level: 3 });
    expect(placementStep(2, 4, REPS, 6)).toEqual({ kind: 'down', level: 1 });
    expect(placementStep(2, 9, REPS, 6)).toEqual({ kind: 'placed', level: 2 });
  });

  it('s’arrête aux bornes de l’échelle et ne fait pas d’aller-retour', () => {
    expect(placementStep(5, 30, REPS, 6)).toEqual({ kind: 'placed', level: 5 });
    expect(placementStep(0, 2, REPS, 6)).toEqual({ kind: 'placed', level: 0 });
    // Monté de 1 à 2, trop dur à 2 : le bon niveau est 1.
    expect(placementStep(2, 3, REPS, 6, 1)).toEqual({ kind: 'placed', level: 1 });
  });
});
