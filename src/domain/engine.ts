/**
 * MOTEUR DE SÉANCE (SPEC §4.4) : construit « la séance du jour » à partir du lieu, de la durée,
 * du score genou, des niveaux choisis et de l'historique. Fonction pure : mêmes entrées, même plan.
 *
 * Formats :
 *  - 10 min : prévention genou + 1 superset pousser/tirer en circuit, peu de repos ;
 *  - 20 min : prévention genou + 3 mouvements en supersets, 3 séries ;
 *  - 30 min : échauffement + prévention + 4 mouvements + gainage ;
 *  - 40 min et plus : échauffement + prévention + 5 mouvements (4 séries sur le premier bloc)
 *    + gainage et épaules ;
 *  - dès 20 min : série longue de pompes si elle n'a pas été faite depuis 7 jours, et retour au
 *    calme facultatif.
 *
 * Choix des mouvements : un de chaque famille (pousser, tirer, jambes) d'abord, puis compléments,
 * en priorisant le mouvement le moins récent (jamais fait = prioritaire), 2 par famille au plus.
 * Genou ≥ 5 : pas de jambes (haut du corps et prévention seulement, SPEC §4.6).
 */
import { handSupport, resolveVariant, type Context } from './availability';
import type { Category, Duration, Movement, Plan, PlanBlock, PlanItem, Variant } from './types';

export interface EngineInput {
  catalog: readonly Movement[];
  warmup: Movement;
  cooldown: Movement;
  ctx: Context;
  duration: Duration;
  /** Niveau choisi par mouvement (index dans l'échelle). Absent = premier niveau. */
  levels: Readonly<Record<string, number>>;
  /** Dernière date (ISO) où chaque mouvement a été fait. */
  lastDone: Readonly<Record<string, string>>;
  /** Meilleure série de la dernière fois, par variante (pré-remplissage). */
  lastBest: Readonly<Record<string, number>>;
  now: Date;
}

/** Paramètres de chaque format. */
interface Format {
  mains: number;
  sets: number;
  /** Séries du premier bloc principal (40 min : une de plus). */
  firstBlockSets: number;
  restBetween: number;
  restAfterRound: number;
  kneeExercises: number;
  kneeSets: number;
  warmup: boolean;
  core: boolean;
  shoulders: boolean;
  extras: boolean; // volume pompes + retour au calme
}

const FORMATS: Record<Duration, Format> = {
  10: { mains: 2, sets: 3, firstBlockSets: 3, restBetween: 15, restAfterRound: 30, kneeExercises: 1, kneeSets: 3, warmup: false, core: false, shoulders: false, extras: false },
  20: { mains: 3, sets: 3, firstBlockSets: 3, restBetween: 20, restAfterRound: 60, kneeExercises: 2, kneeSets: 3, warmup: false, core: false, shoulders: false, extras: true },
  30: { mains: 4, sets: 3, firstBlockSets: 3, restBetween: 20, restAfterRound: 75, kneeExercises: 2, kneeSets: 3, warmup: true, core: true, shoulders: false, extras: true },
  40: { mains: 5, sets: 3, firstBlockSets: 4, restBetween: 20, restAfterRound: 90, kneeExercises: 2, kneeSets: 4, warmup: true, core: true, shoulders: true, extras: true },
};

const MAIN_CATEGORIES: Category[] = ['push', 'pull', 'legs'];

/** Délai minimal entre deux séries longues de pompes. */
const VOLUME_INTERVAL_DAYS = 7;

/** Durée estimée d'une répétition, en secondes (pour l'estimation de la séance). */
const SECONDS_PER_REP = 3;

/** Temps de mise en place entre deux blocs, en secondes. */
const BLOCK_TRANSITION = 20;

/** Construit le plan du jour. */
export function buildPlan(input: EngineInput): Plan {
  const format = FORMATS[input.duration];
  const blocks: PlanBlock[] = [];

  if (format.warmup) {
    const warm = warmupBlock(input);
    if (warm) blocks.push(warm);
  }

  const knee = kneeBlock(input, format);
  if (knee) blocks.push(knee);

  blocks.push(...mainBlocks(input, format));

  if (format.extras) {
    const volume = volumeBlock(input);
    if (volume) blocks.push(volume);
  }

  if (format.core) {
    const core = coreBlock(input, format);
    if (core) blocks.push(core);
  }

  if (format.extras) {
    const cool = guidedBlock(input.cooldown, input, 'cooldown', 'Retour au calme', true);
    if (cool) blocks.push(cool);
  }

  fitToDuration(blocks, input.duration);

  return {
    createdAt: input.now.toISOString(),
    locationId: input.ctx.location.id,
    duration: input.duration,
    kneeScore: input.ctx.kneeScore,
    blocks,
    estimatedMinutes: Math.round(estimateSeconds(blocks) / 60),
  };
}

// ─── Sélection ───

