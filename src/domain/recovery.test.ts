/**
 * Tests de la récupération, de la charge sur les jambes et des règles genou. Données fictives.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import type { WorkoutRecord } from './history';
import {
  askMorningKnee,
  kineAlert,
  legsLoaded,
  morningWorseToday,
  sessionDoneToday,
  workedRecently,
  type ImposedActivity,
  type KneeLog,
} from './recovery';

/** Samedi 14 novembre 2026, 9 h (heure locale). */
const NOW = new Date(2026, 10, 14, 9);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

const legs = CATALOG.find((m) => m.category === 'legs')!;
const push = CATALOG.find((m) => m.category === 'push')!;

function workout(endedAt: string, movements: string[]): WorkoutRecord {
  return {
    startedAt: endedAt,
    endedAt,
    locationId: 'home',
    duration: 20,
    kneeScore: 0,
    entries: movements.map((movementId) => ({ movementId, variantId: 'x', level: 0, sets: [{ value: 8 }] })),
  };
}

function imposed(day: string, at: string, legsUsed = true): ImposedActivity {
  return { type: 'imposed', day, at, minutes: 45, kind: 'circuit', legs: legsUsed, intensity: 'hard' };
}

describe('séance du jour', () => {
  it('sait qu’une séance a déjà été faite aujourd’hui', () => {
    expect(sessionDoneToday([workout(hoursAgo(2), [push.id])], NOW)).toBe(true);
    expect(sessionDoneToday([workout(hoursAgo(12), [push.id])], NOW)).toBe(false); // hier soir
  });

  it('liste les mouvements principaux des 48 dernières heures', () => {
    const history = [workout(hoursAgo(30), [push.id]), workout(hoursAgo(60), [legs.id])];
    expect(workedRecently(history, CATALOG, NOW)).toEqual([push.id]);
  });
});

describe('charge sur les jambes', () => {
  it('ménage les jambes moins de 24 h après une séance imposée « jambes »', () => {
    // Saisie le jour même juste après : datée de la saisie.
    expect(legsLoaded([imposed('2026-11-13', new Date(2026, 10, 13, 17).toISOString())], NOW)).toBe(true);
    expect(legsLoaded([imposed('2026-11-12', new Date(2026, 10, 12, 17).toISOString())], NOW)).toBe(false);
    expect(legsLoaded([imposed('2026-11-13', new Date(2026, 10, 13, 17).toISOString(), false)], NOW)).toBe(false);
  });

  it('place à midi une séance saisie après coup', () => {
    // Séance d'hier saisie ce matin : midi hier, il y a 21 h.
    expect(legsLoaded([imposed('2026-11-13', hoursAgo(1))], NOW)).toBe(true);
    // Séance d'avant-hier saisie ce matin : midi avant-hier, il y a 45 h.
    expect(legsLoaded([imposed('2026-11-12', hoursAgo(1))], NOW)).toBe(false);
  });
});

describe('genou', () => {
  const yesterdayEvening = new Date(2026, 10, 13, 19).toISOString();

  it('pose la question du matin après une séance de jambes la veille', () => {
    expect(askMorningKnee(NOW, [workout(yesterdayEvening, [legs.id])], [], [], CATALOG)).toBe(true);
    expect(askMorningKnee(NOW, [workout(yesterdayEvening, [push.id])], [], [], CATALOG)).toBe(false);
    expect(askMorningKnee(NOW, [], [imposed('2026-11-13', yesterdayEvening)], [], CATALOG)).toBe(true);
  });

  it('ne la pose qu’une fois, et seulement le matin', () => {
    const answered: KneeLog = { date: hoursAgo(1), score: 0, context: 'morning', worse: false };
    expect(askMorningKnee(NOW, [workout(yesterdayEvening, [legs.id])], [], [answered], CATALOG)).toBe(false);
    const afternoon = new Date(2026, 10, 14, 15);
    expect(askMorningKnee(afternoon, [workout(yesterdayEvening, [legs.id])], [], [], CATALOG)).toBe(false);
  });

  it('retient un genou « plus mal » ce matin', () => {
    expect(morningWorseToday([{ date: hoursAgo(1), score: 3, context: 'morning', worse: true }], NOW)).toBe(true);
    expect(morningWorseToday([{ date: hoursAgo(30), score: 3, context: 'morning', worse: true }], NOW)).toBe(false);
  });

  it('suggère un kiné après 3 scores ≥ 3 en 7 jours', () => {
    const log = (h: number, score: number): KneeLog => ({ date: hoursAgo(h), score, context: 'session' });
    expect(kineAlert([log(10, 3), log(50, 4), log(100, 3)], NOW)).toBe(true);
    expect(kineAlert([log(10, 3), log(50, 2), log(100, 3)], NOW)).toBe(false);
    expect(kineAlert([log(10, 3), log(50, 4), log(200, 3)], NOW)).toBe(false);
  });
});
