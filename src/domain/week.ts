/**
 * La semaine d'entraînement (J5a, SPEC §4.1 et §4.10), fonctions pures testées dans week.test.ts.
 *
 * Une semaine va du lundi au dimanche. L'objectif est hebdomadaire (3 renfos + 2 cardio par
 * défaut, modifiable) : on compte des séances, jamais des jours d'affilée (SPEC §2.3).
 *  - renfo : séance de renfo terminée (une séance de 10 min compte), séance imposée « circuit »
 *    ou « musculation » ;
 *  - cardio : course, vélo, séance imposée « course » ou « autre » ;
 *  - au plus UN renfo et UN cardio comptés par jour : une 2e séance le même jour ne gonfle pas
 *    le compteur (cohérent avec la récupération, cf. recovery.ts) ;
 *  - le vélotaf est montré (petit trait) mais ne compte pas dans l'objectif.
 */
import { mondayOf } from './calendar';
import { addDays } from './days';
import { imposedCountsAsStrength, type Activity } from './recovery';

/** Objectif de la semaine : nombre de jours de renfo et de cardio. */
export interface WeekGoal {
  strength: number;
  cardio: number;
}

export const DEFAULT_WEEK_GOAL: WeekGoal = { strength: 3, cardio: 2 };

/** Bornes du réglage (Réglages → Objectif de la semaine). */
export const WEEK_GOAL_MAX = 7;

/** Ce qui s'est passé un jour de la semaine. */
export interface WeekDay {
  day: string;
  strength: boolean;
  cardio: boolean;
  /** Nombre de trajets de vélotaf (aller, retour). */
  commute: number;
}

export interface TrainingWeek {
  monday: string;
  /** Lundi → dimanche. */
  days: WeekDay[];
  /** Jours comptés dans l'objectif. */
  strength: number;
  cardio: number;
  /** Minutes de course (les miennes et les imposées « course ») et de vélo. */
  runMinutes: number;
  bikeMinutes: number;
  commuteTrips: number;
}

/** L'activité compte-t-elle comme renfo, comme cardio, ou pas du tout (vélotaf) ? */
export function activityGoal(a: Activity): 'strength' | 'cardio' | null {
  switch (a.type) {
    case 'imposed':
      return imposedCountsAsStrength(a.kind) ? 'strength' : 'cardio';
    case 'run':
    case 'bike':
      return 'cardio';
    case 'commute':
      return null;
  }
}

/**
 * Semaine commençant au lundi `monday`. On passe les JOURS des séances de renfo terminées
 * (une entrée par séance) et toutes les activités.
 */
export function trainingWeek(monday: string, renfoDays: readonly string[], activities: readonly Activity[]): TrainingWeek {
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    const acts = activities.filter((a) => a.day === day);
    return {
      day,
      strength: renfoDays.includes(day) || acts.some((a) => activityGoal(a) === 'strength'),
      cardio: acts.some((a) => activityGoal(a) === 'cardio'),
      commute: acts.reduce((n, a) => n + (a.type === 'commute' ? a.trips : 0), 0),
    };
  });
  const inWeek = activities.filter((a) => a.day >= monday && a.day <= addDays(monday, 6));
  return {
    monday,
    days,
    strength: days.filter((d) => d.strength).length,
    cardio: days.filter((d) => d.cardio).length,
    runMinutes: inWeek.reduce((n, a) => n + (a.type === 'run' || (a.type === 'imposed' && a.kind === 'run') ? a.minutes : 0), 0),
    bikeMinutes: inWeek.reduce((n, a) => n + (a.type === 'bike' ? a.minutes : 0), 0),
    commuteTrips: days.reduce((n, d) => n + d.commute, 0),
  };
}

/** Semaine du jour `day`. */
export function weekOf(day: string, renfoDays: readonly string[], activities: readonly Activity[]): TrainingWeek {
  return trainingWeek(mondayOf(day), renfoDays, activities);
}

/** L'objectif de la semaine est-il atteint ? (Les semaines réussies se compteront au J6.) */
export function goalReached(week: TrainingWeek, goal: WeekGoal): boolean {
  return week.strength >= goal.strength && week.cardio >= goal.cardio;
}

/** Minutes de cardio d'une semaine, pour la courbe du Carnet › Séances. */
export interface CardioWeek {
  monday: string;
  run: number;
  bike: number;
}

/** Minutes de course et de vélo sur les `weeks` dernières semaines (la semaine en cours en dernier). */
export function weeklyCardioMinutes(activities: readonly Activity[], today: string, weeks: number): CardioWeek[] {
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, i) => {
    const w = trainingWeek(addDays(first, 7 * i), [], activities);
    return { monday: w.monday, run: w.runMinutes, bike: w.bikeMinutes };
  });
}
