/**
 * « Noter vite » (retour du 21/11 : « je ne note plus mes repas, c'est trop contraignant »).
 *
 * Une journée notée en gros vaut mieux qu'une journée notée au gramme près mais à moitié : un
 * repas qui manque fausse tout, une estimation grossière (± 25 %) presque rien. L'ajustement de
 * la cible (adaptive.ts) compare ce qui est noté à la tendance du poids, il absorbe donc de
 * lui-même un biais régulier des estimations.
 *
 * Trois façons de noter un repas en un ou deux gestes :
 *  - un repas habituel (`habitualMeals`) : ce qui a été noté au moins deux fois au même repas
 *    ces 4 dernières semaines, recopié avec ses vraies valeurs ;
 *  - un type de repas et une quantité (`quickEstimate`), avec en option légumes et protéines ;
 *  - « Sauté ».
 * Et le grignotage : petit, moyen ou gros, en option ce que c'était et ce qui l'a déclenché.
 *
 * Une saisie rapide est une ligne du journal alimentaire comme les autres (`method: 'quick'`),
 * qui porte ce qui a été choisi dans `quick` (champ non indexé : pas de migration). Noter de
 * nouveau un repas remplace sa saisie rapide précédente (`replacedByQuick`) ; une saisie
 * détaillée, elle, n'est jamais effacée.
 *
 * Les repères chiffrés (kcal et protéines par type, par quantité) sont des DONNÉES :
 * src/data/quickMeals.ts.
 */
import { addDays, daysBetween } from './days';
import type { Trigger } from './habits';
import type { FoodEntry, Meal, Nutrients } from './nutrition';

export type QuickKind = 'home' | 'sandwich' | 'fastfood' | 'out' | 'party' | 'onthego';
export type QuickSize = 'light' | 'normal' | 'big';
export type SnackSize = 'small' | 'medium' | 'big';
export type SnackTaste = 'sweet' | 'salty' | 'drink';

export const QUICK_KINDS: readonly QuickKind[] = ['home', 'sandwich', 'fastfood', 'out', 'party', 'onthego'];
export const QUICK_SIZES: readonly QuickSize[] = ['light', 'normal', 'big'];
export const SNACK_SIZES: readonly SnackSize[] = ['small', 'medium', 'big'];
export const SNACK_TASTES: readonly SnackTaste[] = ['sweet', 'salty', 'drink'];

/** Ce qui a été choisi pour une saisie rapide (porté par l'entrée du journal). */
export type QuickInfo =
  | { type: 'meal'; kind: QuickKind; size: QuickSize; veggies?: boolean; protein?: boolean }
  | { type: 'skip' }
  | { type: 'snack'; size: SnackSize; taste?: SnackTaste; trigger?: Trigger };

/** Repas principaux proposés sur l'accueil (la collation passe par « J'ai grignoté »). */
export const QUICK_MEALS: readonly Meal[] = ['morning', 'noon', 'evening'];

/** Repères utilisés pour estimer (src/data/quickMeals.ts). */
export interface QuickTable {
  /** Un repas « normal » de chaque type (déjeuner ou dîner d'un adulte). */
  base: Readonly<Record<QuickKind, Nutrients>>;
  size: Readonly<Record<QuickSize, number>>;
  /** Le petit-déjeuner pèse moins qu'un repas : facteur appliqué en plus de la quantité. */
  breakfast: number;
  snack: Readonly<Record<SnackSize, Nutrients>>;
  /** Écart relatif de la fourchette affichée (0,25 = ± 25 %). */
  spread: number;
}

export interface QuickEstimate extends Nutrients {
  /** Fourchette affichée ; `kcal` (le milieu) est ce qui est compté. */
  low: number;
  high: number;
}

/** Protéines minimales quand « viande, poisson, œufs » est coché (une portion ≈ 25 g). */
export const QUICK_PROTEIN_MIN = 25;

const round10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Estimation d'un repas d'après son type et sa quantité. `protein` : coché (au moins une
 * portion), décoché explicitement (moitié du repère), ou non renseigné (le repère).
 */
export function quickEstimate(table: QuickTable, kind: QuickKind, size: QuickSize, meal: Meal, protein?: boolean): QuickEstimate {
  const factor = table.size[size] * (meal === 'morning' ? table.breakfast : 1);
  const base = table.base[kind];
  const kcal = round10(base.kcal * factor);
  let p = base.protein * factor;
  if (protein === true) p = Math.max(p * 1.3, QUICK_PROTEIN_MIN);
  if (protein === false) p = p * 0.5;
  return { kcal, protein: Math.round(p), low: round10(kcal * (1 - table.spread)), high: round10(kcal * (1 + table.spread)) };
}

/** Estimation d'un grignotage. */
export function snackEstimate(table: QuickTable, size: SnackSize): QuickEstimate {
  const s = table.snack[size];
  return { ...s, low: round10(s.kcal * (1 - table.spread)), high: round10(s.kcal * (1 + table.spread)) };
}

