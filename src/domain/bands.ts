/**
 * Élastiques longs (retouche du 08/11) : quelle force prendre, et quand passer à la suivante.
 * Fonctions pures, testées dans bands.test.ts.
 *
 * Progression d'un exercice à l'élastique, comme dans un carnet :
 *  1. on monte les répétitions jusqu'au haut de la fourchette (double progression habituelle) ;
 *  2. séance au haut de la fourchette → la prochaine fois, l'élastique suivant (plus fort, ou plus
 *     léger quand il aide), et l'objectif repart du bas de la fourchette ;
 *  3. avec l'élastique le plus dur, deux séances au haut de la fourchette débloquent le niveau
 *     suivant (progression.ts).
 *
 * Les forces se saisissent dans l'appli (Lieux › Mes élastiques, en kg). Sans saisie, trois
 * élastiques génériques : léger, moyen, fort.
 */
import type { BandChoice, BandUse } from './types';

/** Libellés quand l'utilisateur n'a pas saisi ses élastiques. */
export const GENERIC_BANDS = ['léger', 'moyen', 'fort'] as const;

/** Au-delà, la liste devient illisible en séance. */
export const MAX_BANDS = 6;

/** Libellés des élastiques possédés, du plus léger au plus fort. */
export function bandLabels(strengths: readonly number[]): string[] {
  if (strengths.length === 0) return [...GENERIC_BANDS];
  return [...strengths].sort((a, b) => a - b).map((kg) => `${String(kg).replace('.', ',')} kg`);
}

/**
 * Lit une saisie libre (« 10, 20, 30 » ou « 10 kg 20 kg ») : nombres entre 1 et 200 kg, sans
 * doublon, triés. Ce qui n'est pas un nombre est ignoré.
 */
export function parseBands(text: string): number[] {
  const values = (text.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((t) => Number(t.replace(',', '.')))
    .filter((n) => n >= 1 && n <= 200);
  return [...new Set(values)].sort((a, b) => a - b).slice(0, MAX_BANDS);
}

const clampRank = (rank: number, of: number) => Math.min(Math.max(Math.round(rank), 0), of - 1);

/** Élastique de départ conseillé, ramené au nombre d'élastiques possédés (échelle 0 → 2). */
export function startRank(use: BandUse, of: number): number {
  return clampRank((use.start * (of - 1)) / 2, of);
}

export function bandAt(rank: number, labels: readonly string[]): BandChoice {
  const r = clampRank(rank, labels.length);
  return { rank: r, of: labels.length, label: labels[r]! };
}

/** Élastique qui rend l'exercice plus dur, ou `null` s'il n'y en a pas. */
export function harderBand(band: BandChoice, use: BandUse, labels: readonly string[]): BandChoice | null {
  if (use.fixed) return null;
  const next = band.rank + (use.assist ? -1 : 1);
  return next >= 0 && next < labels.length ? bandAt(next, labels) : null;
}

/**
 * L'élastique utilisé est-il le plus dur possible ? Un enregistrement sans élastique (avant la
 * retouche) ou un exercice sans progression par l'élastique compte comme « oui » : rien ne bloque.
 */
export function isHardestBand(band: BandChoice | undefined, use: BandUse): boolean {
  if (!band || use.fixed) return true;
  return use.assist ? band.rank === 0 : band.rank === band.of - 1;
}

/**
 * Élastique prévu pour la prochaine séance d'une variante.
 * @param last élastique de la dernière séance, et si elle était au haut de la fourchette
 * @returns l'élastique, et `reset` = l'objectif repart du bas de la fourchette (élastique changé)
 */
export function plannedBand(
  use: BandUse,
  labels: readonly string[],
  last?: { band?: BandChoice; validated: boolean },
): { band: BandChoice; reset: boolean } {
  if (!last?.band) return { band: bandAt(startRank(use, labels.length), labels), reset: false };
  // Liste modifiée depuis : on retrouve l'élastique par son libellé, sinon par son rang.
  const byLabel = labels.indexOf(last.band.label);
  const current = bandAt(byLabel >= 0 ? byLabel : last.band.rank, labels);
  const harder = last.validated ? harderBand(current, use, labels) : null;
  return harder ? { band: harder, reset: true } : { band: current, reset: false };
}
