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
