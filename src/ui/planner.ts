/**
 * Relie le moteur pur (src/domain/engine.ts) aux données de l'appli : lit l'historique,
 * les niveaux, le lieu, la charge et le genou, puis construit le plan du jour.
 */
import { CATALOG, COOLDOWN, WARMUP } from '../data/catalog';
import { alternatives, handSupport, resolveVariant, type Context, type Resolved } from '../domain/availability';
import { buildPlan } from '../domain/engine';
import { lastDoneByMovement, lastSessionByVariant, lastSessionFeel, lastSetsByVariant, type LastSession } from '../domain/history';
import { nextPrefill, volumeDelta } from '../domain/progression';
import { legsLoaded, MORNING_WORSE_SCORE, morningWorseToday, sessionDoneToday, workedRecently } from '../domain/recovery';
import type { Duration, Location, Movement, Plan, PlanItem } from '../domain/types';
import { levels, prefs } from './state';
import { activities, kneeLogs, loadTraining, workouts as allWorkouts } from './training';

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

/**
 * Séries de la dernière séance, par variante. Gardées depuis le dernier plan construit pour
 * qu'un exercice remplacé (aperçu ou séance) ait lui aussi son rappel du carnet.
 */
let lastSets: Record<string, number[]> = {};
/** Dernière séance par variante (objectif d'un exercice remplacé). */
let lastSessions: Record<string, LastSession> = {};

/** Ajoute à un élément de plan le rappel de sa dernière séance, s'il y en a une. */
function withLast(item: PlanItem): PlanItem {
  const last = lastSets[item.variantId];
  return last && !item.guided ? { ...item, last } : item;
}

export async function makePlan(location: Location, duration: Duration, kneeScore: number): Promise<Plan> {
  await loadTraining();
  const workouts = allWorkouts.value;
  const now = new Date();
  lastSets = lastSetsByVariant(workouts);
  lastSessions = lastSessionByVariant(workouts);
  const recall = lastSessionFeel(workouts);
  // Genou « plus mal » ce matin : la séance ménage les jambes comme pour un score de 3.
  const knee = morningWorseToday(kneeLogs.value, now) ? Math.max(kneeScore, MORNING_WORSE_SCORE) : kneeScore;
  const plan = buildPlan({
    catalog: CATALOG,
    warmup: WARMUP,
    cooldown: COOLDOWN,
    ctx: contextFor(location, knee),
    duration,
    levels: levels.value,
    lastDone: lastDoneByMovement(workouts),
    lastSession: lastSessions,
    now,
    // 2e séance du jour : les mouvements des 48 dernières heures sont écartés.
    exclude: sessionDoneToday(workouts, now) ? workedRecently(workouts, CATALOG, now) : [],
    restLegs: legsLoaded(activities.value, now),
    volume: volumeDelta(recall?.feel),
    focus: prefs.value.focus,
  });
  return {
    ...plan,
    blocks: plan.blocks.map((b) => ({ ...b, items: b.items.map(withLast) })),
    ...(recall ? { recall } : {}),
  };
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
  return withLast({
    movementId: option.movement.id,
    variantId: variant.id,
    level,
    adapted,
    sets: base.sets,
    target: variant.target,
    prefill: nextPrefill(
      lastSessions[variant.id]?.sets,
      variant.target,
      lastSessions[variant.id] ? (Date.now() - new Date(lastSessions[variant.id]!.at).getTime()) / 86_400_000 : undefined,
    ),
    ...(variant.perSide ? { perSide: true } : {}),
    ...(support ? { handSupport: support } : {}),
  });
}
