/**
 * Récupération et charge (SPEC §4.4, §4.6), fonctions pures testées dans recovery.test.ts :
 *  - séance déjà faite aujourd'hui → récupération conseillée ; une 2e séance reste possible,
 *    sans les mouvements travaillés dans les 48 dernières heures ;
 *  - charge sur les jambes : pas de jambes lourdes dans les 24 h qui suivent une séance imposée
 *    qui a sollicité les jambes ou une course (J5a) ; le vélo et le vélotaf n'en font pas partie ;
 *  - genou du lendemain : une question le matin après une activité qui a chargé les jambes ;
 *  - règle kiné : un score ≥ 3 sur 3 entrées en 7 jours → message sobre.
 */
import { addDays, dayKey, dayToDate } from './days';
import type { Feel, WorkoutRecord } from './history';
import type { Category, Movement } from './types';

// ─── Activités hors séance de renfo ───

/** Type d'une séance imposée (sport obligatoire au travail). */
export type ImposedKind = 'run' | 'circuit' | 'strength' | 'other';

export type Intensity = 'easy' | 'medium' | 'hard';

/** Séance imposée (sport obligatoire au travail), notée après coup. */
export interface ImposedActivity {
  id?: number;
  type: 'imposed';
  /** Jour local de l'activité (« 2026-11-14 »). */
  day: string;
  /** Instant de la saisie (ISO). */
  at: string;
  minutes: number;
  kind: ImposedKind;
  /** Jambes sollicitées : compte dans la charge sur le genou. */
  legs: boolean;
  intensity: Intensity;
}

/** Sortie de course : en aisance, ou « jeu » (accélérations libres, SPEC §4.7). */
export type RunKind = 'easy' | 'play';

/** Course notée (J5a) : saisie en moins de 15 s, la Garmin garde le détail. */
export interface RunActivity {
  id?: number;
  type: 'run';
  day: string;
  at: string;
  minutes: number;
  /** Distance en km, facultative. */
  km?: number;
  kind: RunKind;
  feel: Feel;
  /** Score de genou noté juste après (0–10), aussi écrit dans `kneeLogs` (contexte « run »). */
  kneeAfter: number;
}

/** Séance de vélo (d'appartement surtout) : en aisance ou fractionnée. */
export type BikeKind = 'easy' | 'intervals';

export interface BikeActivity {
  id?: number;
  type: 'bike';
  day: string;
  at: string;
  minutes: number;
  kind: BikeKind;
  feel: Feel;
}

/** Vélotaf : un aller, un retour (trips = 1) ou les deux (trips = 2). Juste noté. */
export interface CommuteActivity {
  id?: number;
  type: 'commute';
  day: string;
  at: string;
  trips: 1 | 2;
}

/** Format du test pompes (J6b) : à la maison poitrine au sol, ou format pro poitrine sur la cale. */
export type PushupFormat = 'home' | 'pro';

/**
 * Test pompes mensuel (J6b, SPEC §4.10) : le plus de pompes possible, main à plat, noté après
 * coup. Un record par format (la cale et le sol ne se comparent pas). Ne compte pas dans
 * l'objectif de la semaine ; vaut la série longue de pompes de la semaine.
 */
export interface PushupTestActivity {
  id?: number;
  type: 'pushup-test';
  day: string;
  at: string;
  format: PushupFormat;
  reps: number;
}

/**
 * Activité notée à part des séances de renfo (table `activities`, indexée par jour et type).
 * Ajouter un type ici ne demande pas de migration : les champs non indexés sont libres.
 */
export type Activity = ImposedActivity | RunActivity | BikeActivity | CommuteActivity | PushupTestActivity;

/**
 * Une activité charge-t-elle les jambes (genou) ? Une course toujours ; une séance imposée si
 * elle les a sollicitées. Le vélo (doux pour le genou) et le vélotaf (trop court) non.
 */
export function loadsLegs(a: Activity): boolean {
  return a.type === 'run' || (a.type === 'imposed' && a.legs);
}

/** Une activité imposée compte-t-elle comme du renfo (sinon : cardio) dans l'objectif hebdo (J6) ? */
export function imposedCountsAsStrength(kind: ImposedKind): boolean {
  return kind === 'circuit' || kind === 'strength';
}

// ─── Séance du jour ───

/** Délai pendant lequel un mouvement déjà travaillé est écarté d'une 2e séance. */
export const RECOVERY_HOURS = 48;

/** Charge sur les jambes : délai sans jambes lourdes après une course ou une séance imposée « jambes ». */
export const LEGS_LOAD_HOURS = 24;

