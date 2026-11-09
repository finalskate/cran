/**
 * Tests de la régularité : pause, historique de l'objectif, semaines réussies. Données fictives.
 */
import { describe, expect, it } from 'vitest';
import type { Activity } from './recovery';
import {
  activePause,
  endPause,
  goalOn,
  pausedOn,
  recordGoalChange,
  regularity,
  regularityStart,
  SINCE_ALWAYS,
  startPause,
  weekResults,
  type RegularityInput,
} from './regularity';

const AT = '2026-11-16T17:00:00.000Z';
const run = (day: string): Activity => ({ type: 'run', day, at: AT, minutes: 30, kind: 'easy', feel: 'ok', kneeAfter: 0 });

describe('mode pause', () => {
  it('pause jusqu’à nouvel ordre, puis reprise', () => {
    const paused = startPause([], '2026-11-18');
    expect(paused).toEqual([{ from: '2026-11-18' }]);
    expect(pausedOn(paused, '2026-12-25')).toBe(true);
    expect(pausedOn(paused, '2026-11-17')).toBe(false);
    const resumed = endPause(paused, '2026-11-21');
    expect(resumed).toEqual([{ from: '2026-11-18', until: '2026-11-20' }]);
    expect(activePause(resumed, '2026-11-21')).toBeNull();
  });

  it('une pause datée s’arrête seule ; la prolonger garde son début', () => {
    const paused = startPause([], '2026-11-18', '2026-11-22');
    expect(activePause(paused, '2026-11-22')).not.toBeNull();
    expect(activePause(paused, '2026-11-23')).toBeNull();
    expect(startPause(paused, '2026-11-20', '2026-11-29')).toEqual([{ from: '2026-11-18', until: '2026-11-29' }]);
  });

  it('reprendre le jour même retire la pause', () => {
    expect(endPause(startPause([], '2026-11-18'), '2026-11-18')).toEqual([]);
  });
});

describe('objectif de chaque semaine', () => {
  it('garde l’objectif d’avant pour le passé', () => {
    const log = recordGoalChange([], '2026-12-07', { strength: 2, cardio: 2 }, { strength: 3, cardio: 2 });
    expect(log[0]).toEqual({ since: SINCE_ALWAYS, goal: { strength: 3, cardio: 2 } });
    expect(goalOn(log, '2026-11-30', { strength: 9, cardio: 9 })).toEqual({ strength: 3, cardio: 2 });
    expect(goalOn(log, '2026-12-08', { strength: 9, cardio: 9 })).toEqual({ strength: 2, cardio: 2 });
    // Deux changements le même jour : le dernier gagne.
    const again = recordGoalChange(log, '2026-12-07', { strength: 1, cardio: 1 }, { strength: 2, cardio: 2 });
    expect(again).toHaveLength(2);
    expect(goalOn(again, '2026-12-07', { strength: 9, cardio: 9 })).toEqual({ strength: 1, cardio: 1 });
  });
});

describe('semaines réussies', () => {
  // Objectif 1 renfo + 1 cardio pour des données courtes.
  const goal = { strength: 1, cardio: 1 };
  const base = (over: Partial<RegularityInput>): RegularityInput => ({
    start: '2026-11-14',
    today: '2026-12-09',
    renfoDays: [],
    activities: [],
    goals: [],
    currentGoal: goal,
    pauses: [],
    ...over,
  });

  it('juge chaque semaine, sans pénaliser la 1re semaine entamée', () => {
    const results = weekResults(
      base({
        // Sem. du 09/11 (départ samedi 14) : rien → neutre. 16/11 : réussie. 23/11 : ratée.
        // 30/11 : réussie. 07/12 (en cours) : renfo seulement → ouverte.
        renfoDays: ['2026-11-17', '2026-11-24', '2026-12-01', '2026-12-08'],
        activities: [run('2026-11-19'), run('2026-12-03')],
      }),
    );
    expect(results.map((r) => r.verdict)).toEqual(['neutral', 'success', 'missed', 'success', 'open']);
    expect(regularity(results)).toEqual({ total: 2, recent: 2, window: 3 });
  });

  it('la semaine en cours compte dès qu’elle est réussie', () => {
    const results = weekResults(base({ renfoDays: ['2026-12-08'], activities: [run('2026-12-09')] }));
    expect(results.at(-1)!.verdict).toBe('success');
    expect(regularity(results).total).toBe(1);
  });

  it('une semaine en pause est neutre, sauf si l’objectif a été atteint', () => {
    const results = weekResults(
      base({
        renfoDays: ['2026-11-24'],
        activities: [run('2026-11-25')],
        // Pause du 18/11 au 29/11 : la semaine du 16 est neutre, celle du 23 reste réussie.
        pauses: [{ from: '2026-11-18', until: '2026-11-29' }],
      }),
    );
    expect(results.slice(1, 3).map((r) => [r.verdict, r.paused])).toEqual([
      ['neutral', true],
      ['success', true],
    ]);
  });

  it('juge chaque semaine sur l’objectif de l’époque', () => {
    const goals = recordGoalChange([], '2026-11-30', { strength: 2, cardio: 0 }, goal);
    const results = weekResults(
      base({
        renfoDays: ['2026-11-17', '2026-12-01', '2026-12-03'],
        activities: [run('2026-11-18')],
        goals,
        currentGoal: { strength: 2, cardio: 0 },
      }),
    );
    // 16/11 : 1 + 1 réussi ; 23/11 : raté ; 30/11 : 2 renfos, nouvel objectif atteint.
    expect(results.slice(1, 4).map((r) => r.verdict)).toEqual(['success', 'missed', 'success']);
  });

  it('« X sur les 6 dernières » ne garde que les 6 dernières semaines jugées', () => {
    const renfoDays: string[] = [];
    const activities: Activity[] = [];
    // 8 semaines réussies du 16/11 au 11/01, puis une ratée.
    for (let w = 0; w < 8; w++) {
      const d = new Date(2026, 10, 17 + 7 * w);
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      renfoDays.push(day);
      activities.push(run(day));
    }
    const results = weekResults(base({ today: '2027-01-20', renfoDays, activities }));
    expect(regularity(results)).toEqual({ total: 8, recent: 5, window: 6 });
  });

  it('départ : la 1re phase, sinon la 1re séance', () => {
    expect(regularityStart([{ id: 'holidays', since: '2026-11-14' }], ['2026-11-07'], [])).toBe('2026-11-14');
    expect(regularityStart([], ['2026-11-08'], [run('2026-11-07'), { type: 'commute', day: '2026-11-01', at: AT, trips: 1 }])).toBe(
      '2026-11-07',
    );
    expect(regularityStart([], [], [])).toBeNull();
  });
});
