/**
 * Sommeil (retour du 21/11 : « je dors très mal en ce moment »). Une question d'un geste le
 * matin, dans la carte de la pesée : « Ta nuit ? » bonne / moyenne / mauvaise.
 *
 * À quoi ça sert :
 *  - après une mauvaise nuit, le plan « stress, fatigue » est rappelé dès le matin (le manque de
 *    sommeil augmente la faim et l'envie de sucré le lendemain : c'est le jour où il sert) ;
 *  - dans Carnet › Corps, les nuits des deux dernières semaines, à côté du poids ;
 *  - si les mauvaises nuits s'accumulent, une phrase sobre suggère d'en parler à un médecin.
 * Ton sobre (sujet de santé) : pas de félicitations, pas de reproche.
 */
import { addDays, daysBetween } from './days';

export type NightQuality = 'good' | 'ok' | 'bad';

/** Une nuit, notée le matin : `day` est le jour du réveil. */
export interface NightEntry {
  day: string;
  /** Heure de la saisie (ISO). */
  at: string;
  quality: NightQuality;
}

export const NIGHT_QUALITIES: readonly NightQuality[] = ['good', 'ok', 'bad'];

export const NIGHT_LABEL: Readonly<Record<NightQuality, string>> = {
  good: 'Bonne',
  ok: 'Moyenne',
  bad: 'Mauvaise',
};

/** La question se pose de 4 h à 14 h : au réveil, ou en fin de matinée si on a oublié. */
export const NIGHT_ASK_FROM = 4;
export const NIGHT_ASK_UNTIL = 14;

/** Fenêtre montrée dans le Carnet, et sur laquelle on juge l'accumulation. */
export const NIGHT_WINDOW_DAYS = 14;
/** Mauvaises nuits sur la fenêtre à partir desquelles on suggère d'en parler à un médecin. */
export const NIGHT_DOCTOR_BAD = 8;

/** Faut-il demander la nuit maintenant ? (Créneau du matin, et pas encore répondu aujourd'hui.) */
export function nightAsked(nights: readonly NightEntry[], today: string, hour: number): boolean {
  if (hour < NIGHT_ASK_FROM || hour >= NIGHT_ASK_UNTIL) return false;
  return !nights.some((n) => n.day === today);
}

/** La nuit dernière a-t-elle été notée « mauvaise » ? */
export function badNight(nights: readonly NightEntry[], today: string): boolean {
  return nights.some((n) => n.day === today && n.quality === 'bad');
}

export interface NightsSummary {
  /** Les NIGHT_WINDOW_DAYS derniers jours, du plus ancien à aujourd'hui (null : pas noté). */
  days: { day: string; quality: NightQuality | null }[];
  answered: number;
  bad: number;
  /** Assez de mauvaises nuits pour suggérer, sobrement, d'en parler à un médecin. */
  adviseDoctor: boolean;
}

export function nightsSummary(nights: readonly NightEntry[], today: string): NightsSummary {
  const byDay = new Map(
    nights.filter((n) => daysBetween(n.day, today) >= 0 && daysBetween(n.day, today) < NIGHT_WINDOW_DAYS).map((n) => [n.day, n.quality]),
  );
  const days = Array.from({ length: NIGHT_WINDOW_DAYS }, (_, i) => {
    const day = addDays(today, i - NIGHT_WINDOW_DAYS + 1);
    return { day, quality: byDay.get(day) ?? null };
  });
  const bad = days.filter((d) => d.quality === 'bad').length;
  return { days, answered: byDay.size, bad, adviseDoctor: bad >= NIGHT_DOCTOR_BAD };
}
