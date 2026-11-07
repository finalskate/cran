/**
 * Poids et mesures (SPEC §4.9) : tendance lissée, rythme, projection, invitations hebdomadaire
 * (tour de taille) et mensuelle (photos). Fonctions pures.
 *
 * ─── Tendance ───
 * Moyenne mobile exponentielle « à pas de temps » : le poids de chaque nouvelle pesée dépend du
 * nombre de jours écoulés depuis la précédente, pas du nombre de pesées.
 *   α_effectif = 1 − (1 − α)^Δjours, avec α = 0,1 par jour (la valeur du « Hacker's Diet »).
 * Deux pesées le même jour ou à un jour d'écart bougent peu la tendance ; après trois semaines
 * sans pesée, la nouvelle pesée compte pour ~90 % : on ne traîne pas une valeur périmée.
 * C'est ce qui rend la courbe lisible avec des données espacées (éloignement, oublis).
 *
 * ─── Rythme ───
 * Pente des moindres carrés (`weightSlope`, déjà utilisée par l'ajustement adaptatif) sur les
 * pesées brutes des 28 derniers jours. La régression n'a pas le retard d'une moyenne mobile et
 * supporte des pesées irrégulières. Il faut au moins 4 pesées étalées sur 10 jours.
 *
 * ─── Projection ───
 * « À ce rythme, 68 kg vers mi-mars » : seulement si la tendance est stable, c'est-à-dire un
 * rythme mesuré sur au moins 14 jours, une pesée récente, et une perte réaliste (0,1 à 1,5 kg
 * par semaine). Au-delà d'un an, on ne dit rien : la projection n'aurait plus de sens.
 */
import { weightSlope } from './adaptive';
import { addDays, daysBetween } from './days';
import type { WeightEntry } from './nutrition';

/** Lissage par jour de la moyenne mobile exponentielle. */
export const TREND_ALPHA = 0.1;

/** Au-delà de cet écart entre deux pesées, la courbe montre une interruption (pointillés). */
export const GAP_DAYS = 10;

/** Fenêtre et exigences du rythme affiché. */
export const RATE_WINDOW_DAYS = 28;
export const RATE_MIN_WEIGH_INS = 4;
export const RATE_MIN_SPAN_DAYS = 10;

/** Exigences supplémentaires de la projection. */
export const PROJECTION_MIN_SPAN_DAYS = 14;
export const PROJECTION_MIN_RATE = 0.1;
export const PROJECTION_MAX_RATE = 1.5;
export const PROJECTION_MAX_WEEKS = 52;

/** Sans pesée depuis ce nombre de jours, le rythme n'est plus affiché (il serait périmé). */
export const STALE_DAYS = 14;

/** En dessous de ce rythme (kg/semaine, en valeur absolue), la tendance est « stable ». */
export const STABLE_RATE = 0.1;

/** Une pesée et la tendance à ce jour-là. */
export interface TrendPoint {
  day: string;
  kg: number;
  trend: number;
  /** Plus de GAP_DAYS jours depuis la pesée précédente : la courbe s'interrompt avant ce point. */
  gapBefore: boolean;
}

/** Tendance lissée à chaque pesée, de la plus ancienne à la plus récente. */
export function trendSeries(weights: readonly WeightEntry[], alpha = TREND_ALPHA): TrendPoint[] {
  const sorted = [...weights].sort((a, b) => a.day.localeCompare(b.day));
  const out: TrendPoint[] = [];
  for (const w of sorted) {
    const prev = out.at(-1);
    if (!prev) {
      out.push({ day: w.day, kg: w.kg, trend: w.kg, gapBefore: false });
      continue;
    }
    const gap = daysBetween(prev.day, w.day);
    const a = 1 - (1 - alpha) ** Math.max(1, gap);
    out.push({ day: w.day, kg: w.kg, trend: prev.trend + a * (w.kg - prev.trend), gapBefore: gap > GAP_DAYS });
  }
  return out;
}

/** Prochaine étape d'objectif : la plus haute encore au-dessus de la tendance (68 avant 65). */
export function nextGoal(goals: readonly number[], trend: number): number | null {
  const below = goals.filter((g) => g < trend);
  return below.length > 0 ? Math.max(...below) : null;
}

export type TrendDirection = 'down' | 'stable' | 'up';

export interface Projection {
  goal: number;
  /** Jour estimé d'arrivée (« 2027-03-15 »). */
  day: string;
  weeks: number;
}

export interface BodySummary {
  /** Tendance à la dernière pesée (null sans pesée). */
  trend: number | null;
  lastDay: string | null;
  /** Écart de tendance depuis la première pesée (négatif quand on perd). */
  sinceStart: number | null;
  count: number;
  /** Rythme en kg par semaine, null s'il manque des pesées ou si la dernière est trop ancienne. */
  rate: number | null;
  direction: TrendDirection | null;
  /** Pour expliquer pourquoi le rythme n'est pas encore là. */
  missing: { weighIns: number; spanDays: number } | null;
  goal: number | null;
  projection: Projection | null;
}

