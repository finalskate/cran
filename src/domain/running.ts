/**
 * Suggestion de la prochaine sortie de course et de la prochaine séance de vélo (J5a, SPEC §4.7).
 * Fonctions pures, testées dans running.test.ts (dont une simulation de 3 semaines).
 *
 * La suggestion est un TEXTE, à programmer soi-même sur la montre si on le souhaite : pas de
 * chrono, pas d'allure. Le plan se lit sur l'historique réel, jamais sur un calendrier fixe.
 *
 * ─── Règles de la course ───
 *  - Les semaines vont du lundi au dimanche ; la semaine 1 est celle de la 1re course notée.
 *  - Semaines 1 et 2 : 2 sorties de 30 min en aisance (jusqu'à 35 si tout va bien), terrain plat.
 *    Une 3e sortie, facultative, n'est proposée que si le genou est resté ≤ 2 toute la semaine.
 *  - À partir de la semaine 3 : +5 min sur UNE sortie (la « longue ») si, la semaine d'avant,
 *    la longue a été faite, le genou est resté ≤ 2, et le total prévu ne dépasse pas d'environ
 *    10 % le total réellement couru. Les autres sorties restent à 30 min.
 *  - Au-delà de 60 min (sorties longues = déclencheur de la tendinite), on monte deux fois moins
 *    vite : la longue reste au moins 2 semaines à chaque durée, et ne prend +5 min que si, le
 *    lendemain de la dernière longue, « genou ce matin » a reçu la réponse « pareil » (une
 *    question restée sans réponse ne vaut pas « pareil »). Plafond : 90 min (décidé le 09/11).
 *  - Sur tapis de course : même plan, plus un rappel (périostite : le tapis répète la même
 *    foulée, sans relief ; douleur le long du tibia = on arrête).
 *  - À partir de la semaine 3 : une sortie « jeu » par semaine (accélérations libres de 20 à 60 s).
 *  - Pas de descente raide pendant les 6 premières semaines (rappel).
 *  - Genou du moment ≥ 5 : pas de course conseillée ; 3–4 : sortie courte (20 min) et facile,
 *    sans jeu ni progression (SPEC §4.6).
 *  - Pause : ≥ 10 jours sans courir → une semaine entière sans course, donc pas de +5 : on
 *    reprend la dernière longue réellement courue ; ≥ 21 jours → le plan repart en semaine 1.
 *  - Une course imposée (travail) compte comme une sortie de la semaine (pour ne pas en
 *    proposer trop) et dans le total, mais ne démarre pas le plan et ne vaut pas « longue ».
 *
 * ─── Règles du vélo (P3 surtout, aussi P4) ───
 *  - 20 à 40 min en aisance (30 proposées), une séance fractionnée courte par semaine
 *    (6 × 1 min soutenue), proposée après une première séance en aisance dans la semaine.
 *  - Genou ≥ 3 : aisance seulement.
 */
import { mondayOf } from './calendar';
import { addDays, dayKey, daysBetween } from './days';
import type { Activity, BikeKind, KneeLog, RunKind } from './recovery';

// ─── Réglages du plan (repères, pas dogmes) ───

