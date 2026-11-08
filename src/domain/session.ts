/**
 * SÉANCE EN COURS : machine à états pure (SPEC §4.4 « Pendant la séance »).
 *
 * Le plan est « déroulé » en une liste d'étapes (une étape = une série d'un exercice), dans l'ordre
 * d'exécution : pour un superset A/B en 3 séries → A1, B1, A2, B2, A3, B3.
 *
 * Chaque étape se termine par un repos éventuel. Le repos est stocké comme une HEURE DE FIN
 * (`restEndsAt`, en ms) et non comme un décompte : si Android fige l'appli en arrière-plan,
 * le temps restant reste juste au retour.
 *
 * L'état est sérialisable (JSON) : il est enregistré après chaque action, ce qui permet de quitter
 * et reprendre une séance (SPEC §4.4).
 */
import type { SetResult, WorkoutEntry, WorkoutRecord } from './history';
import type { BandChoice, Plan, PlanItem } from './types';

/** Une série à faire. */
export interface Step {
  block: number;
  item: number;
  /** Numéro de la série (à partir de 1) et nombre total de séries pour cet exercice. */
  set: number;
  sets: number;
  /** Repos après cette série, en secondes (0 = enchaîner). */
  restAfter: number;
}

export type Phase = 'work' | 'rest' | 'done';

export interface SessionState {
  /** Version du format, pour pouvoir faire évoluer l'état enregistré. */
  v: 1;
  plan: Plan;
  steps: Step[];
  index: number;
  phase: Phase;
  /** Fin du repos en cours (ms depuis l'époque), ou null. */
  restEndsAt: number | null;
  /** Résultat de chaque étape (null = passée sans saisie). */
  results: (SetResult | null)[];
  startedAt: number;
}

/** Repos minimal après la dernière série d'un bloc, avant de passer au suivant. */
const BLOCK_CHANGE_REST = 30;

/** Déroule le plan en étapes. */
export function buildSteps(plan: Plan): Step[] {
  const steps: Step[] = [];
  plan.blocks.forEach((block, b) => {
    const rounds = Math.max(...block.items.map((i) => i.sets));
    for (let r = 1; r <= rounds; r++) {
      block.items.forEach((item, i) => {
        if (item.sets < r) return;
        steps.push({ block: b, item: i, set: r, sets: item.sets, restAfter: 0 });
      });
    }
  });

  // Repos : entre exercices d'un même tour, en fin de tour, et au changement de bloc.
  steps.forEach((step, k) => {
    const next = steps[k + 1];
    if (!next) return; // dernière étape : pas de repos
    const block = plan.blocks[step.block]!;
    if (next.block !== step.block) {
      step.restAfter = block.kind === 'warmup' ? block.restAfterRound : Math.max(block.restAfterRound, BLOCK_CHANGE_REST);
    } else if (next.set !== step.set) {
      step.restAfter = block.restAfterRound;
    } else {
      step.restAfter = block.restBetween;
    }
  });
  return steps;
}

export function startSession(plan: Plan, now: number): SessionState {
  const steps = buildSteps(plan);
  return {
    v: 1,
    plan,
    steps,
    index: 0,
    phase: steps.length ? 'work' : 'done',
    restEndsAt: null,
    results: steps.map(() => null),
    startedAt: now,
  };
}

export function currentStep(state: SessionState): Step | undefined {
  return state.steps[state.index];
}

/** Exercice (élément du plan) d'une étape. */
export function itemOf(state: SessionState, step: Step): PlanItem {
  return state.plan.blocks[step.block]!.items[step.item]!;
}

/** Valide la série en cours (résultat, ou null si passée) puis lance le repos ou enchaîne. */
export function completeStep(state: SessionState, result: SetResult | null, now: number): SessionState {
  const step = currentStep(state);
  if (!step || state.phase !== 'work') return state;
  const results = state.results.slice();
  results[state.index] = result;
  const next = { ...state, results };
  if (state.index >= state.steps.length - 1) return { ...next, phase: 'done', restEndsAt: null };
  if (step.restAfter > 0) return { ...next, phase: 'rest', restEndsAt: now + step.restAfter * 1000 };
  return { ...next, index: state.index + 1, phase: 'work', restEndsAt: null };
}

/** Termine le repos (fin du minuteur ou « Passer ») : on passe à l'étape suivante. */
export function endRest(state: SessionState): SessionState {
  if (state.phase !== 'rest') return state;
  return { ...state, index: state.index + 1, phase: 'work', restEndsAt: null };
}

/** Secondes de repos restantes (arrondies au supérieur, jamais négatives). */
export function restRemaining(state: SessionState, now: number): number {
  if (state.phase !== 'rest' || state.restEndsAt === null) return 0;
  return Math.max(0, Math.ceil((state.restEndsAt - now) / 1000));
}

