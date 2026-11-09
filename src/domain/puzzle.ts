/**
 * Puzzle de poids (J6b, idée de l'utilisateur du 09/11) : quand l'étape de poids suivante est
 * loin, une pièce tous les 2 kg entre le point de départ et cette étape. Fonctions pures,
 * testées dans puzzle.test.ts.
 *
 *  - Calculé sur la TENDANCE (jamais la pesée du jour) : une pièce se gagne quand la tendance
 *    passe sous son seuil, et ne se reprend jamais (on regarde la plus basse tendance atteinte).
 *  - Point de départ : la 1re tendance pour la 1re étape, puis l'étape précédente.
 *  - Aucun chiffre dans le code : les étapes viennent du Profil (réglage `weightGoals`).
 *  - Une étape atteinte = puzzle complet (et son badge, badges.ts) ; le suivant commence.
 */
import type { TrendPoint } from './body';

/** Une pièce tous les… */
export const PUZZLE_STEP_KG = 2;
/** Au-delà, les pièces s'élargissent (un puzzle de 30 pièces ne se lit plus sur un téléphone). */
export const PUZZLE_MAX_PIECES = 12;

export interface Puzzle {
  /** L'étape visée (kg). */
  goal: number;
  /** Point de départ de ce puzzle (kg). */
  from: number;
  /** Seuil de chaque pièce, du plus haut au plus bas (le dernier = l'étape). */
  thresholds: number[];
  /** Pièces gagnées. */
  earned: number;
  /** Jour où chaque pièce gagnée l'a été (même ordre que `thresholds`). */
  earnedOn: string[];
  /** Plus basse tendance atteinte depuis le départ. */
  lowest: number;
}

/** Seuils des pièces entre `from` et `goal` : tous les 2 kg, la dernière pièce = l'étape. */
export function pieceThresholds(from: number, goal: number): number[] {
  const gap = from - goal;
  if (gap <= 0) return [];
  const step = Math.max(PUZZLE_STEP_KG, gap / PUZZLE_MAX_PIECES);
  const n = Math.ceil(gap / step - 1e-9);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? goal : Number((from - step * (i + 1)).toFixed(2))));
}

/**
 * Le puzzle en cours : celui de la première étape pas encore atteinte. `null` sans tendance,
 * sans étape, ou quand toutes les étapes sont atteintes (le Maintien prendra le relais, J9).
 */
export function currentPuzzle(trend: readonly TrendPoint[], goals: readonly number[]): Puzzle | null {
  if (trend.length === 0 || goals.length === 0) return null;
  const start = trend[0]!.trend;
  const steps = [...goals].filter((g) => g < start).sort((a, b) => b - a);
  // Plus basse tendance atteinte jusqu'à chaque point (une pièce gagnée ne se reprend pas).
  const lowestUntil: number[] = [];
  trend.forEach((p, i) => lowestUntil.push(Math.min(p.trend, lowestUntil[i - 1] ?? Infinity)));
  const lowest = lowestUntil.at(-1)!;
  let from = start;
  for (const goal of steps) {
    if (lowest <= goal) {
      from = goal;
      continue;
    }
    const thresholds = pieceThresholds(from, goal);
    const earnedOn: string[] = [];
    for (const t of thresholds) {
      const hit = lowestUntil.findIndex((m) => m <= t);
      if (hit < 0) break;
      earnedOn.push(trend[hit]!.day);
    }
    return { goal, from, thresholds, earned: earnedOn.length, earnedOn, lowest };
  }
  return null;
}

/** Disposition des pièces à l'écran : colonnes × lignes, la plus proche du format de l'image (3:2). */
export function puzzleGrid(pieces: number): { cols: number; rows: number } {
  if (pieces <= 3) return { cols: pieces, rows: 1 };
  if (pieces === 4) return { cols: 2, rows: 2 };
  if (pieces <= 6) return { cols: 3, rows: 2 };
  if (pieces <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: 3 };
}