/** Durée d'une sortie de base, et de la longue au départ. */
export const BASE_RUN_MINUTES = 30;
/** Durée haute acceptée pendant les 2 premières semaines. */
export const EARLY_RUN_MAX_MINUTES = 35;
/** Progression de la sortie longue, d'une semaine à l'autre. */
export const RUN_STEP_MINUTES = 5;
/** Plafond de la sortie longue. */
export const LONG_RUN_MAX_MINUTES = 90;
/** Au-delà de cette durée, la longue progresse plus lentement (voir l'en-tête). */
export const LONG_SLOW_FROM_MINUTES = 60;
/** Au-delà de LONG_SLOW_FROM_MINUTES : semaines passées à une même durée avant le +5 suivant. */
export const LONG_SLOW_HOLD_WEEKS = 2;
/** Sorties prévues par semaine (une de plus, facultative, si le genou va bien). */
export const RUNS_PER_WEEK = 2;
/** Semaine à partir de laquelle la longue progresse et la sortie « jeu » apparaît. */
export const PROGRESS_FROM_WEEK = 3;
/** Rappel « pas de descente raide » pendant ce nombre de semaines. */
export const NO_DOWNHILL_WEEKS = 6;
/** Pause qui fait repartir le plan en semaine 1. */
export const RESET_GAP_DAYS = 21;
/** Plafond d'augmentation du total de la semaine (≈ 10 %). */
export const WEEKLY_TOTAL_CAP = 1.1;
/** Tolérance : une sortie de 33 min vaut une longue de 35. */
const LONG_TOLERANCE_MINUTES = 2;
/** Genou : « va bien » jusqu'à 2 ; sortie courte à partir de 3 ; pas de course à partir de 5. */
export const KNEE_OK_MAX = 2;
export const KNEE_SHORT = 3;
export const KNEE_REST = 5;
/** Sortie courte quand le genou est à 3 ou 4. */
export const SHORT_RUN_MINUTES = 20;

/** Une course vue par le plan : les miennes et les imposées « course ». */
interface PlanRun {
  day: string;
  minutes: number;
  kind: RunKind;
  /** Notée par moi (et non imposée au travail). */
  own: boolean;
}