/** ±15 s d'un geste (SPEC §4.4). Le repos ne descend pas sous zéro. */
export function adjustRest(state: SessionState, deltaSeconds: number, now: number): SessionState {
  if (state.phase !== 'rest' || state.restEndsAt === null) return state;
  return { ...state, restEndsAt: Math.max(now, state.restEndsAt + deltaSeconds * 1000) };
}

/** Passe directement au bloc suivant (bloc facultatif, exercice impossible…). */
export function skipBlock(state: SessionState): SessionState {
  const step = currentStep(state);
  if (!step) return state;
  const nextIndex = state.steps.findIndex((s, k) => k > state.index && s.block !== step.block);
  if (nextIndex < 0) return { ...state, phase: 'done', restEndsAt: null };
  return { ...state, index: nextIndex, phase: 'work', restEndsAt: null };
}

/** Remplace un exercice du plan (les séries déjà faites restent attribuées à l'ancien). */
export function replaceItem(state: SessionState, block: number, item: number, replacement: PlanItem): SessionState {
  const blocks = state.plan.blocks.map((b, bi) =>
    bi !== block ? b : { ...b, items: b.items.map((it, ii) => (ii === item ? { ...replacement, sets: it.sets } : it)) },
  );
  return { ...state, plan: { ...state.plan, blocks } };
}

/** Change l'élastique d'un exercice (il sera enregistré avec ses séries). */
export function setItemBand(state: SessionState, block: number, item: number, band: BandChoice): SessionState {
  const blocks = state.plan.blocks.map((b, bi) =>
    bi !== block ? b : { ...b, items: b.items.map((it, ii) => (ii === item ? { ...it, band } : it)) },
  );
  return { ...state, plan: { ...state.plan, blocks } };
}

/** Avancement : étapes terminées / total. */
export function progress(state: SessionState): { done: number; total: number } {
  const done = state.phase === 'done' ? state.steps.length : state.index + (state.phase === 'rest' ? 1 : 0);
  return { done, total: state.steps.length };
}

/**
 * Avancement par bloc, pour la barre segmentée en tête de séance : une part par bloc,
 * remplie selon les séries terminées du bloc.
 */
export function blockProgress(state: SessionState): { done: number; total: number }[] {
  const { done } = progress(state);
  return state.plan.blocks.map((_, b) => {
    let total = 0;
    let finished = 0;
    state.steps.forEach((s, k) => {
      if (s.block !== b) return;
      total++;
      if (k < done) finished++;
    });
    return { done: finished, total };
  });
}

/**
 * État de chaque série de l'exercice d'une étape (cases « ✓ 9 · en cours · à venir ») :
 * valeur saisie, `null` si elle a été sautée, `undefined` si elle reste à faire.
 */
export function setsOfItem(state: SessionState, step: Step): (SetResult | null | undefined)[] {
  return state.steps
    .map((s, k) => ({ s, k }))
    .filter(({ s }) => s.block === step.block && s.item === step.item)
    .map(({ k }) => (k < state.index ? state.results[k] : undefined));
}

/**
 * Résultats déjà saisis pour l'exercice d'une étape (pour afficher « Série 1 : 8 · OK »).
 * Les séries sont attribuées à la variante en cours au moment de la saisie.
 */
export function previousResults(state: SessionState, step: Step): SetResult[] {
  return state.steps
    .map((s, k) => ({ s, r: state.results[k] }))
    .filter(({ s, r }, k) => k < state.index && s.block === step.block && s.item === step.item && r)
    .map(({ r }) => r!);
}

/**
 * Transforme la séance terminée en enregistrement d'historique.
 * Les exercices guidés (échauffement, retour au calme) ne sont pas enregistrés.
 * Une variante remplacée en cours de séance est enregistrée sous la variante finale : les séries
 * sont regroupées par exercice du plan (limite acceptable au J1).
 */
export function toRecord(state: SessionState, endedAt: number): WorkoutRecord {
  const entries: WorkoutEntry[] = [];
  state.plan.blocks.forEach((block, b) => {
    block.items.forEach((item, i) => {
      if (item.guided) return;
      const sets = state.steps
        .map((s, k) => (s.block === b && s.item === i ? state.results[k] : null))
        .filter((r): r is SetResult => r !== null);
      if (sets.length) {
        entries.push({ movementId: item.movementId, variantId: item.variantId, level: item.level, sets, ...(item.band ? { band: item.band } : {}) });
      }
    });
  });
  return {
    startedAt: new Date(state.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    locationId: state.plan.locationId,
    duration: state.plan.duration,
    kneeScore: state.plan.kneeScore,
    entries,
  };
}
