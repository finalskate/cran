/**
 * Planning de la semaine (J6a, demande du 09/11). Fonctions pures, testées dans weekPlan.test.ts.
 *
 * Pas de jours habituels (« ça dépend ») : l'appli RÉPARTIT ce qui reste de l'objectif de la
 * semaine sur les jours qui restent, et refait la répartition à chaque changement (séance faite,
 * jour sauté, jour déplacé). Un jour se règle d'un geste : renfo, cardio, repos, « pas dispo »,
 * ou « laisser Cran choisir » ; le reste se réarrange autour.
 *
 * ─── Règles (dures : jamais enfreintes par l'appli, seulement par un choix de l'utilisateur) ───
 *  - pas deux renfos deux jours de suite (au moins un jour entre deux) ;
 *  - pas de course le lendemain d'une journée qui a chargé les jambes (renfo avec jambes, course,
 *    séance imposée « jambes »), ni deux courses de suite. Un renfo prévu la veille d'une course
 *    se fait SANS jambes (le moteur de séance le sait : src/ui/planner.ts) ;
 *  - au moins un vrai jour de repos dans la semaine, et jamais plus de 3 jours actifs d'affilée
 *    (le genou et les tendons récupèrent moins vite que les muscles) ;
 *  - genou ≥ 3 au moment de planifier : aujourd'hui, repos ou mobilité ;
 *  - jamais de rattrapage en double : une séance par jour, un jour sauté est simplement redistribué.
 * ─── Préférences (départagent les répartitions possibles) ───
 *  - la sortie longue le week-end, et pas de séance le lendemain d'une longue ;
 *  - des jours actifs espacés plutôt qu'enchaînés ;
 *  - un renfo pas collé à la veille d'une course (il perdrait ses jambes) ;
 *  - plutôt tôt dans la semaine (une marge si un imprévu tombe).
 * Objectif hors de portée : la meilleure version réduite, dite simplement (`reachable`).
 *
 * Méthode : au plus 7 jours × 3 possibilités (renfo, cardio, rien) = 2 187 répartitions, toutes
 * notées (pénalités ci-dessous) ; la moins pénalisée gagne. Simple, exact et instantané.
 */
import { addDays } from './days';
import { BASE_RUN_MINUTES, PROGRESS_FROM_WEEK, type RunPlan } from './running';
import type { TrainingFocus } from './types';
import type { WeekGoal } from './week';

/** Choix de l'utilisateur pour un jour. `rest` : repos voulu ; `off` : pas disponible. */
export type DayChoice = 'strength' | 'cardio' | 'rest' | 'off';

/** Ce qui s'est passé un jour déjà vécu (ou aujourd'hui). */
export interface DayDone {
  strength: boolean;
  cardio: boolean;
  /** Une course (la mienne ou imposée). */
  run: boolean;
  /** La journée a chargé les jambes (src/domain/recovery.ts, legsLoadedOn). */
  legs: boolean;
}

/** Une séance de cardio à prévoir : la longue, la sortie « jeu », une sortie de base, ou du vélo. */
export interface CardioSlot {
  kind: 'long' | 'play' | 'base' | 'bike';
  minutes: number;
}

export interface WeekPlanInput {
  monday: string;
  today: string;
  /** Heure locale : tard le soir, aujourd'hui n'est plus planifié (sauf choix explicite). */
  hour: number;
  /** Jours vécus de la semaine (aujourd'hui compris) et la veille du lundi. Absent = rien. */
  done: Readonly<Record<string, DayDone>>;
  goal: WeekGoal;
  /** Cardio proposé (phase et lieu) : la course charge les jambes, le vélo non. */
  cardio: 'run' | 'bike';
  /** Sorties de course qui restent, dans l'ordre du plan de course (runSlots). */
  runSlots: readonly CardioSlot[];
  /** Genou du moment (24 dernières heures). */
  knee: number;
  choices: Readonly<Record<string, DayChoice>>;
  focus: TrainingFocus;
}

export type PlanKind = 'strength' | 'cardio' | 'rest' | 'off';

