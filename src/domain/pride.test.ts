/**
 * Tests du J6b : test pompes, puzzle de poids, badges, bilan du dimanche, séries de la semaine,
 * avertissement du planning. Données fictives (aucune valeur personnelle).
 */
import { describe, expect, it } from 'vitest';
import { badgeStates, earnedBadges, weightBadges, type BadgeDef } from './badges';
import type { TrendPoint } from './body';
import type { WorkoutRecord } from './history';
import { setsByFamily } from './history';
import { currentPuzzle, pieceThresholds, puzzleGrid } from './puzzle';
import { bestTest, pushupTestDue, testOutcome } from './pushupTest';
import type { Activity, PushupTestActivity } from './recovery';
import type { Movement } from './types';
import { weekHighlights, weekReviewDue } from './weekReview';
import { choiceWarning, planWeek } from './weekPlan';

const dayOf = (iso: string) => iso.slice(0, 10);
const CATALOG = [
  { id: 'push-h', category: 'push' },
  { id: 'pull-v', category: 'pull' },
  { id: 'squat', category: 'legs' },
  { id: 'pushup-volume', category: 'volume' },
] as unknown as Movement[];

const test = (day: string, reps: number, format: 'home' | 'pro' = 'home'): PushupTestActivity => ({
  type: 'pushup-test',
  day,
  at: `${day}T18:00:00.000Z`,
  format,
  reps,
});
const workout = (day: string, movementId: string, values: number[]): WorkoutRecord => ({
  startedAt: `${day}T17:00:00.000Z`,
  endedAt: `${day}T17:30:00.000Z`,
  locationId: 'home',
  duration: 20,
  kneeScore: 0,
  entries: [{ movementId, variantId: `${movementId}-v`, level: 1, sets: values.map((value) => ({ value })) }],
});

describe('test pompes', () => {
  it('proposé dès le 1er du mois, jamais le lendemain de pompes, une fois par mois', () => {
    const acts: Activity[] = [test('2026-11-03', 42)];
    expect(pushupTestDue(acts, [], CATALOG, '2026-11-20')).toBeNull(); // déjà fait en novembre
    expect(pushupTestDue(acts, [], CATALOG, '2026-12-01')).toEqual({ last: acts[0] });
    const pushedYesterday = [workout('2026-11-30', 'push-h', [10])];
    expect(pushupTestDue(acts, pushedYesterday, CATALOG, '2026-12-01')).toBeNull();
    expect(pushupTestDue(acts, [workout('2026-11-30', 'squat', [10])], CATALOG, '2026-12-01')).not.toBeNull();
    expect(pushupTestDue(acts, [], CATALOG, '2026-12-01', '2026-12-01')).toBeNull(); // « Plus tard »
  });

  it('un record par format', () => {
    const acts = [test('2026-11-03', 42), test('2026-11-04', 48, 'pro'), test('2026-12-01', 46)];
    expect(bestTest(acts, 'home')?.reps).toBe(46);
    expect(testOutcome(acts[2]!, acts)).toEqual({ record: true, delta: 4, previousBest: 42 });
    expect(testOutcome(acts[1]!, acts)).toEqual({ record: false });
  });
});

describe('puzzle de poids', () => {
  it('une pièce tous les 2 kg, la dernière sur l’étape', () => {
    expect(pieceThresholds(80, 72.5)).toEqual([78, 76, 74, 72.5]);
    expect(pieceThresholds(80, 79)).toEqual([79]);
    expect(pieceThresholds(100, 60)).toHaveLength(12); // pièces élargies au-delà de 12
  });

  const series = (values: number[]): TrendPoint[] =>
    values.map((t, i) => ({ day: `2026-11-${String(10 + i).padStart(2, '0')}`, kg: t, trend: t, gapBefore: false }));

  it('pièces gagnées sur la tendance la plus basse, jamais reprises', () => {
    const p = currentPuzzle(series([80, 79, 77.9, 78.5]), [72.5, 65])!;
    expect(p).toMatchObject({ goal: 72.5, from: 80, earned: 1, earnedOn: ['2026-11-12'] });
  });

  it('étape atteinte : le puzzle suivant part de l’étape', () => {
    const p = currentPuzzle(series([80, 76, 72.4]), [72.5, 65])!;
    expect(p).toMatchObject({ goal: 65, from: 72.5, earned: 0 });
    expect(currentPuzzle(series([80, 64]), [72.5, 65])).toBeNull();
    expect(puzzleGrid(4)).toEqual({ cols: 2, rows: 2 });
  });
});

