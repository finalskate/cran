/**
 * Mise en forme pour l'affichage (français). Fonctions pures, sans logique métier.
 */

const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** « Vendredi 14 novembre » (majuscule initiale, comme un titre). */
export function formatLongDate(date: Date): string {
  const text = longDate.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Minuteur : « 1:05 », « 0:30 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Fourchette d'une série : « 8–15 rép. », « 30–45 s », « 5–10 rép. / côté ». */
export function formatTarget(target: { kind: 'reps' | 'time'; min: number; max: number }, perSide?: boolean): string {
  const range = target.min === target.max ? `${target.min}` : `${target.min}–${target.max}`;
  const unit = target.kind === 'reps' ? ' rép.' : ' s';
  return `${range}${unit}${perSide ? ' / côté' : ''}`;
}

/** Famille de mouvement, en surtitre de l'écran exercice. */
export const CATEGORY_LABEL = {
  push: 'Pousser',
  pull: 'Tirer',
  legs: 'Jambes',
  knee: 'Genou',
  core: 'Gainage',
  shoulders: 'Épaules',
  warmup: 'Échauffement',
  cooldown: 'Retour au calme',
  volume: 'Volume pompes',
} as const;

/** Ressenti global de séance (écran de bilan). */
export const SESSION_FEEL_LABEL = {
  'too-easy': 'Trop facile',
  right: 'Bien dosée',
  'too-hard': 'Trop dure',
} as const;

/** Support des mains (règle poignet). */
export const HAND_LABEL = {
  handles: 'Sur poignées',
  fists: 'Sur les poings (à limiter)',
  flat: 'Mains à plat',
} as const;

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