export interface PlanDay {
  day: string;
  /**
   * past : jour passé sans séance ; done : une séance faite ce jour-là ; planned : à venir
   * (aujourd'hui compris tant que rien n'est fait).
   */
  status: 'past' | 'done' | 'planned';
  /** Pour un jour à venir : ce qui est prévu. */
  kind?: PlanKind;
  slot?: CardioSlot;
  /** Renfo prévu la veille d'une course : sans jambes. */
  noLegs?: boolean;
  /** Réglé à la main (les autres jours sont choisis par l'appli). */
  chosen?: boolean;
  /** Aujourd'hui, genou ≥ 3 : repos ou mobilité. */
  kneeRest?: boolean;
}

export interface WeekPlan {
  monday: string;
  /** Lundi → dimanche. */
  days: PlanDay[];
  /** Ce qui reste à faire pour atteindre l'objectif. */
  remaining: WeekGoal;
  /** Ce que le planning arrive à placer (≤ remaining, sauf choix de l'utilisateur). */
  planned: WeekGoal;
  /** L'objectif complet tient dans les jours qui restent. */
  reachable: boolean;
}

/** Après cette heure, une journée sans séance n'est plus planifiée (sauf choix explicite). */
export const LATE_HOUR = 21;
/** Jours actifs d'affilée au plus (séances faites comprises). */
export const MAX_ACTIVE_STREAK = 3;
/** Genou à partir duquel aujourd'hui devient repos ou mobilité. */
export const KNEE_PLAN_REST = 3;

// Pénalités (plus c'est haut, plus la répartition est écartée).
const P_RULE = 1000; // règle dure enfreinte
const P_MISSING = 100; // séance de l'objectif qu'on n'arrive pas à placer
const P_LONG_WEEKDAY = 4; // la longue en semaine alors que le week-end était possible
const P_AFTER_LONG = 5; // une séance le lendemain de la longue
const P_BACK_TO_BACK = 2; // deux jours actifs de suite
const P_EARLY = 0.01; // par jour de retard : à égalité, plus tôt vaut mieux

/** Pénalité d'un renfo collé à la veille d'une course (il perd ses jambes). */
const noLegsPenalty = (focus: TrainingFocus) => (focus === 'upper' ? 1 : 3);

/**
 * Sorties de course qui restent cette semaine, d'après le plan de course : la longue d'abord
 * (si elle dépasse la base), la sortie jeu (dès la semaine 3), puis des sorties de base.
 */
export function runSlots(plan: RunPlan): CardioSlot[] {
  const slots: CardioSlot[] = [];
  if (!plan.longDone) {
    slots.push(plan.longMinutes > BASE_RUN_MINUTES ? { kind: 'long', minutes: plan.longMinutes } : { kind: 'base', minutes: BASE_RUN_MINUTES });
  }
  if (plan.week >= PROGRESS_FROM_WEEK && !plan.playDone) slots.push({ kind: 'play', minutes: BASE_RUN_MINUTES });
  while (slots.length < 4) slots.push({ kind: 'base', minutes: BASE_RUN_MINUTES });
  return slots;
}

/** Durée proposée d'une séance de vélo dans le planning. */
const BIKE_SLOT: CardioSlot = { kind: 'bike', minutes: 30 };

const isWeekend = (monday: string, day: string) => day === addDays(monday, 5) || day === addDays(monday, 6);

/** Répartit les séances de cardio prévues : la longue le week-end si possible, sinon la première. */
function assignSlots(monday: string, cardioDays: readonly string[], input: WeekPlanInput): Map<string, CardioSlot> {
  const out = new Map<string, CardioSlot>();
  if (input.cardio === 'bike') {
    for (const d of cardioDays) out.set(d, BIKE_SLOT);
    return out;
  }
  const slots = [...input.runSlots];
  const rest = [...cardioDays];
  if (slots[0]?.kind === 'long' && rest.length > 0) {
    const day = rest.find((d) => isWeekend(monday, d)) ?? rest[0]!;
    out.set(day, slots.shift()!);
    rest.splice(rest.indexOf(day), 1);
  }
  for (const d of rest) out.set(d, slots.shift() ?? { kind: 'base', minutes: BASE_RUN_MINUTES });
  return out;
}

