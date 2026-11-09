/**
 * Régularité (J6a, SPEC §4.10) : semaines réussies, mode pause, objectif de chaque semaine.
 * Fonctions pures, testées dans regularity.test.ts.
 *
 * ─── Principes (SPEC §2.3, décisions du 09/11) ───
 *  - On compte des SEMAINES réussies, jamais des jours d'affilée, et rien ne « casse » : on
 *    affiche « 12 semaines réussies · 5 sur les 6 dernières ». Une semaine ratée ne retire rien.
 *  - Une semaine est réussie quand l'objectif de CETTE semaine-là est atteint (l'objectif peut
 *    changer d'une phase à l'autre : on garde l'historique de ses changements).
 *  - Une semaine touchée par une pause (maladie, coup de bourre, choix) est neutre : ni réussie
 *    ni ratée, elle n'entre pas dans « X sur les 6 dernières ». Si l'objectif a quand même été
 *    atteint, elle compte comme réussie (on ne retire jamais un succès).
 *  - L'éloignement n'est PAS une pause : il a son propre objectif (2 + 2, src/data/phases.ts).
 *  - Le compte démarre avec la 1re phase choisie (le vrai départ), sinon à la 1re séance notée.
 *    La 1re semaine, souvent entamée en cours de route, ne compte que si elle est réussie.
 */
import { mondayOf } from './calendar';
import { addDays } from './days';
import type { PhaseEntry } from './phase';
import type { Activity } from './recovery';
import { activityGoal, goalReached, trainingWeek, type WeekGoal } from './week';

// ─── Mode pause ───

/** Une pause : du jour `from` au jour `until` inclus (absent : jusqu'à nouvel ordre). */
export interface PauseEntry {
  from: string;
  until?: string;
}

/** Le jour `day` est-il dans une pause ? */
export function pausedOn(pauses: readonly PauseEntry[], day: string): boolean {
  return pauses.some((p) => p.from <= day && (p.until === undefined || day <= p.until));
}

/** La pause en cours aujourd'hui, ou null. */
export function activePause(pauses: readonly PauseEntry[], today: string): PauseEntry | null {
  return pauses.find((p) => p.from <= today && (p.until === undefined || today <= p.until)) ?? null;
}

/**
 * Met en pause à partir d'aujourd'hui, jusqu'au jour `until` inclus (ou jusqu'à nouvel ordre).
 * Une pause déjà en cours est remplacée (on change seulement sa fin), sans perdre son début.
 */
