/**
 * Historique des séances : format d'enregistrement et lectures utiles au moteur.
 * Fonctions pures (l'historique est passé en paramètre, lu depuis la base par l'appelant).
 */
import type { BandChoice } from './types';

/** Ressenti d'une série (SPEC §4.4). */
export type Feel = 'easy' | 'ok' | 'hard';

export interface SetResult {
  /** Répétitions, ou secondes pour un exercice en durée. */
  value: number;
  feel?: Feel;
}

/** Un exercice réalisé pendant une séance. */
export interface WorkoutEntry {
  movementId: string;
  variantId: string;
  /** Niveau utilisé (-1 pour un substitut). */
  level: number;
  sets: SetResult[];
  /** Élastique utilisé (exercices à l'élastique, depuis la retouche du 08/11 ; champ non indexé). */
  band?: BandChoice;
}

/**
 * Ressenti global de la séance, facultatif, donné sur l'écran de bilan.
 * Distinct du ressenti par série : il dit si le DOSAGE de la séance (volume, repos, durée) était juste.
 */
export type SessionFeel = 'too-easy' | 'right' | 'too-hard';

/** Une séance terminée, telle qu'elle est enregistrée (table `workouts`). */
export interface WorkoutRecord {
  id?: number;
  startedAt: string;
  endedAt: string;
  locationId: string;
  duration: number;
  kneeScore: number;
  entries: WorkoutEntry[];
  /** Ressenti global, absent si l'utilisateur ne l'a pas donné (champ non indexé : pas de migration). */
  sessionFeel?: SessionFeel;
}

/** Date (ISO) de la dernière séance où chaque mouvement a été travaillé. */
export function lastDoneByMovement(workouts: readonly WorkoutRecord[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.sets.length === 0) continue;
      const prev = out[e.movementId];
      if (!prev || w.startedAt > prev) out[e.movementId] = w.startedAt;
    }
  }
  return out;
}

/** Séries de la dernière séance faite avec une variante, et sa date. */
export interface LastSession {
  sets: SetResult[];
  at: string;
  band?: BandChoice;
}

/**
 * Pour chaque variante : les séries (avec ressenti) de la séance la plus récente où elle a été
 * faite. Sert à fixer l'objectif du jour (double progression, progression.ts).
 */
export function lastSessionByVariant(workouts: readonly WorkoutRecord[]): Record<string, LastSession> {
  const latest: Record<string, LastSession> = {};
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.sets.length === 0) continue;
      const prev = latest[e.variantId];
      if (!prev || w.startedAt > prev.at) latest[e.variantId] = { at: w.startedAt, sets: e.sets, ...(e.band ? { band: e.band } : {}) };
    }
  }
  return latest;
}

/**
 * Pour chaque variante : les séries (valeurs) de la séance la plus récente où elle a été faite.
 * Affiché pendant la séance (« Dernière séance : 8 · 8 · 7 »), comme on relirait le carnet.
 */
export function lastSetsByVariant(workouts: readonly WorkoutRecord[]): Record<string, number[]> {
  const latest: Record<string, { at: string; sets: number[] }> = {};
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.sets.length === 0) continue;
      const prev = latest[e.variantId];
      if (!prev || w.startedAt > prev.at) latest[e.variantId] = { at: w.startedAt, sets: e.sets.map((s) => s.value) };
    }
  }
  return Object.fromEntries(Object.entries(latest).map(([id, { sets }]) => [id, sets]));
}

/** Ressenti global de la séance la plus récente, si elle en a un (sinon rien : pas de rappel). */
export function lastSessionFeel(
  workouts: readonly WorkoutRecord[],
): { feel: SessionFeel; startedAt: string; locationId: string } | undefined {
  let last: WorkoutRecord | undefined;
  for (const w of workouts) if (!last || w.startedAt > last.startedAt) last = w;
  if (!last?.sessionFeel) return undefined;
  return { feel: last.sessionFeel, startedAt: last.startedAt, locationId: last.locationId };
}

/**
 * Comparaison encourageante avec la même série de la séance précédente (SPEC §2.3 : jamais de
 * culpabilisation). Renvoie l'écart quand il est positif ou nul ; un recul ne donne rien
 * (l'écran affiche alors simplement la valeur de la dernière fois).
 */
export function compareWithLast(
  value: number,
  lastSets: readonly number[] | undefined,
  setNumber: number,
): { kind: 'better'; delta: number } | { kind: 'equal' } | undefined {
  const ref = lastSets?.[setNumber - 1];
  if (ref === undefined) return undefined;
  if (value > ref) return { kind: 'better', delta: value - ref };
  if (value === ref) return { kind: 'equal' };
  return undefined;
}
