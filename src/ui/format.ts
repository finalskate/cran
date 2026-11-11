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
  arms: 'Bras',
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

/** Course (J5a) : sortie en aisance ou sortie « jeu ». */
export const RUN_KIND_LABEL = {
  easy: 'Aisance',
  play: 'Jeu',
} as const;

/** Vélo (J5a) : séance en aisance ou fractionnée. */
export const BIKE_KIND_LABEL = {
  easy: 'Aisance',
  intervals: 'Fractionné',
} as const;

/** Ressenti d'une course ou d'une séance de vélo (mêmes mots que pour une série). */
export const FEEL_LABEL = {
  easy: 'Facile',
  ok: 'OK',
  hard: 'Dur',
} as const;

/** Vélotaf : un trajet (aller ou retour) ou les deux. */
export const COMMUTE_LABEL = {
  1: 'Un trajet',
  2: 'Aller et retour',
} as const;

/** Distance : « 5,2 km ». */
export function formatKm(km: number): string {
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

const shortDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

/** « sam. 14 nov. » (carnet). */
export function formatShortDate(date: Date): string {
  return shortDate.format(date);
}

/** « 18 h 05 » (remarques d'usage). */
export function formatTime(date: Date): string {
  return `${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
}

const monthTitle = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

/** « Novembre 2026 » (calendrier ; `month` = « 2026-11 »). */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const text = monthTitle.format(new Date(y, m - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** « 85,5 cm ». */
export function formatCm(cm: number): string {
  return `${cm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} cm`;
}

/** Écart signé : « −0,4 », « +0,2 », « 0 » (le signe moins typographique, plus lisible). */
export function formatSigned(n: number, digits = 1): string {
  const rounded = Number(n.toFixed(digits));
  if (rounded === 0) return '0';
  const text = Math.abs(rounded).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${rounded < 0 ? '−' : '+'}${text}`;
}

const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' });

/**
 * Date approximative d'une projection : « début mars », « mi-mars », « fin mars », avec l'année
 * si ce n'est pas l'année en cours. Une date au jour près serait une fausse précision.
 */
export function formatApproxDate(day: string, today: string): string {
  const date = dayToDate(day);
  const d = date.getDate();
  const name = monthName.format(date);
  const part = d <= 10 ? `début ${name}` : d <= 20 ? `mi-${name}` : `fin ${name}`;
  return day.slice(0, 4) === today.slice(0, 4) ? part : `${part} ${day.slice(0, 4)}`;
}

/** « novembre 2026 » (mois d'une photo ; `month` = « 2026-11 »). */
export function formatMonthLower(month: string): string {
  return formatMonth(month).toLowerCase();
}

const tinyDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/** « 8 nov. » (axes des courbes). */
export function formatTinyDate(day: string): string {
  return tinyDate.format(dayToDate(day));
}
