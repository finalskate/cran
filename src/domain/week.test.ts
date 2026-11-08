/**
 * Tests de la semaine d'entraînement et de l'objectif hebdomadaire. Données fictives.
 */
import { describe, expect, it } from 'vitest';
import type { Activity } from './recovery';
import { goalReached, trainingWeek, weekOf, weeklyCardioMinutes } from './week';

const MONDAY = '2026-11-16';
const AT = '2026-11-16T17:00:00.000Z';

const acts: Activity[] = [
  { type: 'run', day: '2026-11-17', at: AT, minutes: 30, kind: 'easy', feel: 'ok', kneeAfter: 0 },
  { type: 'bike', day: '2026-11-17', at: AT, minutes: 25, kind: 'easy', feel: 'ok' },
  { type: 'commute', day: '2026-11-18', at: AT, trips: 2 },
  { type: 'commute', day: '2026-11-19', at: AT, trips: 1 },
  { type: 'imposed', day: '2026-11-19', at: AT, minutes: 45, kind: 'circuit', legs: true, intensity: 'hard' },
  { type: 'imposed', day: '2026-11-20', at: AT, minutes: 40, kind: 'run', legs: true, intensity: 'medium' },
  // Semaine suivante : ne compte pas.
  { type: 'run', day: '2026-11-23', at: AT, minutes: 35, kind: 'easy', feel: 'ok', kneeAfter: 0 },
];

describe('semaine d’entraînement', () => {
  it('compte renfo et cardio par jour, montre le vélotaf sans le compter', () => {
    // Deux séances de renfo le lundi : un seul jour compté.
    const w = trainingWeek(MONDAY, ['2026-11-16', '2026-11-16', '2026-11-21'], acts);
    expect(w.strength).toBe(3); // lundi, jeudi (circuit imposé), samedi
    expect(w.cardio).toBe(2); // mardi (course + vélo = un jour), vendredi (course imposée)
    expect(w.runMinutes).toBe(70);
    expect(w.bikeMinutes).toBe(25);
    expect(w.commuteTrips).toBe(3);
    expect(w.days.map((d) => d.commute)).toEqual([0, 0, 2, 1, 0, 0, 0]);
    expect(goalReached(w, { strength: 3, cardio: 2 })).toBe(true);
    expect(goalReached(w, { strength: 4, cardio: 2 })).toBe(false);
  });

  it('retrouve la semaine d’un jour quelconque', () => {
    expect(weekOf('2026-11-22', [], acts).monday).toBe(MONDAY);
  });

  it('minutes de cardio par semaine', () => {
    expect(weeklyCardioMinutes(acts, '2026-11-25', 3)).toEqual([
      { monday: '2026-11-09', run: 0, bike: 0 },
      { monday: MONDAY, run: 70, bike: 25 },
      { monday: '2026-11-23', run: 35, bike: 0 },
    ]);
  });
});