describe('badges', () => {
  const defs: BadgeDef[] = [
    { id: 'level-1', kind: 'level', threshold: 1, label: '', medal: '' },
    { id: 'sessions-2', kind: 'sessions', threshold: 2, label: '', medal: '' },
    { id: 'run-60', kind: 'run', threshold: 60, label: '', medal: '' },
    ...weightBadges([78]),
  ];
  const input = {
    renfoDays: ['2026-11-10', '2026-11-12'],
    activities: [
      { type: 'run', day: '2026-11-15', at: '', minutes: 62, kind: 'easy', feel: 'ok', kneeAfter: 0 },
      { type: 'commute', day: '2026-11-11', at: '', trips: 2 },
    ] as Activity[],
    levelHistory: [
      { movementId: 'push-h', level: 3, at: '2026-11-07T10:00:00Z' }, // choix de départ : pas un déblocage
      { movementId: 'push-h', level: 4, at: '2026-11-14T10:00:00Z' },
    ],
    weeks: [],
    trend: [
      { day: '2026-11-10', kg: 80, trend: 80, gapBefore: false },
      { day: '2026-11-16', kg: 77.8, trend: 77.9, gapBefore: false },
    ],
    today: '2026-11-16',
    dayOf,
  };

  it('date chaque badge au jour du franchissement', () => {
    const states = badgeStates(defs, input);
    expect(states.map((s) => s.reachedOn)).toEqual(['2026-11-14', '2026-11-12', '2026-11-15', '2026-11-16']);
  });

  it('un badge gagné ne se perd jamais', () => {
    const states = badgeStates(defs, { ...input, trend: [{ day: '2026-11-10', kg: 80, trend: 80, gapBefore: false }] });
    const { all, fresh } = earnedBadges(states, { 'weight-78': '2026-11-16' });
    expect(all['weight-78']).toBe('2026-11-16');
    expect(fresh).toEqual(['level-1', 'sessions-2', 'run-60']);
  });
});

describe('bilan du dimanche', () => {
  const at = (day: string, h: number) => {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d, h);
  };

  it('dimanche dès 17 h, rattrapable lundi avant midi, une seule fois', () => {
    expect(weekReviewDue(at('2026-11-22', 16), '2026-11-22', undefined, '2026-11-14')).toBeNull();
    expect(weekReviewDue(at('2026-11-22', 17), '2026-11-22', undefined, '2026-11-14')).toBe('2026-11-16');
    expect(weekReviewDue(at('2026-11-23', 11), '2026-11-23', undefined, '2026-11-14')).toBe('2026-11-16');
    expect(weekReviewDue(at('2026-11-23', 12), '2026-11-23', undefined, '2026-11-14')).toBeNull();
    expect(weekReviewDue(at('2026-11-22', 18), '2026-11-22', '2026-11-16', '2026-11-14')).toBeNull();
    expect(weekReviewDue(at('2026-11-08', 18), '2026-11-08', undefined, '2026-11-14')).toBeNull(); // avant le départ
  });

  it('niveaux, records, plus longue course et genou de la semaine', () => {
    const workouts = [workout('2026-11-10', 'push-h', [10, 11]), workout('2026-11-18', 'push-h', [12, 12])];
    const acts: Activity[] = [
      { type: 'run', day: '2026-11-11', at: '', minutes: 40, kind: 'easy', feel: 'ok', kneeAfter: 0 },
      { type: 'run', day: '2026-11-21', at: '', minutes: 45, kind: 'easy', feel: 'ok', kneeAfter: 1 },
    ];
    const history = [
      { movementId: 'push-h', level: 3, at: '2026-11-07T10:00:00Z' },
      { movementId: 'push-h', level: 4, at: '2026-11-19T10:00:00Z' },
    ];
    const knee = [{ date: '2026-11-21T18:00:00Z', score: 1, context: 'run' as const }];
    const h = weekHighlights('2026-11-16', workouts, acts, history, knee, dayOf);
    expect(h.levelUps).toEqual([{ movementId: 'push-h', level: 4 }]);
    expect(h.records).toEqual([{ movementId: 'push-h', variantId: 'push-h-v', value: 12, previous: 11 }]);
    expect(h.longestRun).toBe(45);
    expect(h.kneeMax).toBe(1);
  });
});

describe('séries de la semaine et planning', () => {
  it('compte les séries par famille, la série longue avec « pousser »', () => {
    const ws = [workout('2026-11-16', 'push-h', [8, 8, 8]), workout('2026-11-17', 'pushup-volume', [30]), workout('2026-11-25', 'pull-v', [5])];
    expect(setsByFamily(ws, CATALOG, '2026-11-16', '2026-11-22', dayOf)).toEqual({ push: 4 });
  });

  it('signale sans l’interdire un choix qui enfreint une règle', () => {
    const plan = planWeek({
      monday: '2026-11-16',
      today: '2026-11-17',
      hour: 8,
      done: { '2026-11-16': { strength: true, cardio: false, run: false, legs: true } },
      goal: { strength: 3, cardio: 2 },
      cardio: 'run',
      runSlots: [{ kind: 'base', minutes: 30 }],
      knee: 0,
      choices: {},
      focus: 'balanced',
    });
    expect(choiceWarning(plan, '2026-11-17', 'strength', 'run')).toMatch(/Deux renfos/);
    expect(choiceWarning(plan, '2026-11-17', 'cardio', 'run')).toMatch(/genou/);
    expect(choiceWarning(plan, '2026-11-17', 'cardio', 'bike')).toBeNull();
    expect(choiceWarning(plan, '2026-11-17', 'rest', 'run')).toBeNull();
  });
});
