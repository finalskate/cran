/**
 * Mise en forme pour l'affichage (français). Fonctions pures, sans logique métier.
 */

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** « Vendredi 14 novembre » (majuscule initiale, comme un titre). */
export function formatLongDate(date: Date): string {
  const text = longDate.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Taille lisible : « 1,2 Mo ». */
export function formatBytes(bytes: number): string {
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: digits })} ${units[unit]}`;
}