/** Ce que fait (ou fera) chaque jour, vu par les règles. */
interface Cell {
  strength: boolean;
  cardio: boolean;
  run: boolean;
  /** Charge les jambes (connu pour un jour vécu ; pour un renfo prévu : pas la veille d'une course). */
  legs: boolean;
  planned: boolean;
}

const EMPTY: DayDone = { strength: false, cardio: false, run: false, legs: false };

export function planWeek(input: WeekPlanInput): WeekPlan {
  const { monday, today } = input;
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const doneOf = (d: string) => input.done[d] ?? EMPTY;
  const active = (d: DayDone) => d.strength || d.cardio;

  const doneStrength = days.filter((d) => d <= today && doneOf(d).strength).length;
  const doneCardio = days.filter((d) => d <= today && doneOf(d).cardio).length;
  const remaining: WeekGoal = {
    strength: Math.max(0, input.goal.strength - doneStrength),
    cardio: Math.max(0, input.goal.cardio - doneCardio),
  };

  // Jours à planifier : demain et après, et aujourd'hui s'il n'y a encore rien de fait (pas trop tard).
  const todayFree = !active(doneOf(today)) && (input.hour < LATE_HOUR || input.choices[today] !== undefined);
  const kneeRestToday = todayFree && input.knee >= KNEE_PLAN_REST && input.choices[today] === undefined;
  const free = days.filter((d) => d > today || (d === today && todayFree && !kneeRestToday));

  // Choix de l'utilisateur (fixés) et jours laissés à l'appli.
  const fixed = new Map<string, PlanKind>();
  for (const d of free) {
    const c = input.choices[d];
    if (c) fixed.set(d, c);
  }
  const open = free.filter((d) => !fixed.has(d));
  const fixedStrength = [...fixed.values()].filter((k) => k === 'strength').length;
  const fixedCardio = [...fixed.values()].filter((k) => k === 'cardio').length;
  const maxStrength = Math.max(0, remaining.strength - fixedStrength);
  const maxCardio = Math.max(0, remaining.cardio - fixedCardio);

  let best: { score: number; kinds: Map<string, PlanKind> } | null = null;
  const kinds = new Map<string, PlanKind>(fixed);
  const OPTIONS: PlanKind[] = ['strength', 'cardio', 'rest'];

  const visit = (i: number, s: number, c: number) => {
    if (i === open.length) {
      const score = scorePlan(input, days, kinds, remaining);
      if (!best || score < best.score) best = { score, kinds: new Map(kinds) };
      return;
    }
    for (const k of OPTIONS) {
      if (k === 'strength' && s >= maxStrength) continue;
      if (k === 'cardio' && c >= maxCardio) continue;
      kinds.set(open[i]!, k);
      visit(i + 1, s + (k === 'strength' ? 1 : 0), c + (k === 'cardio' ? 1 : 0));
    }
    kinds.delete(open[i]!);
  };
  visit(0, 0, 0);

  const chosen = (best as { kinds: Map<string, PlanKind> } | null)?.kinds ?? kinds;
  const cardioDays = free.filter((d) => chosen.get(d) === 'cardio');
  const slots = assignSlots(monday, cardioDays, input);

  const planDays: PlanDay[] = days.map((day, i) => {
    if (day < today || (day === today && !todayFree)) {
      return { day, status: active(doneOf(day)) ? 'done' : 'past' };
    }
    if (day === today && kneeRestToday) return { day, status: 'planned', kind: 'rest', kneeRest: true };
    const kind = chosen.get(day) ?? 'rest';
    const next = days[i + 1];
    const nextRun = !!next && chosen.get(next) === 'cardio' && input.cardio === 'run';
    return {
      day,
      status: 'planned',
      kind,
      ...(kind === 'cardio' ? { slot: slots.get(day)! } : {}),
      ...(kind === 'strength' && nextRun ? { noLegs: true } : {}),
      ...(fixed.has(day) ? { chosen: true } : {}),
    };
  });

  const planned: WeekGoal = {
    strength: planDays.filter((d) => d.status === 'planned' && d.kind === 'strength').length,
    cardio: planDays.filter((d) => d.status === 'planned' && d.kind === 'cardio').length,
  };
  return {
    monday,
    days: planDays,
    remaining,
    planned,
    reachable: planned.strength >= remaining.strength && planned.cardio >= remaining.cardio,
  };
}