/** Familles écartées d'une 2e séance si travaillées récemment (les bras aussi, J3b). */
const MAIN: readonly Category[] = ['push', 'pull', 'legs', 'arms'];

/** Une séance de renfo a-t-elle déjà été terminée aujourd'hui (jour local) ? */
export function sessionDoneToday(workouts: readonly WorkoutRecord[], now: Date): boolean {
  const today = dayKey(now);
  return workouts.some((w) => w.entries.some((e) => e.sets.length > 0) && dayKey(new Date(w.endedAt)) === today);
}

/** Mouvements principaux (pousser, tirer, jambes) et bras travaillés dans les `hours` dernières heures. */
export function workedRecently(
  workouts: readonly WorkoutRecord[],
  catalog: readonly Movement[],
  now: Date,
  hours = RECOVERY_HOURS,
): string[] {
  const since = now.getTime() - hours * 3600_000;
  const out = new Set<string>();
  for (const w of workouts) {
    if (new Date(w.endedAt).getTime() < since) continue;
    for (const e of w.entries) {
      const cat = catalog.find((m) => m.id === e.movementId)?.category;
      if (cat && MAIN.includes(cat) && e.sets.length > 0) out.add(e.movementId);
    }
  }
  return [...out];
}

/**
 * Jambes à ménager ? Vrai si une course ou une séance imposée « jambes » date de moins de
 * 24 heures. Une activité saisie le jour même est datée de sa saisie (on la note juste après) ;
 * saisie après coup, elle est placée à midi de son jour.
 */
export function legsLoaded(activities: readonly Activity[], now: Date): boolean {
  const since = now.getTime() - LEGS_LOAD_HOURS * 3600_000;
  return activities.some((a) => {
    if (!loadsLegs(a)) return false;
    const at = new Date(a.at);
    const end = dayKey(at) === a.day ? at.getTime() : dayToDate(a.day).getTime() + 12 * 3600_000;
    return end >= since;
  });
}

// ─── Genou ───

/** Score de genou noté (table `kneeLogs`). */
export interface KneeLog {
  date: string;
  score: number;
  context: 'session' | 'run' | 'morning';
  /** Genou du lendemain : « plus mal » qu'avant l'activité. */
  worse?: boolean;
}

/** Score retenu pour une question du matin : « plus mal » compte comme 3 (SPEC §4.6). */
export const MORNING_WORSE_SCORE = 3;

/** Seuil et fenêtre de la règle kiné. */
export const KINE_SCORE = 3;
export const KINE_COUNT = 3;
export const KINE_DAYS = 7;

/** Une activité de ce jour a-t-elle chargé les jambes (renfo avec jambes, course, imposée « jambes ») ? */
export function legsLoadedOn(
  day: string,
  workouts: readonly WorkoutRecord[],
  activities: readonly Activity[],
  catalog: readonly Movement[],
): boolean {
  const legsSession = workouts.some(
    (w) =>
      dayKey(new Date(w.endedAt)) === day &&
      w.entries.some((e) => e.sets.length > 0 && catalog.find((m) => m.id === e.movementId)?.category === 'legs'),
  );
  return legsSession || activities.some((a) => a.day === day && loadsLegs(a));
}

/**
 * Poser la question « genou ce matin » ? Le matin (5 h – 14 h), si la veille a chargé les jambes
 * et qu'on n'a pas encore répondu aujourd'hui.
 */
export function askMorningKnee(
  now: Date,
  workouts: readonly WorkoutRecord[],
  activities: readonly Activity[],
  kneeLogs: readonly KneeLog[],
  catalog: readonly Movement[],
): boolean {
  const h = now.getHours();
  if (h < 5 || h >= 14) return false;
  const today = dayKey(now);
  if (kneeLogs.some((k) => k.context === 'morning' && dayKey(new Date(k.date)) === today)) return false;
  return legsLoadedOn(addDays(today, -1), workouts, activities, catalog);
}

/** Genou « plus mal » ce matin : la séance du jour ménage les jambes (score ramené à 3 au moins). */
export function morningWorseToday(kneeLogs: readonly KneeLog[], now: Date): boolean {
  const today = dayKey(now);
  return kneeLogs.some((k) => k.context === 'morning' && k.worse && dayKey(new Date(k.date)) === today);
}

/** Règle kiné : au moins 3 scores ≥ 3 sur les 7 derniers jours. */
export function kineAlert(kneeLogs: readonly KneeLog[], now: Date): boolean {
  const since = now.getTime() - KINE_DAYS * 86_400_000;
  return kneeLogs.filter((k) => new Date(k.date).getTime() >= since && k.score >= KINE_SCORE).length >= KINE_COUNT;
}