function runsOf(activities: readonly Activity[]): PlanRun[] {
  const out: PlanRun[] = [];
  for (const a of activities) {
    if (a.type === 'run') out.push({ day: a.day, minutes: a.minutes, kind: a.kind, own: true });
    else if (a.type === 'imposed' && a.kind === 'run') out.push({ day: a.day, minutes: a.minutes, kind: 'easy', own: false });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** Genou du moment : le plus haut score noté dans les 24 dernières heures (0 si rien). */
export function currentKnee(kneeLogs: readonly KneeLog[], now: Date): number {
  const since = now.getTime() - 24 * 3600_000;
  return kneeLogs.reduce((max, k) => (new Date(k.date).getTime() >= since && k.date <= now.toISOString() ? Math.max(max, k.score) : max), 0);
}

/** Le genou est-il resté ≤ 2 sur la semaine qui commence au lundi `monday` ? */
function kneeOkDuring(kneeLogs: readonly KneeLog[], monday: string): boolean {
  const sunday = addDays(monday, 6);
  return kneeLogs.every((k) => {
    const d = dayKey(new Date(k.date));
    return d < monday || d > sunday || k.score <= KNEE_OK_MAX;
  });
}

/** Le lendemain de `day`, « genou ce matin » a-t-il reçu la réponse « pareil » ? */
function morningSameAfter(kneeLogs: readonly KneeLog[], day: string): boolean {
  const next = addDays(day, 1);
  return kneeLogs.some((k) => k.context === 'morning' && !k.worse && dayKey(new Date(k.date)) === next);
}

/**
 * Début du plan : la 1re de mes courses depuis la dernière pause de 21 jours ou plus. `null` si
 * je n'ai jamais couru, ou si ma dernière course date de 21 jours ou plus (le plan repartira de
 * la semaine 1 à la prochaine).
 */
function planStart(own: readonly PlanRun[], today: string): string | null {
  const last = own.at(-1);
  if (!last || daysBetween(last.day, today) >= RESET_GAP_DAYS) return null;
  let start = own[0]!.day;
  for (let i = 1; i < own.length; i++) {
    if (daysBetween(own[i - 1]!.day, own[i]!.day) >= RESET_GAP_DAYS) start = own[i]!.day;
  }
  return start;
}

/** La prochaine sortie conseillée. */
export interface NextRun {
  minutes: number;
  kind: RunKind;
  /** C'est la sortie longue de la semaine (plus longue que la base). */
  long: boolean;
  /** 3e sortie de la semaine, facultative. */
  optional: boolean;
}

export interface RunPlan {
  /** Semaine du plan (1 = celle de la 1re course ; 1 aussi tant que rien n'est couru). */
  week: number;
  /** Le plan repart en semaine 1 après une pause de 21 jours ou plus. */
  restart: boolean;
  /** Au moins une course notée depuis la dernière pause (sinon : la prochaine ouvre la semaine 1). */
  started: boolean;
  /**
   * go : sortie normale ; short : genou à 3–4, sortie courte et facile ; rest : genou ≥ 5,
   * pas de course conseillée ; week-done : les sorties de la semaine sont faites.
   */
  status: 'go' | 'short' | 'rest' | 'week-done';
  next: NextRun | null;
  /** Sorties faites cette semaine (imposées comprises) et sorties prévues. */
  done: number;
  target: number;
  /** Durée de la sortie longue cette semaine. */
  longMinutes: number;
  /** Le genou est resté ≤ 2 cette semaine (condition de la 3e sortie). */
  kneeOkThisWeek: boolean;
  /** Genou du moment (24 dernières heures). */
  knee: number;
  /** Une course est déjà notée aujourd'hui. */
  ranToday: boolean;
  /**
   * Dernier jour du rappel « pas de descente raide » (inclus), ou null s'il est passé. Tant que
   * le plan n'a pas commencé, compté depuis aujourd'hui (l'écran dit alors « 6 semaines »).
   */
  noDownhillUntil: string | null;
}

/**
 * Durée de la sortie longue, semaine par semaine, du début du plan à la semaine `upTo`.
 * Une semaine sans aucune de mes courses (pause) ne garde pas la longue prévue mais la DERNIÈRE
 * longue réellement courue : après 12 jours d'arrêt, on ne reprend pas sur une durée jamais faite.
 */
function longByWeek(runs: readonly PlanRun[], kneeLogs: readonly KneeLog[], startMonday: string, upTo: number): number[] {
  const long: number[] = [];
  /** Dernière longue réellement courue (ou la base). */
  let lastDone = BASE_RUN_MINUTES;
  for (let w = 1; w <= upTo; w++) {
    const prev = long[w - 2] ?? BASE_RUN_MINUTES;
    const monday = addDays(startMonday, 7 * (w - 2));
    const sunday = addDays(monday, 6);
    const week = w >= 2 ? runs.filter((r) => r.day >= monday && r.day <= sunday) : [];
    const longDone = week.some((r) => r.own && r.minutes >= prev - LONG_TOLERANCE_MINUTES);
    if (longDone) lastDone = prev;
    if (w < PROGRESS_FROM_WEEK) {
      long.push(BASE_RUN_MINUTES);
      continue;
    }
    if (!week.some((r) => r.own)) {
      long.push(lastDone);
      continue;
    }
    const total = week.reduce((n, r) => n + r.minutes, 0);
    const proposed = Math.min(prev + RUN_STEP_MINUTES, LONG_RUN_MAX_MINUTES);
    const plannedTotal = proposed + (RUNS_PER_WEEK - 1) * BASE_RUN_MINUTES;
    let progress = longDone && kneeOkDuring(kneeLogs, monday) && plannedTotal <= total * WEEKLY_TOTAL_CAP;
    if (progress && prev >= LONG_SLOW_FROM_MINUTES) {
      // Zone lente : la durée doit avoir tenu 2 semaines, et le genou du lendemain dit « pareil ».
      const recent = long.slice(-LONG_SLOW_HOLD_WEEKS);
      const held = recent.length === LONG_SLOW_HOLD_WEEKS && recent.every((m) => m === prev);
      const lastLong = week.filter((r) => r.own && r.minutes >= prev - LONG_TOLERANCE_MINUTES).at(-1);
      progress = held && !!lastLong && morningSameAfter(kneeLogs, lastLong.day);
    }
    long.push(progress ? proposed : prev);
  }
  return long;
}

/**
 * Plan de course au moment `now`, d'après les activités (courses notées et imposées) et les
 * scores de genou (toutes les entrées disponibles : séance, course, matin).
 */
export function runPlan(activities: readonly Activity[], kneeLogs: readonly KneeLog[], now: Date): RunPlan {
  const today = dayKey(now);
  const monday = mondayOf(today);
  const runs = runsOf(activities.filter((a) => a.day <= today));
  const own = runs.filter((r) => r.own);
  const start = planStart(own, today);
  const restart = start === null && own.length > 0;
  const week = start ? Math.floor(daysBetween(mondayOf(start), monday) / 7) + 1 : 1;
  const longs = start ? longByWeek(runs, kneeLogs, mondayOf(start), week) : [BASE_RUN_MINUTES];
  const longMinutes = longs.at(-1)!;

  const thisWeek = runs.filter((r) => r.day >= monday);
  const done = thisWeek.length;
  const longDone = thisWeek.some((r) => r.own && r.minutes >= longMinutes - LONG_TOLERANCE_MINUTES);
  const playDone = thisWeek.some((r) => r.own && r.kind === 'play');
  const kneeOkThisWeek = kneeOkDuring(kneeLogs, monday);
  const knee = currentKnee(kneeLogs, now);
  const downhillEnd = addDays(start ?? today, NO_DOWNHILL_WEEKS * 7 - 1);

  const base = {
    week,
    restart,
    started: start !== null,
    done,
    target: RUNS_PER_WEEK,
    longMinutes,
    kneeOkThisWeek,
    knee,
    ranToday: runs.some((r) => r.day === today),
    noDownhillUntil: downhillEnd >= today ? downhillEnd : null,
  };

  // Semaine faite : 3 sorties, ou 2 si le genou n'est pas resté calme.
  const optional = done >= RUNS_PER_WEEK;
  if (done >= RUNS_PER_WEEK + 1 || (optional && !kneeOkThisWeek)) return { ...base, status: 'week-done', next: null };
  if (knee >= KNEE_REST) return { ...base, status: 'rest', next: null };
  if (knee >= KNEE_SHORT) {
    return { ...base, status: 'short', next: { minutes: SHORT_RUN_MINUTES, kind: 'easy', long: false, optional } };
  }

  // Ordre de la semaine : la longue d'abord, puis la sortie jeu (dès la semaine 3), puis la base.
  const next: NextRun = !longDone
    ? { minutes: longMinutes, kind: 'easy', long: longMinutes > BASE_RUN_MINUTES, optional }
    : week >= PROGRESS_FROM_WEEK && !playDone
      ? { minutes: BASE_RUN_MINUTES, kind: 'play', long: false, optional }
      : { minutes: BASE_RUN_MINUTES, kind: 'easy', long: false, optional };
  return { ...base, status: 'go', next };
}

/** Texte de la suggestion : un titre et quelques lignes (le rappel des descentes est daté par l'écran). */
export interface Advice {
  title: string;
  lines: string[];
}

/**
 * Tapis de course sur le lieu choisi : `only` = seule façon de courir (éloignement), `maybe` =
 * possible, à côté du dehors. Ajoute le rappel périostite à la suggestion.
 */
export type Treadmill = 'only' | 'maybe';

export function runAdvice(plan: RunPlan, treadmill?: Treadmill): Advice {
  const { next } = plan;
  if (plan.status === 'rest') {
    return {
      title: 'Pas de course aujourd’hui',
      lines: ['Genou à 5 ou plus : laisse-le se calmer. Du vélo doux ou de la marche si ça ne tire pas.'],
    };
  }
  if (plan.status === 'week-done' || !next) {
    return {
      title: `Semaine de course faite ✓`,
      lines: [
        plan.done > RUNS_PER_WEEK
          ? `${plan.done} sorties cette semaine. La suite lundi.`
          : 'Genou un peu sensible cette semaine : on s’en tient à 2 sorties. La suite lundi.',
      ],
    };
  }
  const lines: string[] = [];
  if (plan.status === 'short') {
    lines.push('Genou à 3 ou 4 : sortie courte et facile, sur le plat. Arrête-toi si la douleur monte.');
  } else if (next.kind === 'play') {
    lines.push('En aisance, avec quelques accélérations libres de 20 à 60 s, quand tu en as envie. Pas de chrono, pas d’allure.');
  } else {
    lines.push(treadmill === 'only' ? 'Aisance respiratoire : tu peux parler en courant.' : 'Aisance respiratoire : tu peux parler en courant. Terrain plat.');
    if (plan.week < PROGRESS_FROM_WEEK) lines.push(`Jusqu’à ${EARLY_RUN_MAX_MINUTES} min si tu te sens bien.`);
    if (next.long) lines.push('C’est la sortie longue de la semaine.');
    if (next.long && next.minutes >= LONG_SLOW_FROM_MINUTES && next.minutes < LONG_RUN_MAX_MINUTES) {
      lines.push('Demain matin, réponds à « genou ce matin » : au-delà d’une heure, c’est lui qui décide du +5 min.');
    }
  }
  if (treadmill) {
    lines.push(
      `${treadmill === 'only' ? 'Sur tapis' : 'Si tu cours sur tapis'} : inclinaison à 1 %, pas plus long que prévu. Une douleur le long du tibia (périostite) : stop, et vélo à la place.`,
    );
  }
  if (next.optional) lines.push('Facultative : ton genou est resté calme cette semaine.');
  if (plan.restart) lines.push('Reprise après une pause : on repart sur des sorties de 30 min.');
  const title =
    plan.status === 'short'
      ? `${next.minutes} min tranquille`
      : next.kind === 'play'
        ? `${next.minutes} min · sortie jeu`
        : `${next.minutes} min en aisance`;
  return { title, lines };
}

/** Libellé court de la sortie : « Sortie 1 sur 2 », « 3e sortie (facultative) ». */
export function runSlotLabel(plan: RunPlan): string {
  if (!plan.next) return `${plan.done} sortie${plan.done > 1 ? 's' : ''} cette semaine`;
  if (plan.next.optional) return '3e sortie · facultative';
  return `Sortie ${plan.done + 1} sur ${plan.target} · semaine ${plan.week}`;
}

// ─── Vélo ───

/** Durée proposée d'une séance en aisance (20 à 40 min possibles). */
export const BIKE_EASY_MINUTES = 30;
/** Séance fractionnée : 10 min faciles, 6 × (1 min soutenue + 2 min faciles), 5 min faciles. */
export const BIKE_INTERVALS_MINUTES = 33;

export interface BikePlan {
  next: { minutes: number; kind: BikeKind };
  /** Séances de vélo cette semaine. */
  done: number;
  knee: number;
}

export function bikePlan(activities: readonly Activity[], kneeLogs: readonly KneeLog[], now: Date): BikePlan {
  const today = dayKey(now);
  const monday = mondayOf(today);
  const bikes = activities.filter((a) => a.type === 'bike' && a.day >= monday && a.day <= today);
  const intervalsDone = bikes.some((a) => a.type === 'bike' && a.kind === 'intervals');
  const knee = currentKnee(kneeLogs, now);
  const intervals = knee < KNEE_SHORT && !intervalsDone && bikes.length >= 1;
  return {
    next: intervals ? { minutes: BIKE_INTERVALS_MINUTES, kind: 'intervals' } : { minutes: BIKE_EASY_MINUTES, kind: 'easy' },
    done: bikes.length,
    knee,
  };
}

export function bikeAdvice(plan: BikePlan): Advice {
  if (plan.next.kind === 'intervals') {
    return {
      title: `${plan.next.minutes} min · fractionné`,
      lines: ['10 min faciles, puis 6 × (1 min soutenue + 2 min faciles), et 5 min faciles pour finir.', 'Le fractionné de la semaine : un seul suffit.'],
    };
  }
  return {
    title: `${plan.next.minutes} min en aisance`,
    lines: [
      'En aisance : tu peux parler en pédalant. Entre 20 et 40 min selon le temps que tu as.',
      ...(plan.knee >= KNEE_SHORT ? ['Genou sensible : résistance légère, sans forcer.'] : []),
    ],
  };
}
