/**
 * Double progression (SPEC §4.5), fonctions pures testées dans progression.test.ts.
 *
 * Chaque variante a une fourchette (ex. 6–12 répétitions, 20–40 s). On ajoute des répétitions
 * d'une séance à l'autre jusqu'au haut de la fourchette, sur TOUTES les séries :
 *  - objectif du jour = la série la plus faible de la dernière fois, + 1 cran si rien n'a été
 *    « Dur » (sinon on consolide) ;
 *  - deux séances validées au niveau actuel (toutes les séries au haut de la fourchette, aucune
 *    « Dur ») → la variante suivante est débloquée ;
 *  - deux séances de suite sous le bas de la fourchette → on propose de revenir un cran en
 *    arrière, sans le présenter comme un échec ;
 *  - reprise après une pause (≥ 10 jours sans la variante) : on repart 2 crans en dessous.
 *
 * Seules les séances faites DEPUIS le dernier changement de niveau comptent : après un retour
 * en arrière, les anciennes séances validées ne redébloquent pas aussitôt.
 */
import type { SessionFeel, SetResult, WorkoutRecord } from './history';
import type { Movement, Target } from './types';

/** Séances validées nécessaires pour débloquer la variante suivante. */
export const UNLOCK_SESSIONS = 2;

/** Séances de suite sous la fourchette avant de proposer un retour en arrière. */
export const STEP_BACK_SESSIONS = 2;

/** Au-delà de ce délai sans une variante, on reprend plus bas (SPEC §4.5 « reprise après pause »). */
export const PAUSE_DAYS = 10;

/** Crans retirés à la reprise. */
export const PAUSE_STEPS = 2;

/** Séries minimum pour qu'une séance puisse valider (une série isolée ne prouve rien). */
export const MIN_SETS_TO_VALIDATE = 2;

/** Un cran de progression : une répétition, ou 5 secondes pour un exercice en durée. */
export function progressStep(target: Target): number {
  return target.kind === 'time' ? 5 : 1;
}

const clamp = (n: number, target: Target) => Math.min(Math.max(n, target.min), target.max);

/** Séance validée : toutes les séries au haut de la fourchette, aucune jugée « Dur ». */
export function isValidated(sets: readonly SetResult[], target: Target): boolean {
  return sets.length >= MIN_SETS_TO_VALIDATE && sets.every((s) => s.value >= target.max && s.feel !== 'hard');
}

/** Séance sous la fourchette : même la meilleure série n'atteint pas le bas. */
export function isBelow(sets: readonly SetResult[], target: Target): boolean {
  return sets.length > 0 && Math.max(...sets.map((s) => s.value)) < target.min;
}

/**
 * Objectif du jour pour chaque série d'une variante.
 * @param last séries de la dernière séance avec cette variante (absent : jamais faite)
 * @param daysSince jours écoulés depuis cette séance
 */
export function nextPrefill(last: readonly SetResult[] | undefined, target: Target, daysSince?: number): number {
  if (!last || last.length === 0) return target.min;
  const step = progressStep(target);
  const weakest = Math.min(...last.map((s) => s.value));
  const hard = last.some((s) => s.feel === 'hard');
  let next = hard ? weakest : weakest + step;
  if (daysSince !== undefined && daysSince >= PAUSE_DAYS) next = weakest - PAUSE_STEPS * step;
  return clamp(next, target);
}

/** Retrouve la fourchette d'une variante dans le catalogue. */
export function targetOf(movement: Movement, variantId: string): Target | undefined {
  for (const level of movement.levels) {
    const v = level.variants.find((x) => x.id === variantId);
    if (v) return v.target;
  }
  return undefined;
}

export type Verdict = 'unlock' | 'step-back' | null;

/**
 * Verdict sur le niveau actuel d'un mouvement, d'après les séances faites à ce niveau depuis
 * `since` (date ISO du dernier changement de niveau ; absent = tout l'historique).
 */