/** Entrées rapides d'un repas qu'une nouvelle saisie rapide (ou un repas habituel) remplace. */
export function replacedByQuick(entries: readonly FoodEntry[], meal: Meal): FoodEntry[] {
  return entries.filter((e) => e.meal === meal && e.method === 'quick' && e.quick?.type !== 'snack');
}

// ─── Où en est chaque repas du jour (boutons de l'accueil) ───

export type MealStatus =
  | { state: 'empty' }
  | { state: 'skipped' }
  | { state: 'quick'; size: QuickSize; veggies: boolean }
  | { state: 'detailed'; kcal: number };

/** État d'un repas : rien, sauté, noté vite (quantité, légumes), ou noté en détail (kcal). */
export function mealStatus(entries: readonly FoodEntry[], meal: Meal): MealStatus {
  const own = entries.filter((e) => e.meal === meal && e.quick?.type !== 'snack');
  if (own.length === 0) return { state: 'empty' };
  const detailed = own.filter((e) => e.method !== 'quick');
  if (detailed.length > 0) return { state: 'detailed', kcal: Math.round(detailed.reduce((s, e) => s + e.unit.kcal * e.count, 0)) };
  const quick = own.at(-1)!.quick;
  if (quick?.type === 'meal') return { state: 'quick', size: quick.size, veggies: !!quick.veggies };
  return { state: 'skipped' };
}

/** Grignotages notés dans la journée. */
export function snackCount(entries: readonly FoodEntry[]): number {
  return entries.filter((e) => e.quick?.type === 'snack').length;
}

/** Des légumes ont-ils été cochés à un repas du jour ? (Le bilan du soir ne redemande pas.) */
export function veggiesNoted(entries: readonly FoodEntry[]): boolean {
  return entries.some((e) => e.quick?.type === 'meal' && e.quick.veggies === true);
}

/** Repas à mettre en avant à cette heure : celui du moment s'il n'est pas encore noté. */
export function currentQuickMeal(hour: number): Meal | null {
  if (hour >= 4 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 15) return 'noon';
  if (hour >= 18 || hour < 4) return 'evening';
  return null;
}

// ─── Repas habituels ───

/** Fenêtre (jours) et nombre de fois minimal pour qu'un repas soit « habituel ». */
export const HABIT_DAYS = 28;
export const HABIT_MIN_TIMES = 2;
export const HABIT_MAX = 3;

export interface HabitualMeal {
  /** Identité du repas : ses aliments, triés. */
  key: string;
  /** « Gnocchis à poêler + Thon entier » (libellés raccourcis). */
  label: string;
  times: number;
  total: Nutrients;
  /** Les lignes à recopier (celles de la fois la plus récente), sans jour ni identifiant. */
  entries: Omit<FoodEntry, 'id' | 'day' | 'at'>[];
}

/** « Gnocchi a poêler Lustucru - 1K » → « Gnocchi a poêler » (avant le tiret, 3 mots au plus). */
export function shortFoodLabel(label: string): string {
  const head = label.split(/\s[-–]\s/)[0]!.trim();
  const words = head.split(/\s+/);
  return words.length > 3 ? `${words.slice(0, 3).join(' ')}…` : head;
}

/**
 * Les repas notés en détail au moins HABIT_MIN_TIMES fois au même repas ces HABIT_DAYS derniers
 * jours (avant aujourd'hui compris), du plus fréquent au moins fréquent, puis du plus récent.
 * Un repas = l'ensemble des aliments notés ce jour-là à ce repas.
 */
export function habitualMeals(entries: readonly FoodEntry[], meal: Meal, today: string, max = HABIT_MAX): HabitualMeal[] {
  const from = addDays(today, -(HABIT_DAYS - 1));
  const byOccasion = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    if (e.meal !== meal || e.method === 'quick' || e.day < from || e.day > today) continue;
    const list = byOccasion.get(e.day) ?? [];
    list.push(e);
    byOccasion.set(e.day, list);
  }
  const groups = new Map<string, { times: number; last: string; occasion: FoodEntry[] }>();
  for (const [day, occasion] of byOccasion) {
    const key = [...new Set(occasion.map((e) => e.label))].sort().join('\n');
    const g = groups.get(key);
    if (!g) groups.set(key, { times: 1, last: day, occasion });
    else {
      g.times++;
      if (day > g.last) {
        g.last = day;
        g.occasion = occasion;
      }
    }
  }
  return [...groups.entries()]
    .filter(([, g]) => g.times >= HABIT_MIN_TIMES)
    .sort(([, a], [, b]) => b.times - a.times || daysBetween(a.last, b.last))
    .slice(0, max)
    .map(([key, g]) => ({
      key,
      label: [...new Set(g.occasion.map((e) => shortFoodLabel(e.label)))].join(' + '),
      times: g.times,
      total: {
        kcal: Math.round(g.occasion.reduce((s, e) => s + e.unit.kcal * e.count, 0)),
        protein: Math.round(g.occasion.reduce((s, e) => s + e.unit.protein * e.count, 0)),
      },
      entries: g.occasion.map(({ id: _id, day: _day, at: _at, ...rest }) => rest),
    }));
}
