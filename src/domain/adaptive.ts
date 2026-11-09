/**
 * Ajustement adaptatif de la cible (SPEC §4.8 phase A) : après 14 jours de notes et de pesées,
 * on compare ce qui a été mangé à l'évolution réelle du poids pour en déduire la dépense
 * RÉELLE, et on propose une nouvelle cible. Fonctions pures, testées dans adaptive.test.ts.
 *
 * Principe : sur une période, apports moyens − (variation de poids × 7 700 kcal/kg) / jours
 * = dépense. Une erreur constante d'estimation des portions est ainsi absorbée.
 *
 * Garde-fous :
 *  - une journée sans rien de noté est ignorée ; une journée « partielle » (moins de 60 % de la
 *    dépense estimée : un repas oublié, sûrement) est mise de côté, sauf avis contraire ;
 *  - il faut assez de journées comptées et assez de pesées, sinon la calibration continue ;
 *  - la cible ne bouge que de 250 kcal au plus par ajustement, jamais sous le plancher, et ne
 *    baisse pas si la perte dépasse déjà 1 % du poids par semaine.
 *
 * La pente du poids est une régression linéaire sur les pesées de la période : avec peu de
 * pesées (l'habitude se prend), elle est plus robuste qu'une moyenne mobile. La courbe lissée
 * de l'écran Poids (J3) pourra réutiliser `weightSlope`.
 */
import { addDays, daysBetween } from './days';
import { DEFICIT_KCAL, type WeightEntry } from './nutrition';

/** Longueur d'une période d'ajustement (et délai entre deux propositions). */
export const ADJUST_PERIOD_DAYS = 14;

/** Énergie d'un kilo de poids perdu ou pris (tissu adipeux, valeur usuelle). */
export const KCAL_PER_KG = 7700;

/** Sous cette part de la dépense estimée, une journée est jugée partielle. */
export const PARTIAL_DAY_RATIO = 0.6;

/** Minimum de journées comptées sur la période. */
export const MIN_COUNTED_DAYS = 8;

/** Minimum de pesées, et écart minimal entre la première et la dernière (en jours). */
export const MIN_WEIGH_INS = 4;
export const MIN_WEIGH_SPAN_DAYS = 9;

/** Variation maximale de la cible en un ajustement. */
export const MAX_STEP_KCAL = 250;

/** Perte hebdomadaire au-delà de laquelle on ne baisse plus la cible (part du poids). */
export const FAST_LOSS_RATIO = 0.01;

/** Choix manuel sur une journée : la compter malgré tout, ou la mettre de côté. */
export type DayOverride = 'count' | 'skip';

/** Une journée est-elle partielle (assez peu notée pour fausser le calcul) ? */
export function isPartialDay(kcal: number, expenditure: number): boolean {
  return kcal < PARTIAL_DAY_RATIO * expenditure;
}

/**
 * La journée compte-t-elle pour le calcul ? Rien de noté : jamais (impossible de la compter,
 * c'est la promesse de l'écran « Pourquoi tout noter ? »). Sinon, le choix manuel l'emporte,
 * et à défaut une journée partielle est mise de côté.
 */
export function dayCounts(kcal: number, expenditure: number, override?: DayOverride): boolean {
  if (kcal <= 0) return false;
  if (override) return override === 'count';
  return !isPartialDay(kcal, expenditure);
}

export interface Slope {
  /** Variation de poids par jour (kg, négative quand on perd). */
  kgPerDay: number;
  /** Nombre de pesées utilisées et écart entre la première et la dernière (jours). */
  count: number;
  spanDays: number;
}

/** Pente du poids (moindres carrés) sur les pesées comprises entre deux jours, bornes incluses. */
export function weightSlope(weights: readonly WeightEntry[], from: string, to: string): Slope | null {
  const points = weights.filter((w) => w.day >= from && w.day <= to).map((w) => ({ x: daysBetween(from, w.day), y: w.kg }));
  if (points.length < 2) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const xs = points.map((p) => p.x);
  return { kgPerDay: sxy / sxx, count: n, spanDays: Math.max(...xs) - Math.min(...xs) };
}

export interface AdjustInput {
  /** Période étudiée, bornes incluses. */
  from: string;
  to: string;
  /** kcal notées par jour alimentaire (jours absents = rien de noté). */
  dayKcal: Readonly<Record<string, number>>;
  overrides: Readonly<Record<string, DayOverride>>;
  weights: readonly WeightEntry[];
  /** Dépense estimée actuelle (formule, ou ajustement précédent). */
  expenditure: number;
  /** Cible actuelle et plancher. */
  currentKcal: number;
  floor: number;
}

