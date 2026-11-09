/**
 * Bilan du dimanche (J6b, SPEC §4.10, décisions du 09/11). Fonctions pures, testées dans
 * weekReview.test.ts.
 *
 *  - Proposé sur l'accueil le dimanche dès 17 h, rattrapable le lundi jusqu'à midi ; sans
 *    notification. Une fois l'objectif de la semaine suivante confirmé, il ne revient pas.
 *  - Un seul écran : la semaine (objectif, séances, minutes), ce dont être fier (niveaux
 *    débloqués, records, badges, pièce de puzzle), la tendance de poids, l'assiette (bilans,
 *    écarts et leur déclencheur le plus fréquent), le genou ; puis l'objectif suivant.
 */
import { mondayOf } from './calendar';
import { addDays, dayToDate } from './days';
import type { WorkoutRecord } from './history';
import type { LevelHistoryEntry } from './progression';
import { newRecords, type NewRecord } from './records';
import type { Activity, KneeLog } from './recovery';

/** Le bilan s'ouvre le dimanche à cette heure… */
export const REVIEW_FROM_HOUR = 17;
/** … et se rattrape le lundi jusqu'à cette heure. */
export const REVIEW_UNTIL_HOUR = 12;

/**
 * Lundi de la semaine dont le bilan est à faire maintenant, ou null. `doneFor` : lundi de la
 * dernière semaine dont le bilan a été confirmé. `since` : début du compte (rien avant).
 */
export function weekReviewDue(now: Date, today: string, doneFor: string | undefined, since: string | null): string | null {
  const weekday = dayToDate(today).getDay(); // 0 = dimanche
  let monday: string | null = null;
  if (weekday === 0 && now.getHours() >= REVIEW_FROM_HOUR) monday = mondayOf(today);
  else if (weekday === 1 && now.getHours() < REVIEW_UNTIL_HOUR) monday = addDays(today, -7);
  if (!monday || !since || addDays(monday, 6) < since) return null;
  return doneFor === monday ? null : monday;
}

/** Ce dont être fier cette semaine-là. */
export interface WeekHighlights {
  /** Mouvements montés d'un niveau (mouvement, nouveau niveau). */
  levelUps: { movementId: string; level: number }[];
  /** Records battus pendant la semaine (le meilleur par variante). */
  records: NewRecord[];
  /** Plus longue course de tous les temps, battue cette semaine (minutes). */
  longestRun?: number;
  /** Score de genou le plus haut de la semaine (null : rien de noté). */
  kneeMax: number | null;
}

export function weekHighlights(
  monday: string,
  workouts: readonly WorkoutRecord[],
  activities: readonly Activity[],
  levelHistory: readonly LevelHistoryEntry[],
  kneeLogs: readonly KneeLog[],
  dayOf: (iso: string) => string,
): WeekHighlights {
  const sunday = addDays(monday, 6);
  const inWeek = (day: string) => day >= monday && day <= sunday;

  // Niveaux : le plus haut niveau atteint dans la semaine, s'il dépasse celui d'avant.
  const levelUps: { movementId: string; level: number }[] = [];
  const before = new Map<string, number>();
  const best = new Map<string, number>();
  for (const h of [...levelHistory].sort((a, b) => a.at.localeCompare(b.at))) {
    const day = dayOf(h.at);
    if (day < monday) before.set(h.movementId, h.level);
    else if (inWeek(day)) best.set(h.movementId, Math.max(best.get(h.movementId) ?? -1, h.level));
  }
  for (const [movementId, level] of best) {
    const prev = before.get(movementId);
    if (prev !== undefined && level > prev) levelUps.push({ movementId, level });
  }

  // Records : chaque séance de la semaine face à tout ce qui la précède ; le meilleur par variante.
  const records: NewRecord[] = [];
  for (const w of workouts.filter((x) => inWeek(dayOf(x.endedAt))).sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    for (const r of newRecords(w, workouts)) {
      const same = records.find((x) => x.variantId === r.variantId && x.band === r.band);
      if (same) same.value = Math.max(same.value, r.value);
      else records.push({ ...r });
    }
  }

  const runMinutes = (a: Activity) => (a.type === 'run' || (a.type === 'imposed' && a.kind === 'run') ? a.minutes : 0);
  const bestBefore = Math.max(0, ...activities.filter((a) => a.day < monday).map(runMinutes));
  const bestThisWeek = Math.max(0, ...activities.filter((a) => inWeek(a.day)).map(runMinutes));
  const knees = kneeLogs.filter((k) => inWeek(dayOf(k.date))).map((k) => k.score);

  return {
    levelUps,
    records,
    ...(bestThisWeek > bestBefore && bestBefore > 0 ? { longestRun: bestThisWeek } : {}),
    kneeMax: knees.length ? Math.max(...knees) : null,
  };
}
