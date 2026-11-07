/**
 * Mise en forme pour l'affichage (français). Fonctions pures, sans logique métier.
 */
import { addDays, dayToDate } from '../domain/days';

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

/** Repas du journal alimentaire. */
export const MEAL_LABEL = {
  morning: 'Matin',
  noon: 'Midi',
  snack: 'Collation',
  evening: 'Soir',
} as const;

/** « 2 250 » (espace des milliers à la française), arrondi à l'unité. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

/** « 80,4 kg ». */
export function formatKg(kg: number): string {
  return `${kg.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

/**
 * Lit un nombre tapé au clavier, virgule ou point (« 80,4 », « 80.4 », « 1 200 »).
 * Renvoie `undefined` si le champ est vide ou n'est pas un nombre positif.
 */
export function parseDecimal(text: string): number | undefined {
  // \s couvre aussi les espaces insécables que le clavier ou un copier-coller peuvent glisser.
  const cleaned = text.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Libellé d'un jour par rapport à aujourd'hui : « Aujourd'hui », « Hier », sinon la date. */
export function relativeDayLabel(day: string, today: string): string {
  if (day === today) return 'Aujourd’hui';
  if (addDays(day, 1) === today) return 'Hier';
  return formatLongDate(dayToDate(day));
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

/** Type de séance imposée (saisie et carnet). */
export const IMPOSED_KIND_LABEL = {
  run: 'Course',
  circuit: 'Circuit',
  strength: 'Musculation',
  other: 'Autre',
} as const;

/** Intensité ressentie d'une séance imposée. */
export const INTENSITY_LABEL = {
  easy: 'Facile',
  medium: 'Moyenne',
  hard: 'Dure',
} as const;

const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

/** « sam. 14 nov. » (carnet). */
export function formatShortDate(date: Date): string {
  return shortDate.format(date);
}

const monthTitle = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/** « Novembre 2026 » (calendrier ; `month` = « 2026-11 »). */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const text = monthTitle.format(new Date(y, m - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}
