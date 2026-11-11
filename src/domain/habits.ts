/**
 * Alimentation, phase B « habitudes » (SPEC §4.8, J4B) : bilan du soir en 30 secondes, plans
 * « si… alors… », résumé de la semaine. Fonctions pures, testées dans habits.test.ts.
 *
 * Décisions (08/11) :
 *  - après la calibration, on continue de noter ce qu'on mange ET on fait le bilan : les
 *    protéines du bilan se déduisent alors des entrées notées, il ne reste que 2 à 3 gestes ;
 *  - le bilan est proposé le soir (dès 19 h) et rattrapable le lendemain matin (jusqu'à 11 h) ;
 *  - un plan « si… alors… » est rappelé au moment où on note un écart avec son déclencheur.
 *
 * Les libellés des déclencheurs et les plans proposés au départ sont des DONNÉES
 * (src/data/habits.ts) ; les plans de l'utilisateur se modifient dans l'appli.
 */
import { addDays, daysBetween } from './days';
import { foodDay, type FoodEntry, type Meal } from './nutrition';

// ─── Types ───

/** Ce qui a déclenché un écart (SPEC §4.8, plus « stress » et « en cuisinant » ajoutés le 08/11). */
export type Trigger = 'boredom' | 'post-ride' | 'evening' | 'social' | 'stress' | 'cooking' | 'other';

export const TRIGGERS: readonly Trigger[] = ['boredom', 'post-ride', 'evening', 'social', 'stress', 'cooking', 'other'];

/** Écart du jour : aucun, petit, gros. */
export type Slip = 'none' | 'small' | 'big';

/** Protéines à chaque repas : oui, en partie, non. */
export type ProteinAnswer = 'yes' | 'partly' | 'no';

/** Le bilan d'une journée alimentaire (une ligne par jour : le dernier remplace). */
export interface DailyReview {
  /** Jour alimentaire (voir foodDay). */
  day: string;
  /** Instant de la saisie (ISO). */
  at: string;
  protein: ProteinAnswer;
  /** Vrai si la réponse « protéines » a été déduite des entrées notées (pas demandée). */
  proteinAuto: boolean;
  veggies: boolean;
  slip: Slip;
  /** Seulement s'il y a eu un écart. */
  trigger?: Trigger;
}

/** Un plan « si… alors… » (plusieurs plans possibles pour un même déclencheur). */
export interface IfThenPlan {
  id: string;
  trigger: Trigger;
  /** « Si… » : la situation (« je m'installe pour lire »). */
  when: string;
  /** « … alors » : ce que je fais à la place (« tisane, jamais le paquet »). */
  then: string;
}

// ─── Protéines déduites des entrées ───

/** Repas principaux : la collation ne compte pas dans « des protéines à chaque repas ». */
export const MAIN_MEALS: readonly Meal[] = ['morning', 'noon', 'evening'];

/**
 * Seuil d'un repas « protéiné » : ~25 g, de quoi stimuler la construction musculaire (les
 * repères vont de 20 à 40 g par repas ; 25 g est atteint avec une portion de viande ou de poisson).
 */
export const PROTEIN_MEAL_G = 25;

export interface MealProtein {
  meal: Meal;
  protein: number;
  ok: boolean;
}

export interface ProteinCheck {
  meals: MealProtein[];
  total: number;
  answer: ProteinAnswer;
}

/**
 * Protéines du jour d'après les entrées notées : par repas principal noté, et au total.
 * Réponse « oui » si chaque repas principal atteint le seuil, ou si la cible du jour est
 * atteinte (peu importe la répartition) ; « en partie » si au moins un repas l'atteint.
 * `null` s'il n'y a aucune entrée : il faut alors poser la question.
 */
export function proteinFromEntries(entries: readonly Pick<FoodEntry, 'meal' | 'unit' | 'count'>[], target?: number): ProteinCheck | null {
  if (entries.length === 0) return null;
  const meals: MealProtein[] = [];
  for (const meal of MAIN_MEALS) {
    const list = entries.filter((e) => e.meal === meal);
    if (list.length === 0) continue;
    const protein = Math.round(list.reduce((s, e) => s + e.unit.protein * e.count, 0));
    meals.push({ meal, protein, ok: protein >= PROTEIN_MEAL_G });
  }
  const total = Math.round(entries.reduce((s, e) => s + e.unit.protein * e.count, 0));
  const okCount = meals.filter((m) => m.ok).length;
  const answer: ProteinAnswer =
    (target !== undefined && total >= target) || (meals.length > 0 && okCount === meals.length) ? 'yes' : okCount > 0 ? 'partly' : 'no';
  return { meals, total, answer };
}