interface Candidate {
  movement: Movement;
  item: PlanItem;
  /** Ancienneté : jamais fait = +∞. */
  age: number;
  /** Ordre du catalogue, pour départager. */
  order: number;
}

/** Âge d'un mouvement en jours (Infinity s'il n'a jamais été fait). */
function ageInDays(movementId: string, input: EngineInput): number {
  const last = input.lastDone[movementId];
  return last ? (input.now.getTime() - new Date(last).getTime()) / 86_400_000 : Infinity;
}

/** Le moins récent d'abord ; à égalité, l'ordre du catalogue. */
function byPriority(a: Candidate, b: Candidate): number {
  if (a.age !== b.age) return b.age - a.age;
  return a.order - b.order;
}

/** Transforme une variante résolue en élément de plan (séries, pré-remplissage, support des mains). */
function makeItem(movement: Movement, variant: Variant, level: number, adapted: boolean, sets: number, input: EngineInput): PlanItem {
  const last = input.lastBest[variant.id];
  const { min, max } = variant.target;
  // Pré-remplissage : la meilleure série de la dernière fois, bornée à la fourchette ; sinon le bas de la fourchette.
  const prefill = last !== undefined ? Math.min(Math.max(last, min), max) : min;
  const support = handSupport(variant, input.ctx);
  return {
    movementId: movement.id,
    variantId: variant.id,
    level,
    adapted,
    sets,
    target: variant.target,
    prefill,
    ...(variant.perSide ? { perSide: true } : {}),
    ...(support ? { handSupport: support } : {}),
  };
}

/** Mouvements faisables d'une catégorie, au niveau choisi (ou abaissé selon le lieu). */
function candidates(input: EngineInput, categories: Category[]): Candidate[] {
  const out: Candidate[] = [];
  input.catalog.forEach((movement, order) => {
    if (!categories.includes(movement.category)) return;
    const resolved = resolveVariant(movement, input.levels[movement.id] ?? 0, input.ctx);
    if (!resolved) return;
    out.push({
      movement,
      item: makeItem(movement, resolved.variant, resolved.level, resolved.adapted, 0, input),
      age: ageInDays(movement.id, input),
      order,
    });
  });
  return out.sort(byPriority);
}

/** Choisit les mouvements principaux du jour. */
export function pickMains(input: EngineInput, count: number): Candidate[] {
  const allowed = input.ctx.kneeScore >= 5 ? MAIN_CATEGORIES.filter((c) => c !== 'legs') : MAIN_CATEGORIES;
  const pool = candidates(input, allowed);
  const picked: Candidate[] = [];
  const perCategory = (c: Category) => picked.filter((p) => p.movement.category === c).length;

  // 10 min : un pousser + un tirer (le superset du format).
  const firstRound: Category[] = count <= 2 ? ['push', 'pull'] : allowed;
  for (const cat of firstRound) {
    const best = pool.find((p) => p.movement.category === cat && !picked.includes(p));
    if (best && picked.length < count) picked.push(best);
  }
  // Compléments : les moins récents, 2 par famille au plus.
  for (const cand of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(cand) && perCategory(cand.movement.category) < 2) picked.push(cand);
  }
  return picked;
}

/** Regroupe les mouvements en supersets : pousser avec tirer d'abord, puis le reste deux par deux. */
function pairUp(picked: Candidate[]): Candidate[][] {
  const push = picked.filter((p) => p.movement.category === 'push');
  const pull = picked.filter((p) => p.movement.category === 'pull');
  const rest = picked.filter((p) => p.movement.category === 'legs');
  const groups: Candidate[][] = [];
  while (push.length && pull.length) groups.push([push.shift()!, pull.shift()!]);
  const leftovers = [...push, ...pull, ...rest];
  // Les jambes avec un reste du haut du corps si possible (alternance haut / bas).
  while (leftovers.length) groups.push(leftovers.splice(0, 2));
  return groups;
}

// ─── Blocs ───

function mainBlocks(input: EngineInput, format: Format): PlanBlock[] {
  const picked = pickMains(input, format.mains);
  if (picked.length === 0) return [];

  // 10 min : un seul circuit avec tous les mouvements.
  if (input.duration === 10) {
    return [
      {
        kind: 'superset',
        title: 'Circuit',
        items: picked.map((p) => ({ ...p.item, sets: format.sets })),
        restBetween: format.restBetween,
        restAfterRound: format.restAfterRound,
      },
    ];
  }

  return pairUp(picked).map((group, i) => {
    const sets = i === 0 ? format.firstBlockSets : format.sets;
    return {
      kind: group.length > 1 ? 'superset' : 'single',
      title: group.length > 1 ? `Superset ${String.fromCharCode(65 + i)}` : group[0]!.movement.name,
      items: group.map((p) => ({ ...p.item, sets })),
      restBetween: format.restBetween,
      restAfterRound: format.restAfterRound,
    };
  });
}