/** Résumé de la courbe de poids au jour `today`. */
export function bodySummary(weights: readonly WeightEntry[], goals: readonly number[], today: string): BodySummary {
  const series = trendSeries(weights);
  const last = series.at(-1);
  if (!last) {
    return {
      trend: null,
      lastDay: null,
      sinceStart: null,
      count: 0,
      rate: null,
      direction: null,
      missing: { weighIns: RATE_MIN_WEIGH_INS, spanDays: RATE_MIN_SPAN_DAYS },
      goal: goals.length > 0 ? Math.max(...goals) : null,
      projection: null,
    };
  }

  const from = addDays(today, -(RATE_WINDOW_DAYS - 1));
  const slope = weightSlope(weights, from, today);
  const stale = daysBetween(last.day, today) > STALE_DAYS;
  const enough = !!slope && slope.count >= RATE_MIN_WEIGH_INS && slope.spanDays >= RATE_MIN_SPAN_DAYS;
  const rate = enough && !stale ? slope.kgPerDay * 7 : null;

  let missing: BodySummary['missing'] = null;
  if (rate === null && !stale) {
    const inWindow = weights.filter((w) => w.day >= from && w.day <= today).length;
    missing = {
      weighIns: Math.max(0, RATE_MIN_WEIGH_INS - inWindow),
      spanDays: Math.max(0, RATE_MIN_SPAN_DAYS - (slope?.spanDays ?? 0)),
    };
  }

  const direction: TrendDirection | null =
    rate === null ? null : Math.abs(rate) < STABLE_RATE ? 'stable' : rate < 0 ? 'down' : 'up';
  const goal = nextGoal(goals, last.trend);

  let projection: Projection | null = null;
  if (
    rate !== null &&
    goal !== null &&
    slope!.spanDays >= PROJECTION_MIN_SPAN_DAYS &&
    -rate >= PROJECTION_MIN_RATE &&
    -rate <= PROJECTION_MAX_RATE
  ) {
    const weeks = (last.trend - goal) / -rate;
    if (weeks <= PROJECTION_MAX_WEEKS) projection = { goal, weeks, day: addDays(today, Math.round(weeks * 7)) };
  }

  return {
    trend: last.trend,
    lastDay: last.day,
    sinceStart: last.trend - series[0]!.kg,
    count: series.length,
    rate,
    direction,
    missing,
    goal,
    projection,
  };
}

// ─── Mensurations ───

/** Mesures suivies. Le tour de taille seul pour l'instant ; la table accepte d'autres types. */
export type MeasureKind = 'waist';

/** Une mesure (une par type et par jour : la dernière remplace). */
export interface MeasureEntry {
  /** « waist:2026-11-14 ». */
  id: string;
  kind: MeasureKind;
  day: string;
  at: string;
  /** Valeur en cm. */
  value: number;
}

export function measureId(kind: MeasureKind, day: string): string {
  return `${kind}:${day}`;
}

/** Un tour de taille par semaine suffit : il bouge lentement et se mesure moins précisément. */
export const WAIST_INTERVAL_DAYS = 7;

/** Bornes de saisie du tour de taille (cm), contre une faute de frappe. */
export const WAIST_MIN = 40;
export const WAIST_MAX = 200;

/**
 * Faut-il proposer le tour de taille (juste après une pesée) ? Oui si la dernière mesure date
 * d'au moins une semaine (ou s'il n'y en a pas), sauf si l'invitation a été repoussée.
 */
export function waistDue(measures: readonly MeasureEntry[], today: string, snoozedUntil?: string): boolean {
  if (snoozedUntil && snoozedUntil > today) return false;
  const last = measures.filter((m) => m.kind === 'waist').reduce<string | null>((d, m) => (!d || m.day > d ? m.day : d), null);
  return !last || daysBetween(last, today) >= WAIST_INTERVAL_DAYS;
}

// ─── Photos ───

export type PhotoPose = 'front' | 'side';

/** Ordre de prise de vue : face, puis profil. */
export const PHOTO_POSES: readonly PhotoPose[] = ['front', 'side'];

/** Description d'une photo (sans l'image elle-même, pour rester pur et testable). */
export interface PhotoMeta {
  id?: number;
  day: string;
  /** « 2026-11 » : une série de photos par mois. */
  month: string;
  pose: PhotoPose;
}

/** Écart minimal entre deux séries de photos, même à cheval sur deux mois (28 nov. → 1er déc.). */
export const PHOTO_MIN_GAP_DAYS = 21;

/**
 * Photos du mois à proposer ? Oui si aucune photo ce mois-ci et si la dernière date d'au moins
 * trois semaines. Avant la toute première, on propose aussi (le point de départ est le plus précieux).
 */
export function photoDue(photos: readonly PhotoMeta[], today: string): boolean {
  if (photos.some((p) => p.month === today.slice(0, 7))) return false;
  const last = photos.reduce<string | null>((d, p) => (!d || p.day > d ? p.day : d), null);
  return !last || daysBetween(last, today) >= PHOTO_MIN_GAP_DAYS;
}

/** Mois qui ont au moins une photo de la pose demandée, du plus ancien au plus récent. */
export function photoMonths(photos: readonly PhotoMeta[], pose: PhotoPose): string[] {
  return [...new Set(photos.filter((p) => p.pose === pose).map((p) => p.month))].sort();
}

/** Tendance de poids à un jour donné (dernière pesée à cette date ou avant), pour légender une photo. */
export function trendAt(series: readonly TrendPoint[], day: string): number | null {
  let found: number | null = null;
  for (const p of series) {
    if (p.day > day) break;
    found = p.trend;
  }
  return found;
}