// ─── Quand proposer le bilan ───

/** Le bilan du jour est proposé à partir de 19 h… */
export const REVIEW_EVENING_HOUR = 19;
/** … et celui de la veille reste proposé jusqu'à 11 h le lendemain. */
export const REVIEW_CATCHUP_END_HOUR = 11;

export interface ReviewPrompt {
  day: string;
  /** « today » : la journée en cours (le soir) ; « yesterday » : rattrapage du matin. */
  kind: 'today' | 'yesterday';
}

/**
 * Bilan à proposer maintenant ? Le soir (19 h → 4 h, fin de la journée alimentaire) : celui de la
 * journée en cours ; le matin (4 h → 11 h) : celui de la veille. Rien s'il est déjà fait.
 */
export function reviewPrompt(now: Date, doneDays: ReadonlySet<string>): ReviewPrompt | null {
  const h = now.getHours();
  const current = foodDay(now);
  let prompt: ReviewPrompt | null = null;
  if (h >= REVIEW_EVENING_HOUR || h < 4) prompt = { day: current, kind: 'today' };
  else if (h < REVIEW_CATCHUP_END_HOUR) prompt = { day: addDays(current, -1), kind: 'yesterday' };
  return prompt && !doneDays.has(prompt.day) ? prompt : null;
}

// ─── Plans ───

/** Plans liés à un déclencheur, dans l'ordre de la liste. */
export function plansFor(plans: readonly IfThenPlan[], trigger: Trigger): IfThenPlan[] {
  return plans.filter((p) => p.trigger === trigger);
}

/** Un plan est utilisable s'il a ses deux moitiés. */
export function isCompletePlan(plan: Pick<IfThenPlan, 'when' | 'then'>): boolean {
  return plan.when.trim().length > 0 && plan.then.trim().length > 0;
}

// ─── Résumé de la semaine ───

export interface WeekSummary {
  /** Nombre de bilans sur les 7 derniers jours (aujourd'hui compris). */
  reviews: number;
  slips: number;
  bigSlips: number;
  veggieDays: number;
  proteinDays: number;
  /** Déclencheurs des écarts, du plus fréquent au moins fréquent (à égalité : ordre de TRIGGERS). */
  triggers: { trigger: Trigger; count: number }[];
}

/** Résumé des 7 derniers jours (de today − 6 à today). */
export function weekSummary(reviews: readonly DailyReview[], today: string): WeekSummary {
  const week = reviews.filter((r) => {
    const d = daysBetween(r.day, today);
    return d >= 0 && d < 7;
  });
  const counts = new Map<Trigger, number>();
  for (const r of week) if (r.slip !== 'none' && r.trigger) counts.set(r.trigger, (counts.get(r.trigger) ?? 0) + 1);
  const triggers = TRIGGERS.filter((t) => counts.has(t))
    .map((trigger) => ({ trigger, count: counts.get(trigger)! }))
    .sort((a, b) => b.count - a.count);
  return {
    reviews: week.length,
    slips: week.filter((r) => r.slip !== 'none').length,
    bigSlips: week.filter((r) => r.slip === 'big').length,
    veggieDays: week.filter((r) => r.veggies).length,
    proteinDays: week.filter((r) => r.protein === 'yes').length,
    triggers,
  };
}

// ─── Le plan au bon moment (retouche du 11/11) ───
//
// Un plan « si… alors… » agit surtout s'il est relu AVANT la situation : le rappeler seulement au
// bilan du soir, une fois l'écart fait, arrive trop tard. L'accueil montre donc le plan qui
// correspond au moment de la journée, quand on sait le prévoir :
//  - juste après un vélotaf ou une séance de vélo notée (« faim après le vélo ») ;
//  - le soir, avant de cuisiner et après le dîner (« en cuisinant », « soirée ») ;
//  - le reste de la journée, un des déclencheurs imprévisibles (ennui, stress, sorties…), à tour
//    de rôle, en privilégiant ceux qui reviennent le plus dans les bilans récents.
// Chaque moment se ferme d'un geste et ne revient pas le même jour.

