/**
 * Relie le moteur pur (src/domain/engine.ts) aux données de l'appli : lit l'historique,
 * les niveaux et le lieu, puis construit le plan du jour.
 */
import { CATALOG, COOLDOWN, WARMUP } from '../data/catalog';
import { listWorkouts } from '../data/repo';
import { alternatives, handSupport, resolveVariant, type Context, type Resolved } from '../domain/availability';
import { buildPlan } from '../domain/engine';
import { lastBestByVariant, lastDoneByMovement } from '../domain/history';
import type { Duration, Location, Movement, Plan, PlanItem } from '../domain/types';
import { levels, prefs } from './state';

const ALL: Movement[] = [...CATALOG, WARMUP, COOLDOWN];

export function movementById(id: string): Movement | undefined {
  return ALL.find((m) => m.id === id);
}

/** Variante (et mouvement) d'un élément de plan. */
export function describeItem(item: PlanItem) {
  const movement = movementById(item.movementId)!;
  const variant =
    movement.levels.flatMap((l) => l.variants).find((v) => v.id === item.variantId) ??
    movement.substitutes?.find((v) => v.id === item.variantId)!;
  return { movement, variant };
}

export function contextFor(location: Location, kneeScore: number): Context {
  return { location, kneeScore, wristRule: prefs.value.wristRule };
}

export async function makePlan(location: Location, duration: Duration, kneeScore: number): Promise<Plan> {
  const workouts = await listWorkouts();
  return buildPlan({
    catalog: CATALOG,
    warmup: WARMUP,
    cooldown: COOLDOWN,
    ctx: contextFor(location, kneeScore),
    duration,
    levels: levels.value,
    lastDone: lastDoneByMovement(workouts),
    lastBest: lastBestByVariant(workouts),
    now: new Date(),
  });
}

/** Une option de remplacement : variante d'un mouvement, prête à devenir un élément de plan. */
export interface SwapOption {
  movement: Movement;
  resolved: Resolved;
  /** Même mouvement (variante équivalente) ou autre mouvement de la même famille. */
  sameMovement: boolean;
}

/**
 * Remplacements possibles (SPEC §4.4) : variantes équivalentes du même mouvement d'abord,
 * puis les autres mouvements de la même famille, à leur niveau choisi.
 */
export function swapOptions(item: PlanItem, plan: Plan, ctx: Context): SwapOption[] {
  const { movement } = describeItem(item);
  const same = alternatives(movement, item.level < 0 ? 0 : item.level, item.variantId, ctx).map((resolved) => ({
    movement,
    resolved,
    sameMovement: true,
  }));
  const inPlan = new Set(plan.blocks.flatMap((b) => b.items.map((i) => i.movementId)));
  const others = CATALOG.filter((m) => m.category === movement.category && !inPlan.has(m.id)).flatMap((m) => {
    const resolved = resolveVariant(m, levels.value[m.id] ?? 0, ctx);
    return resolved ? [{ movement: m, resolved, sameMovement: false }] : [];
  });
  return [...same, ...others];
}

/** Construit l'élément de plan correspondant à une option de remplacement. */
export function itemFromSwap(option: SwapOption, base: PlanItem, ctx: Context): PlanItem {
  const { variant, level, adapted } = option.resolved;
  const support = handSupport(variant, ctx);
  return {
    movementId: option.movement.id,
    variantId: variant.id,
    level,
    adapted,
    sets: base.sets,
    target: variant.target,
    prefill: variant.target.min,
    ...(variant.perSide ? { perSide: true } : {}),
    ...(support ? { handSupport: support } : {}),
  };
}
