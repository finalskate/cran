/**
 * Une variante est-elle faisable ici et aujourd'hui ? Matériel, espace, genou, poignet.
 * Fonctions pures (SPEC §4.2, §4.3 règle poignet, §4.6 genou).
 */
import {
  SPACE_ORDER,
  type HandSupport,
  type KneeImpact,
  type Location,
  type Movement,
  type Requirement,
  type Variant,
} from './types';

/** Contexte du jour, commun à toutes les vérifications. */
export interface Context {
  location: Location;
  /** Score de douleur au genou du jour, 0 à 10. */
  kneeScore: number;
  /** Règle poignet activée (par défaut) : pas de mains à plat, support adapté. */
  wristRule: boolean;
}

/** Une exigence est satisfaite si le tag est présent (ou l'un des tags d'une liste). */
function satisfies(req: Requirement, equipment: readonly string[]): boolean {
  return Array.isArray(req) ? req.some((t) => equipment.includes(t)) : equipment.includes(req);
}

export function hasEquipment(variant: Variant, location: Location): boolean {
  return variant.needs.every((req) => satisfies(req, location.equipment));
}

export function fitsSpace(variant: Variant, location: Location): boolean {
  return SPACE_ORDER[variant.space] <= SPACE_ORDER[location.space];
}

/**
 * Impact genou maximal autorisé selon le score du jour (SPEC §4.6) :
 * 0–2 tout ; 3–4 sans `high` ; ≥ 5 seulement `low` (et pas de jambes, cf. engine.ts).
 */
export function maxKneeImpact(kneeScore: number): KneeImpact {
  if (kneeScore >= 5) return 'low';
  if (kneeScore >= 3) return 'mid';
  return 'high';
}

const KNEE_ORDER: Record<KneeImpact, number> = { low: 0, mid: 1, high: 2 };

export function kneeAllows(variant: Variant, kneeScore: number): boolean {
  return KNEE_ORDER[variant.knee] <= KNEE_ORDER[maxKneeImpact(kneeScore)];
}

/**
 * Support des mains pour une variante « mains au sol » (SPEC §4.3, règle poignet) :
 *  - poignées si le lieu en a (poignet neutre) ;
 *  - sinon, avec la règle poignet : sur les poings si la variante le permet, sinon impossible ;
 *  - sans la règle : mains à plat.
 * Renvoie `undefined` pour une variante qui n'a pas les mains au sol, `null` si elle est infaisable.
 */
export function handSupport(variant: Variant, ctx: Context): HandSupport | null | undefined {
  if (!variant.handsOnFloor) return undefined;
  if (ctx.location.equipment.includes('pushup-handles')) return 'handles';
  if (!ctx.wristRule) return 'flat';
  return variant.fistsOk ? 'fists' : null;
}

/** Toutes les conditions réunies. */
export function isAvailable(variant: Variant, ctx: Context): boolean {
  return (
    hasEquipment(variant, ctx.location) &&
    fitsSpace(variant, ctx.location) &&
    kneeAllows(variant, ctx.kneeScore) &&
    handSupport(variant, ctx) !== null
  );
}

/** Résultat de la recherche d'une variante pour un mouvement. */
export interface Resolved {
  variant: Variant;
  /** Niveau utilisé (index dans l'échelle) ; -1 pour un substitut. */
  level: number;
  /** Niveau abaissé ou substitut. */
  adapted: boolean;
}

/**
 * Choisit la variante d'un mouvement pour un niveau visé (SPEC §2.2 : le lieu change la variante,
 * pas le niveau). Ordre de recherche :
 *  1. le niveau visé, puis les niveaux en dessous (plus facile, jamais de mauvaise surprise) ;
 *  2. à défaut, le niveau faisable le plus proche au-dessus (ex. niveau 1 « squat sur chaise »
 *     sans chaise → squat) ;
 *  3. à défaut, un substitut.
 * `null` si rien n'est faisable ici.
 */
export function resolveVariant(movement: Movement, targetLevel: number, ctx: Context): Resolved | null {
  const top = Math.min(Math.max(targetLevel, 0), movement.levels.length - 1);
  const at = (level: number) => movement.levels[level]!.variants.find((v) => isAvailable(v, ctx));
  for (let level = top; level >= 0; level--) {
    const variant = at(level);
    if (variant) return { variant, level, adapted: level !== top };
  }
  for (let level = top + 1; level < movement.levels.length; level++) {
    const variant = at(level);
    if (variant) return { variant, level, adapted: true };
  }
  const sub = movement.substitutes?.find((v) => isAvailable(v, ctx));
  return sub ? { variant: sub, level: -1, adapted: true } : null;
}

/**
 * Variantes de remplacement (SPEC §4.4) : celles du même niveau faisables ici,
 * puis celles du niveau juste en dessous, puis les substituts. Sans la variante actuelle.
 */
export function alternatives(movement: Movement, level: number, currentId: string, ctx: Context): Resolved[] {
  const out: Resolved[] = [];
  const push = (variant: Variant, lvl: number) => {
    if (variant.id !== currentId && isAvailable(variant, ctx) && !out.some((r) => r.variant.id === variant.id)) {
      out.push({ variant, level: lvl, adapted: lvl !== level });
    }
  };
  const levels = [level, level - 1].filter((l) => l >= 0 && l < movement.levels.length);
  for (const l of levels) movement.levels[l]!.variants.forEach((v) => push(v, l));
  movement.substitutes?.forEach((v) => push(v, -1));
  return out;
}

/** Retrouve une variante (et son niveau) par son id dans un mouvement. */
export function findVariant(movement: Movement, variantId: string): { variant: Variant; level: number } | null {
  for (let level = 0; level < movement.levels.length; level++) {
    const variant = movement.levels[level]!.variants.find((v) => v.id === variantId);
    if (variant) return { variant, level };
  }
  const sub = movement.substitutes?.find((v) => v.id === variantId);
  return sub ? { variant: sub, level: -1 } : null;
}
