/**
 * Jours « du calendrier local », au format « 2026-11-14 ». Fonctions pures.
 *
 * On ne passe jamais par l'UTC pour découper les journées : en France, un `toISOString()` à
 * 0 h 30 donne encore la veille. Ces clés servent pour l'alimentation, la pesée et, plus tard,
 * le calendrier des séances.
 */

/** Clé du jour local d'une date : « 2026-11-14 ». */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date (minuit local) correspondant à une clé de jour. */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Décale une clé de jour de `n` jours (négatif pour reculer). */
export function addDays(day: string, n: number): string {
  const date = dayToDate(day);
  date.setDate(date.getDate() + n);
  return dayKey(date);
}

/**
 * Nombre de jours entre deux clés (b − a). L'arrondi absorbe les changements d'heure
 * (une journée de 23 h ou 25 h compte pour une).
 */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / 86_400_000);
}