export type Adjustment =
  | {
      status: 'not-enough';
      countedDays: number;
      weighIns: number;
      /** Ce qui manque encore (0 = suffisant). */
      missingDays: number;
      missingWeighIns: number;
    }
  | {
      status: 'ready';
      countedDays: number;
      weighIns: number;
      /** Apports moyens des journées comptées (kcal). */
      meanIntake: number;
      /** Variation de poids par semaine (kg). */
      kgPerWeek: number;
      /** Dépense déduite (kcal/jour), arrondie à la dizaine. */
      measured: number;
      /** Cible proposée, après garde-fous. */
      proposedKcal: number;
      /** Garde-fous appliqués. */
      capped: boolean;
      floored: boolean;
      fastLoss: boolean;
    };

const round10 = (n: number) => Math.round(n / 10) * 10;

/** Calcule la dépense réelle et la cible proposée sur une période. */
export function computeAdjustment(input: AdjustInput): Adjustment {
  const { from, to, dayKcal, overrides, weights, expenditure, currentKcal, floor } = input;

  const counted: number[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const kcal = dayKcal[day] ?? 0;
    if (dayCounts(kcal, expenditure, overrides[day])) counted.push(kcal);
  }
  const slope = weightSlope(weights, from, to);
  const weighIns = slope?.count ?? weights.filter((w) => w.day >= from && w.day <= to).length;
  const enoughWeights = !!slope && slope.count >= MIN_WEIGH_INS && slope.spanDays >= MIN_WEIGH_SPAN_DAYS;

  if (counted.length < MIN_COUNTED_DAYS || !enoughWeights) {
    return {
      status: 'not-enough',
      countedDays: counted.length,
      weighIns,
      missingDays: Math.max(0, MIN_COUNTED_DAYS - counted.length),
      // Assez de pesées mais trop rapprochées : il en faut encore une, plus tard.
      missingWeighIns: enoughWeights ? 0 : Math.max(1, MIN_WEIGH_INS - weighIns),
    };
  }

  const meanIntake = counted.reduce((s, k) => s + k, 0) / counted.length;
  const measured = round10(meanIntake - slope!.kgPerDay * KCAL_PER_KG);
  const kgPerWeek = slope!.kgPerDay * 7;

  let proposed = round10(measured - DEFICIT_KCAL);
  let capped = false;
  if (Math.abs(proposed - currentKcal) > MAX_STEP_KCAL) {
    proposed = currentKcal + Math.sign(proposed - currentKcal) * MAX_STEP_KCAL;
    capped = true;
  }
  const lastKg = [...weights].filter((w) => w.day <= to).sort((a, b) => a.day.localeCompare(b.day)).at(-1)?.kg ?? 0;
  const fastLoss = -kgPerWeek > FAST_LOSS_RATIO * lastKg;
  if (fastLoss && proposed < currentKcal) proposed = currentKcal;
  const floored = proposed < floor;
  if (floored) proposed = floor;

  return {
    status: 'ready',
    countedDays: counted.length,
    weighIns,
    meanIntake: Math.round(meanIntake),
    kgPerWeek: Math.round(kgPerWeek * 100) / 100,
    measured,
    proposedKcal: proposed,
    capped,
    floored,
    fastLoss,
  };
}

/** Une décision d'ajustement, gardée dans les réglages. */
export interface AdjustmentRecord {
  /** Jour de la décision. */
  day: string;
  decision: 'accepted' | 'declined';
  kcalBefore: number;
  kcalAfter: number;
  /** Dépense retenue : celle qui donne la cible adoptée (cible + déficit). */
  expenditure: number;
}

/**
 * Période à étudier aujourd'hui, ou `null` s'il n'est pas encore temps : 14 jours après le
 * début de la calibration, puis 14 jours après chaque décision. La période se termine hier
 * (aujourd'hui n'est pas fini) et dure 14 jours.
 * `notBefore` : 1er jour utilisable (retour d'éloignement, J5b) ; il faut 14 jours depuis.
 */
export function adjustmentWindow(
  calibrationStart: string,
  today: string,
  lastDecision?: string,
  notBefore?: string,
): { from: string; to: string } | null {
  const base = lastDecision ?? calibrationStart;
  const since = notBefore && notBefore > base ? notBefore : base;
  if (daysBetween(since, today) < ADJUST_PERIOD_DAYS) return null;
  const to = addDays(today, -1);
  return { from: addDays(to, -(ADJUST_PERIOD_DAYS - 1)), to };
}

/** Dépense retenue par le dernier ajustement accepté (sinon la formule s'applique). */
export function adoptedExpenditure(records: readonly AdjustmentRecord[]): number | undefined {
  return [...records].reverse().find((r) => r.decision === 'accepted')?.expenditure;
}
