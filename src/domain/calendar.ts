/**
 * Calendrier du carnet : grille d'un mois, semaines du lundi au dimanche. Fonctions pures.
 * Pas de série de jours ni de « jours manqués » (SPEC §4.10) : le calendrier montre ce qui a
 * été fait, rien de ce qui ne l'a pas été.
 */
import { addDays, dayKey } from './days';

/** Mois au format « 2026-11 ». */
export type MonthKey = string;

export function monthOf(day: string): MonthKey {
  return day.slice(0, 7);
}

/** Mois voisin (`delta` = −1 pour le précédent). */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return dayKey(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

/** Lundi de la semaine d'un jour. */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = lundi
  return addDays(day, -weekday);
}

/**
 * Semaines (lundi → dimanche) qui couvrent un mois. Les jours des mois voisins complètent la
 * première et la dernière semaine (l'écran les affiche en retrait).
 */
export function monthGrid(month: MonthKey): string[][] {
  const first = `${month}-01`;
  const weeks: string[][] = [];
  for (let start = mondayOf(first); monthOf(start) <= month || weeks.length === 0; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    if (weeks.length > 6) break;
  }
  return weeks;
}

/** Séances d'une semaine (lundi → dimanche), pour la courbe « séances par semaine ». */
export interface WeekCount {
  monday: string;
  renfo: number;
  imposed: number;
}

/**
 * Nombre de séances par semaine sur les `weeks` dernières semaines (la semaine en cours
 * comprise, en dernier). On passe les JOURS des séances : renfo d'un côté, séances imposées
 * de l'autre (course et vélotaf s'y ajouteront au J5).
 */
export function weeklyCounts(renfoDays: readonly string[], imposedDays: readonly string[], today: string, weeks: number): WeekCount[] {
  const first = addDays(mondayOf(today), -7 * (weeks - 1));
  const out: WeekCount[] = Array.from({ length: weeks }, (_, i) => ({ monday: addDays(first, 7 * i), renfo: 0, imposed: 0 }));
  const slot = (day: string) => out.find((w) => w.monday === mondayOf(day));
  for (const d of renfoDays) {
    const w = slot(d);
    if (w) w.renfo++;
  }
  for (const d of imposedDays) {
    const w = slot(d);
    if (w) w.imposed++;
  }
  return out;
}