/** Note d'une répartition (plus bas = mieux). */
function scorePlan(input: WeekPlanInput, days: readonly string[], kinds: ReadonlyMap<string, PlanKind>, remaining: WeekGoal): number {
  const run = input.cardio === 'run';
  // La veille du lundi compte pour les règles du lundi.
  const all = [addDays(input.monday, -1), ...days];
  const cells: Cell[] = all.map((d) => {
    const k = kinds.get(d);
    if (k === undefined) {
      const done = input.done[d] ?? EMPTY;
      return { ...done, planned: false };
    }
    return { strength: k === 'strength', cardio: k === 'cardio', run: k === 'cardio' && run, legs: k === 'cardio' && run, planned: true };
  });
  // Un renfo prévu charge les jambes, sauf s'il est la veille d'une course (fait sans jambes).
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (c.planned && c.strength) c.legs = !cells[i + 1]?.run;
  }

  let score = 0;
  let strength = 0;
  let cardio = 0;
  let restDay = false;
  // Jour de la longue : celui que l'affectation des sorties lui donnera.
  const cardioDays = days.filter((d) => kinds.get(d) === 'cardio');
  const slots = assignSlots(input.monday, cardioDays, input);
  const longDay = [...slots.entries()].find(([, s]) => s.kind === 'long')?.[0];

  // Jours actifs d'affilée jusqu'à la veille du lundi (compte pour la série du début de semaine).
  let streak = cells[0]!.strength || cells[0]!.cardio ? 1 : 0;
  for (let i = 1; i < cells.length; i++) {
    const c = cells[i]!;
    const prev = cells[i - 1]!;
    const day = all[i]!;
    if (!c.strength && !c.cardio) {
      restDay = true;
      streak = 0;
      continue;
    }
    streak++;
    if (!c.planned) continue;
    if (streak > MAX_ACTIVE_STREAK) score += P_RULE;
    if (c.strength) strength++;
    if (c.cardio) cardio++;
    if (c.strength && prev.strength) score += P_RULE;
    if (c.run && (prev.run || prev.legs)) score += P_RULE;
    if (c.strength && cells[i + 1]?.run) score += noLegsPenalty(input.focus);
    if (prev.strength || prev.cardio) score += P_BACK_TO_BACK;
    if (longDay && day === addDays(longDay, 1)) score += P_AFTER_LONG;
    score += P_EARLY * i;
  }
  if (!restDay) score += P_RULE;
  // La longue en semaine, alors que le week-end est encore à planifier.
  if (longDay && !isWeekend(input.monday, longDay) && days.slice(5).some((d) => kinds.has(d))) score += P_LONG_WEEKDAY;
  score += P_MISSING * (Math.max(0, remaining.strength - strength) + Math.max(0, remaining.cardio - cardio));
  return score;
}

/** À partir de cette heure, l'accueil parle de demain (si aujourd'hui n'a plus rien de prévu). */
export const EVENING_HOUR = 18;

/**
 * Prochaine chose à faire, pour l'accueil : la séance prévue aujourd'hui tant qu'elle n'est pas
 * faite ; sinon le repos prévu aujourd'hui, ou, le soir (ou une fois la séance faite), demain.
 * Le dimanche, demain est dans `nextWeek`. `null` : rien à dire.
 */
export function nextPlanned(
  plan: WeekPlan,
  today: string,
  hour: number,
  nextWeek?: WeekPlan,
): { when: 'today' | 'tomorrow'; day: PlanDay } | null {
  const t = plan.days.find((d) => d.day === today);
  if (t?.status === 'planned' && (t.kind === 'strength' || t.kind === 'cardio')) return { when: 'today', day: t };
  const tomorrowKey = addDays(today, 1);
  const tomorrow = [...plan.days, ...(nextWeek?.days ?? [])].find((d) => d.day === tomorrowKey);
  const evening = hour >= EVENING_HOUR || t?.status !== 'planned';
  if (evening && tomorrow?.status === 'planned') return { when: 'tomorrow', day: tomorrow };
  if (t?.status === 'planned') return { when: 'today', day: t };
  return null;
}