export function startPause(pauses: readonly PauseEntry[], today: string, until?: string): PauseEntry[] {
  const current = activePause(pauses, today);
  const from = current?.from ?? today;
  const kept = pauses.filter((p) => p !== current);
  return [...kept, { from, ...(until ? { until } : {}) }].sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Reprise aujourd'hui : la pause en cours s'arrête hier. Commencée aujourd'hui même, elle est
 * simplement retirée (aujourd'hui redevient un jour normal).
 */
export function endPause(pauses: readonly PauseEntry[], today: string): PauseEntry[] {
  const current = activePause(pauses, today);
  if (!current) return [...pauses];
  const kept = pauses.filter((p) => p !== current);
  if (current.from >= today) return kept;
  return [...kept, { from: current.from, until: addDays(today, -1) }].sort((a, b) => a.from.localeCompare(b.from));
}

// ─── Objectif de chaque semaine ───

/** Un objectif de la semaine et le jour où il a pris effet. */
export interface GoalChange {
  since: string;
  goal: WeekGoal;
}

/** Jour fictif « depuis toujours » : l'objectif en place avant le tout premier changement noté. */
export const SINCE_ALWAYS = '0000-01-01';

/**
 * Note un changement d'objectif fait le jour `day`. Au premier changement, l'objectif d'avant
 * (`previous`) est gardé « depuis toujours » : les semaines passées restent jugées sur lui.
 * Plusieurs changements le même jour : le dernier gagne.
 */
export function recordGoalChange(log: readonly GoalChange[], day: string, goal: WeekGoal, previous: WeekGoal): GoalChange[] {
  const base = log.length === 0 ? [{ since: SINCE_ALWAYS, goal: previous }] : log.filter((c) => c.since !== day);
  return [...base, { since: day, goal }].sort((a, b) => a.since.localeCompare(b.since));
}

/** Objectif en vigueur le jour `day` (`fallback` : aucun changement noté avant ce jour). */
export function goalOn(log: readonly GoalChange[], day: string, fallback: WeekGoal): WeekGoal {
  let goal = fallback;
  for (const c of log) if (c.since <= day) goal = c.goal;
  return goal;
}

// ─── Semaines réussies ───

/**
 * success : objectif atteint ; missed : semaine finie, objectif pas atteint (montré neutre, jamais
 * en rouge) ; neutral : pause, 1re semaine incomplète ou objectif à zéro ; open : semaine en cours,
 * pas encore atteint.
 */
export type WeekVerdict = 'success' | 'missed' | 'neutral' | 'open';

export interface WeekResult {
  monday: string;
  verdict: WeekVerdict;
  goal: WeekGoal;
  /** Une pause a touché cette semaine. */
  paused: boolean;
}

/**
 * Début du compte : le 1er jour de la 1re phase choisie (le vrai départ, SPEC §1.3), sinon le
 * jour de la 1re séance (renfo, course, vélo, imposée ; le vélotaf ne compte pas). Null : rien
 * à compter encore.
 */
export function regularityStart(
  phases: readonly PhaseEntry[],
  renfoDays: readonly string[],
  activities: readonly Activity[],
): string | null {
  if (phases.length > 0) return phases[0]!.since;
  const days = [...renfoDays, ...activities.filter((a) => activityGoal(a) !== null).map((a) => a.day)].sort();
  return days[0] ?? null;
}

export interface RegularityInput {
  start: string | null;
  today: string;
  renfoDays: readonly string[];
  activities: readonly Activity[];
  goals: readonly GoalChange[];
  /** Objectif actuel : vaut pour toutes les semaines si aucun changement n'a été noté. */
  currentGoal: WeekGoal;
  pauses: readonly PauseEntry[];
}

/** Verdict de chaque semaine, du début du compte à la semaine en cours (incluse, en dernier). */
export function weekResults(input: RegularityInput): WeekResult[] {
  if (!input.start || input.start > input.today) return [];
  const out: WeekResult[] = [];
  const firstMonday = mondayOf(input.start);
  const currentMonday = mondayOf(input.today);
  for (let monday = firstMonday; monday <= currentMonday; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    const current = monday === currentMonday;
    // L'objectif de la semaine : celui en vigueur à sa fin (ou aujourd'hui pour la semaine en cours).
    const goal = goalOn(input.goals, current ? input.today : sunday, input.currentGoal);
    const week = trainingWeek(monday, input.renfoDays, input.activities);
    const lastDay = current ? input.today : sunday;
    const paused = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).some((d) => d <= lastDay && pausedOn(input.pauses, d));
    const empty = goal.strength + goal.cardio === 0;
    let verdict: WeekVerdict;
    if (!empty && goalReached(week, goal)) verdict = 'success';
    else if (current) verdict = 'open';
    else if (paused || empty || monday === firstMonday) verdict = 'neutral';
    else verdict = 'missed';
    out.push({ monday, verdict, goal, paused });
  }
  return out;
}

/** Fenêtre de « X sur les N dernières ». */
export const RECENT_WEEKS = 6;

export interface Regularity {
  /** Semaines réussies depuis le début (la semaine en cours dès qu'elle est réussie). */
  total: number;
  /** Réussies parmi les dernières semaines jugées (au plus RECENT_WEEKS). */
  recent: number;
  /** Nombre de semaines jugées dans la fenêtre (≤ RECENT_WEEKS). */
  window: number;
}

/**
 * Résumé : semaines réussies, et la part des dernières semaines jugées (réussies ou ratées ; les
 * semaines neutres et la semaine en cours pas encore réussie n'en font pas partie).
 */
export function regularity(results: readonly WeekResult[]): Regularity {
  const judged = results.filter((r) => r.verdict === 'success' || r.verdict === 'missed');
  const last = judged.slice(-RECENT_WEEKS);
  return {
    total: judged.filter((r) => r.verdict === 'success').length,
    recent: last.filter((r) => r.verdict === 'success').length,
    window: last.length,
  };
}
