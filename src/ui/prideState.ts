/**
 * Fierté côté interface (J6b) : badges, puzzle de poids, test pompes du mois, bilan du dimanche.
 * Relie les fonctions pures (src/domain/badges.ts, puzzle.ts, pushupTest.ts, weekReview.ts) aux
 * données de l'appli.
 *
 * Les badges franchis sont enregistrés dès qu'ils le sont (réglage `badges`, jamais effacé) : un
 * effet surveille les données et n'écrit que s'il y a du nouveau.
 */
import { effect } from '@preact/signals';
import { BADGES } from '../data/badges';
import { CATALOG } from '../data/catalog';
import { track } from '../data/usage';
import { badgeStates, earnedBadges, weightBadges, type BadgeState } from '../domain/badges';
import { addDays, dayKey } from '../domain/days';
import { currentPuzzle, type Puzzle } from '../domain/puzzle';
import { pushupTestDue } from '../domain/pushupTest';
import { regularityStart } from '../domain/regularity';
import type { WeekGoal } from '../domain/week';
import { weekReviewDue } from '../domain/weekReview';
import { trend, weightGoals } from './bodyState';
import { setWeekGoal } from './phaseState';
import { levelHistory, prefs, ready, setPref } from './state';
import { activities, renfoDays, workouts } from './training';
import { weekRegularity } from './weekState';

/** Jour local d'une date ISO. */
export const dayOfIso = (iso: string) => dayKey(new Date(iso));

// ─── Badges ───

/** Tous les badges, gagnés ou non, avec la progression (étapes de poids comprises). */
export function badgeList(now = new Date()): BadgeState[] {
  return badgeStates([...BADGES, ...weightBadges(weightGoals.value)], {
    renfoDays: renfoDays.value,
    activities: activities.value,
    levelHistory: levelHistory.value,
    weeks: weekRegularity(now).results,
    trend: trend.value,
    today: dayKey(now),
    dayOf: dayOfIso,
  });
}

/** Enregistre les badges qui viennent d'être franchis (rien si rien de neuf). */
async function syncBadges(): Promise<void> {
  const { all, fresh } = earnedBadges(badgeList(), prefs.value.badges);
  if (fresh.length === 0) return;
  await setPref('badges', all);
  track('badge', { ids: fresh.filter((id) => !id.startsWith('weight-')), weight: fresh.some((id) => id.startsWith('weight-')) });
}

effect(() => {
  if (ready.value) void syncBadges().catch(() => undefined);
});

// ─── Puzzle ───

export function puzzleNow(): Puzzle | null {
  return currentPuzzle(trend.value, weightGoals.value);
}

// ─── Test pompes ───

/** Test pompes du mois à proposer aujourd'hui (et le dernier test), ou null. */
export function pushupTestNow(now = new Date()) {
  return pushupTestDue(activities.value, workouts.value, CATALOG, dayKey(now), prefs.value.pushupTestSnoozed || undefined);
}

export async function snoozePushupTest(now = new Date()): Promise<void> {
  await setPref('pushupTestSnoozed', dayKey(now));
  track('pushup-test', { action: 'later' });
}

// ─── Bilan du dimanche ───

/** Lundi de la semaine dont le bilan est à faire maintenant, ou null. */
export function weekReviewNow(now = new Date()): string | null {
  const start = regularityStart(prefs.value.phases, renfoDays.value, activities.value);
  return weekReviewDue(now, dayKey(now), prefs.value.weekReviewDone || undefined, start);
}

/** Confirme l'objectif de la semaine suivante : il part du lundi qui suit la semaine `monday`. */
export async function confirmWeekReview(monday: string, goal: WeekGoal, now = new Date()): Promise<void> {
  await setWeekGoal(goal, now, addDays(monday, 7));
  await setPref('weekReviewDone', monday);
  track('week-review', { action: 'confirm', monday, ...goal });
}
