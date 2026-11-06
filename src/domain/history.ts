/**
 * Historique des séances : format d'enregistrement et lectures utiles au moteur.
 * Fonctions pures (l'historique est passé en paramètre, lu depuis la base par l'appelant).
 */

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
}

/** Une séance terminée, telle qu'elle est enregistrée (table `workouts`). */
export interface WorkoutRecord {
  id?: number;
  startedAt: string;
  endedAt: string;
  locationId: string;
  duration: number;
  kneeScore: number;
  entries: WorkoutEntry[];
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

/**
 * Pour chaque variante : la meilleure série de la séance la plus récente où elle a été faite.
 * Sert à pré-remplir l'objectif du jour (la progression fine arrive au J2).
 */
export function lastBestByVariant(workouts: readonly WorkoutRecord[]): Record<string, number> {
  const latest: Record<string, { at: string; best: number }> = {};
  for (const w of workouts) {
    for (const e of w.entries) {
      if (e.sets.length === 0) continue;
      const best = Math.max(...e.sets.map((s) => s.value));
      const prev = latest[e.variantId];
      if (!prev || w.startedAt > prev.at) latest[e.variantId] = { at: w.startedAt, best };
    }
  }
  return Object.fromEntries(Object.entries(latest).map(([id, { best }]) => [id, best]));
}