/** Moments de la journée où un plan peut être rappelé. */
export type PlanSlot = 'post-ride' | 'evening' | 'day';

export interface PlanMoment {
  slot: PlanSlot;
  /** Clé « jour:moment », à garder une fois le rappel fermé (voir `planMomentKey`). */
  key: string;
  plans: IfThenPlan[];
}

/** Le plan « après le vélo » reste affiché pendant 2 h après la saisie du trajet. */
export const POST_RIDE_WINDOW_MS = 2 * 3600_000;
/** Le soir commence à 18 h : avant de cuisiner. Il dure jusqu'à la fin de la journée alimentaire (4 h). */
export const EVENING_PLAN_HOUR = 18;
/** Le rappel de la journée commence à 5 h (le reste de la nuit appartient au soir). */
export const DAY_PLAN_HOUR = 5;
/** Fenêtre des bilans qui font remonter un déclencheur fréquent. */
export const PLAN_HISTORY_DAYS = 28;

/** Déclencheurs du soir et déclencheurs qu'on ne sait pas prévoir (rappelés en journée). */
const EVENING_TRIGGERS: readonly Trigger[] = ['cooking', 'evening'];
const DAY_TRIGGERS: readonly Trigger[] = ['boredom', 'stress', 'social', 'other'];

/** Clé d'un moment rappelé : un même moment ne revient pas dans la même journée alimentaire. */
export function planMomentKey(day: string, slot: PlanSlot): string {
  return `${day}:${slot}`;
}

/**
 * Plan à rappeler maintenant, ou null. Priorité : après le vélo, puis le soir, puis la journée.
 *  - `lastRideAt` : heure (ms) de la dernière saisie d'un vélotaf ou d'une séance de vélo ;
 *  - `seen` : clés des moments déjà fermés (`planMomentKey`).
 * Seuls les plans complets (« si » et « alors » remplis) sont montrés ; sans plan, rien.
 */
export function planMoment(
  now: Date,
  plans: readonly IfThenPlan[],
  reviews: readonly DailyReview[],
  lastRideAt: number | null,
  seen: ReadonlySet<string>,
): PlanMoment | null {
  const day = foodDay(now);
  const h = now.getHours();
  const usable = plans.filter(isCompletePlan);
  const pick = (slot: PlanSlot, triggers: readonly Trigger[]): PlanMoment | null => {
    const key = planMomentKey(day, slot);
    const list = usable.filter((p) => triggers.includes(p.trigger));
    return list.length > 0 && !seen.has(key) ? { slot, key, plans: list } : null;
  };

  const sinceRide = lastRideAt === null ? Infinity : now.getTime() - lastRideAt;
  const afterRide = sinceRide >= 0 && sinceRide <= POST_RIDE_WINDOW_MS ? pick('post-ride', ['post-ride']) : null;
  if (afterRide) return afterRide;

  if (h >= EVENING_PLAN_HOUR || h < 4) return pick('evening', EVENING_TRIGGERS);
  if (h < DAY_PLAN_HOUR) return null;

  const trigger = dayTrigger(usable, reviews, day);
  return trigger ? pick('day', [trigger]) : null;
}

/**
 * Déclencheur rappelé dans la journée : à tour de rôle (un par jour) parmi ceux qui ont un plan,
 * en se limitant à ceux cités dans les bilans des 28 derniers jours s'il y en a.
 */
export function dayTrigger(plans: readonly IfThenPlan[], reviews: readonly DailyReview[], day: string): Trigger | null {
  const candidates = DAY_TRIGGERS.filter((t) => plans.some((p) => p.trigger === t));
  if (candidates.length === 0) return null;
  const cited = new Set(
    reviews
      .filter((r) => r.slip !== 'none' && r.trigger && daysBetween(r.day, day) >= 0 && daysBetween(r.day, day) < PLAN_HISTORY_DAYS)
      .map((r) => r.trigger!),
  );
  const pool = candidates.filter((t) => cited.has(t));
  const list = pool.length > 0 ? pool : candidates;
  // Rang du jour depuis une date fixe : la rotation ne dépend que du calendrier.
  const index = daysBetween('2026-01-01', day);
  return list[((index % list.length) + list.length) % list.length]!;
}