/** Prévention genou : présente dans chaque séance. Genou sensible : l'isométrie passe en premier. */
function kneeBlock(input: EngineInput, format: Format): PlanBlock | null {
  const pool = candidates(input, ['knee']);
  if (input.ctx.kneeScore >= 3) {
    // « On garde l'isométrie » (SPEC §4.6) : les exercices en durée d'abord.
    pool.sort((a, b) => Number(b.item.target.kind === 'time') - Number(a.item.target.kind === 'time'));
  }
  const chosen = pool.slice(0, format.kneeExercises);
  if (chosen.length === 0) return null;
  return {
    kind: 'knee',
    title: 'Prévention genou',
    items: chosen.map((c) => ({ ...c.item, sets: format.kneeSets })),
    restBetween: 15,
    restAfterRound: 30,
  };
}

function coreBlock(input: EngineInput, format: Format): PlanBlock | null {
  const core = candidates(input, ['core'])[0];
  if (!core) return null;
  const items: PlanItem[] = [{ ...core.item, sets: 3 }];
  if (format.shoulders) {
    const shoulder = candidates(input, ['shoulders'])[0];
    if (shoulder) items.push({ ...shoulder.item, sets: 2 });
  }
  return {
    kind: items.length > 1 ? 'superset' : 'core',
    title: items.length > 1 ? 'Gainage et épaules' : 'Gainage',
    items,
    restBetween: 15,
    restAfterRound: 45,
  };
}

/** Série longue de pompes, si elle n'a pas été faite depuis une semaine. */
function volumeBlock(input: EngineInput): PlanBlock | null {
  if (ageInDays('pushup-volume', input) < VOLUME_INTERVAL_DAYS) return null;
  const c = candidates(input, ['volume'])[0];
  if (!c) return null;
  return {
    kind: 'volume',
    title: 'Série longue de pompes',
    items: [{ ...c.item, sets: 1 }],
    restBetween: 0,
    restAfterRound: 60,
  };
}

/** Échauffement ou retour au calme : une série guidée de chaque mouvement compatible avec le genou. */
function guidedBlock(
  movement: Movement,
  input: EngineInput,
  kind: 'warmup' | 'cooldown',
  title: string,
  optional: boolean,
): PlanBlock | null {
  const items = movement.levels[0]!.variants
    .filter((v) => resolveVariant({ ...movement, levels: [{ variants: [v] }] }, 0, input.ctx))
    .map((v) => ({ ...makeItem(movement, v, 0, false, 1, input), guided: true }));
  if (items.length === 0) return null;
  return { kind, title, items, restBetween: 5, restAfterRound: kind === 'warmup' ? 20 : 0, optional };
}

function warmupBlock(input: EngineInput): PlanBlock | null {
  return guidedBlock(input.warmup, input, 'warmup', 'Échauffement', false);
}

// ─── Estimation et ajustement à la durée ───

/** Durée d'une série, en secondes. */
function setSeconds(item: PlanItem): number {
  const base = item.target.kind === 'reps' ? item.prefill * SECONDS_PER_REP : item.prefill;
  return item.perSide ? base * 2 : base;
}

/** Estimation de la durée totale d'un plan, repos compris. */
export function estimateSeconds(blocks: readonly PlanBlock[]): number {
  let total = 0;
  for (const block of blocks) {
    const rounds = Math.max(...block.items.map((i) => i.sets));
    for (let r = 0; r < rounds; r++) {
      const inRound = block.items.filter((i) => i.sets > r);
      total += inRound.reduce((s, i) => s + setSeconds(i), 0);
      total += block.restBetween * Math.max(inRound.length - 1, 0);
      if (r < rounds - 1) total += block.restAfterRound;
    }
    total += BLOCK_TRANSITION;
  }
  return total;
}

/**
 * Si l'estimation dépasse nettement la durée choisie, on allège dans cet ordre :
 * retour au calme retiré, une série de moins sur les derniers blocs principaux (2 au minimum).
 * Le bloc genou n'est jamais retiré.
 */
function fitToDuration(blocks: PlanBlock[], duration: Duration): void {
  const limit = (duration === 40 ? 50 : duration * 1.15) * 60;
  const removeOptional = () => {
    const idx = blocks.findIndex((b) => b.optional);
    if (idx >= 0) blocks.splice(idx, 1);
    return idx >= 0;
  };
  const trimSets = () => {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i]!;
      if ((b.kind === 'superset' || b.kind === 'single' || b.kind === 'core') && b.items.some((it) => it.sets > 2)) {
        b.items = b.items.map((it) => ({ ...it, sets: Math.max(2, it.sets - 1) }));
        return true;
      }
    }
    return false;
  };
  while (estimateSeconds(blocks) > limit) {
    if (!removeOptional() && !trimSets()) break;
  }
}