export function levelVerdict(
  workouts: readonly WorkoutRecord[],
  movement: Movement,
  level: number,
  since?: string,
): Verdict {
  const sessions: { sets: SetResult[]; target: Target }[] = [];
  for (const w of [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    if (since && w.startedAt < since) continue;
    for (const e of w.entries) {
      if (e.movementId !== movement.id || e.level !== level || e.sets.length === 0) continue;
      const target = targetOf(movement, e.variantId);
      if (target) sessions.push({ sets: e.sets, target });
    }
  }
  const validated = sessions.filter((s) => isValidated(s.sets, s.target)).length;
  if (validated >= UNLOCK_SESSIONS) return 'unlock';
  const recent = sessions.slice(-STEP_BACK_SESSIONS);
  if (recent.length === STEP_BACK_SESSIONS && recent.every((s) => isBelow(s.sets, s.target))) return 'step-back';
  return null;
}

/** Changement de niveau consécutif à une séance. */
export interface LevelChange {
  movementId: string;
  from: number;
  to: number;
}

/**
 * Niveaux à débloquer et retours en arrière à proposer après une séance. Seuls les mouvements
 * travaillés pendant cette séance, à leur niveau choisi, sont examinés (un niveau abaissé faute
 * de matériel ou un substitut ne compte pas).
 */
export function levelChanges(
  record: WorkoutRecord,
  workouts: readonly WorkoutRecord[],
  catalog: readonly Movement[],
  levels: Readonly<Record<string, number>>,
  since: Readonly<Record<string, string>>,
): { unlocks: LevelChange[]; stepBacks: LevelChange[] } {
  const unlocks: LevelChange[] = [];
  const stepBacks: LevelChange[] = [];
  const seen = new Set<string>();
  for (const e of record.entries) {
    if (seen.has(e.movementId)) continue;
    seen.add(e.movementId);
    const movement = catalog.find((m) => m.id === e.movementId);
    if (!movement || movement.levels.length < 2) continue;
    const level = levels[movement.id] ?? 0;
    if (e.level !== level) continue;
    const verdict = levelVerdict(workouts, movement, level, since[movement.id]);
    if (verdict === 'unlock' && level + 1 < movement.levels.length) unlocks.push({ movementId: movement.id, from: level, to: level + 1 });
    if (verdict === 'step-back' && level > 0) stepBacks.push({ movementId: movement.id, from: level, to: level - 1 });
  }
  return { unlocks, stepBacks };
}

/**
 * Le ressenti global de la dernière séance règle le VOLUME de la suivante, jamais le niveau :
 * « trop dure » → une série de moins sur les blocs principaux, « trop facile » → une de plus.
 */
export function volumeDelta(feel: SessionFeel | undefined): -1 | 0 | 1 {
  if (feel === 'too-hard') return -1;
  if (feel === 'too-easy') return 1;
  return 0;
}

// ─── Test de placement (facultatif, depuis Niveaux) ───

export type PlacementStep =
  /** Trop facile : tester le niveau au-dessus. */
  | { kind: 'up'; level: number }
  /** Trop dur : tester le niveau en dessous. */
  | { kind: 'down'; level: number }
  /** Le bon niveau est trouvé. */
  | { kind: 'placed'; level: number };

/**
 * Une série max au niveau `level` : au-dessus du haut de la fourchette, on monte ; sous le
 * bas, on descend ; dedans, c'est le bon niveau. On ne redescend pas vers un niveau d'où l'on
 * vient de monter (`cameFrom`), ce qui évite les allers-retours.
 */
export function placementStep(level: number, maxResult: number, target: Target, levelCount: number, cameFrom?: number): PlacementStep {
  if (maxResult > target.max && level + 1 < levelCount) return { kind: 'up', level: level + 1 };
  if (maxResult < target.min && level > 0) {
    if (cameFrom === level - 1) return { kind: 'placed', level: level - 1 };
    return { kind: 'down', level: level - 1 };
  }
  return { kind: 'placed', level };
}

// ─── Historique des niveaux (courbe en escalier, J3) ───

/** Un changement de niveau, tel qu'il est enregistré (table `levelHistory`). */
export interface LevelHistoryEntry {
  id?: number;
  movementId: string;
  level: number;
  /** Date ISO du changement. */
  at: string;
}

/** Une marche de l'escalier : niveau tenu à partir de `day`. */
export interface LevelStep {
  day: string;
  level: number;
}

/**
 * Marches de l'escalier d'un mouvement, de la plus ancienne à la plus récente. Plusieurs
 * changements le même jour (un test de placement suivi d'un choix) ne gardent que le dernier ;
 * deux marches de suite au même niveau sont fusionnées.
 */
export function levelSteps(history: readonly LevelHistoryEntry[], movementId: string, dayOf: (iso: string) => string): LevelStep[] {
  const byDay = new Map<string, number>();
  for (const h of [...history].filter((h) => h.movementId === movementId).sort((a, b) => a.at.localeCompare(b.at))) {
    byDay.set(dayOf(h.at), h.level);
  }
  const steps: LevelStep[] = [];
  for (const [day, level] of [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (steps.at(-1)?.level !== level) steps.push({ day, level });
  }
  return steps;
}
