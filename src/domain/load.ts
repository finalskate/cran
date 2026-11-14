/**
 * Charge du sac lesté (retour du 14/11) : les exercices lestés (pompes déclinées, dips, tractions,
 * soulevé de terre une jambe) progressent par le poids, sans fin, comme les élastiques par leur force.
 * Fonctions pures, testées dans load.test.ts.
 *
 * Progression, comme dans un carnet :
 *  1. on monte les répétitions jusqu'au haut de la fourchette (double progression habituelle) ;
 *  2. séance au haut de la fourchette (toutes les séries, aucune « Dur ») → la prochaine fois,
 *     le sac prend `step` kg de plus, et l'objectif repart du bas de la fourchette ;
 *  3. la charge se corrige en séance (−/+) : elle est notée avec les séries.
 * Le déblocage du niveau suivant, quand il y en a un, ne dépend pas de la charge (progression.ts).
 */
import type { LoadUse } from './types';

/** Charge maximale proposée : au-delà, un sac à dos n'est plus fait pour ça. */
export const MAX_LOAD_KG = 30;

/** « 6 kg », « 4,5 kg ». */
export function formatLoad(kg: number): string {
  return `${String(kg).replace('.', ',')} kg`;
}

/** Ramène une charge saisie entre 0 (sac vide) et MAX_LOAD_KG. */
export function clampLoad(kg: number): number {
  return Math.min(Math.max(kg, 0), MAX_LOAD_KG);
}

/**
 * Charge prévue pour la prochaine séance d'une variante lestée.
 * @param last charge de la dernière séance (absente avant cette retouche), et si elle était au
 *   haut de la fourchette
 * @returns la charge, et `reset` = l'objectif repart du bas de la fourchette (charge augmentée)
 */
export function plannedLoad(use: LoadUse, last?: { load?: number; validated: boolean }): { load: number; reset: boolean } {
  if (last?.load === undefined) return { load: use.start, reset: false };
  if (!last.validated) return { load: last.load, reset: false };
  const next = clampLoad(last.load + use.step);
  return { load: next, reset: next !== last.load };
}
