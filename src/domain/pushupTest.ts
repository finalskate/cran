/**
 * Test pompes mensuel (J6b, SPEC §1.1 et §4.10). Fonctions pures, testées dans pushupTest.test.ts.
 *
 *  - Proposé sur l'accueil à partir du 1er du mois, tant que le test du mois n'est pas fait.
 *  - Jamais le lendemain d'une séance avec des pompes (bras fatigués = test faussé) : la carte
 *    attend un jour. « Plus tard » la range jusqu'au lendemain.
 *  - Deux formats, deux records : maison (main à plat, poitrine au sol, plus strict) et pro
 *    (main à plat, poitrine sur la cale). On le note après coup : pas de compteur à toucher
 *    pendant l'effort.
 *  - Il vaut la série longue de pompes de la semaine (le moteur ne la repropose pas).
 */
import { addDays, dayKey } from './days';
import type { WorkoutRecord } from './history';
import type { Activity, PushupFormat, PushupTestActivity } from './recovery';
import type { Movement } from './types';

/** Le cap symbolique (exigence professionnelle, SPEC §1.1). */
export const PUSHUP_TEST_GOAL = 50;

/** Tests pompes notés, du plus ancien au plus récent. */
export function pushupTests(activities: readonly Activity[]): PushupTestActivity[] {
  return activities
    .filter((a): a is PushupTestActivity => a.type === 'pushup-test')
    .sort((a, b) => a.day.localeCompare(b.day) || a.at.localeCompare(b.at));
}

/** Meilleur test d'un format (null : jamais fait). */
export function bestTest(activities: readonly Activity[], format: PushupFormat): PushupTestActivity | null {
  let best: PushupTestActivity | null = null;
  for (const t of pushupTests(activities)) if (t.format === format && (!best || t.reps > best.reps)) best = t;
  return best;
}

/** Une séance de ce jour a-t-elle fait travailler les pompes (mouvements « pousser », série longue) ? */
function pushedOn(day: string, workouts: readonly WorkoutRecord[], catalog: readonly Movement[]): boolean {
  return workouts.some(
    (w) =>
      dayKey(new Date(w.endedAt)) === day &&
      w.entries.some((e) => e.sets.length > 0 && ['push', 'volume'].includes(catalog.find((m) => m.id === e.movementId)?.category ?? '')),
  );
}

/**
 * Le test du mois est-il à proposer aujourd'hui ? Renvoie le dernier test (pour « Dernier : 42 »)
 * ou `null` s'il n'y a rien à proposer.
 */
export function pushupTestDue(
  activities: readonly Activity[],
  workouts: readonly WorkoutRecord[],
  catalog: readonly Movement[],
  today: string,
  snoozedUntil?: string,
): { last: PushupTestActivity | null } | null {
  const tests = pushupTests(activities);
  if (tests.some((t) => t.day.slice(0, 7) === today.slice(0, 7))) return null;
  if (snoozedUntil && today <= snoozedUntil) return null;
  if (pushedOn(addDays(today, -1), workouts, catalog)) return null;
  return { last: tests.at(-1) ?? null };
}

/** Résultat d'un test, comparé aux précédents du même format. */
export interface TestOutcome {
  record: boolean;
  /** Écart avec le test précédent du même format (absent : premier test de ce format). */
  delta?: number;
  /** Ancien record de ce format. */
  previousBest?: number;
}

export function testOutcome(test: PushupTestActivity, activities: readonly Activity[]): TestOutcome {
  // Les tests d'avant, du même format (l'instant de saisie les départage).
  const before = pushupTests(activities).filter((t) => t.format === test.format && t.at < test.at);
  if (before.length === 0) return { record: false };
  const previousBest = Math.max(...before.map((t) => t.reps));
  return { record: test.reps > previousBest, delta: test.reps - before.at(-1)!.reps, previousBest };
}
