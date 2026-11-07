/**
 * Alimentation, phase A « calibration » (SPEC §4.8) : profil, cible calorique et protéines,
 * aliments et portions, journal du jour, pesée. Fonctions pures, testées dans nutrition.test.ts.
 *
 * Rien n'est codé en dur pour une personne : le profil se saisit dans l'appli et reste sur le
 * téléphone. Les constantes ci-dessous sont des règles générales.
 */
import { addDays, dayKey, daysBetween } from './days';

// ─── Profil et cible ───

export type Sex = 'male' | 'female';

/** Niveau d'activité de la vie courante (hors précision : l'ajustement adaptatif corrigera). */
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very-active';

export interface Profile {
  sex: Sex;
  /** L'année suffit : un an d'écart sur l'âge change le métabolisme de base de 5 kcal. */
  birthYear: number;
  heightCm: number;
  /** Poids de départ, utilisé tant qu'il n'y a aucune pesée. */
  weightKg: number;
  activity: ActivityLevel;
}

/**
 * Facteurs d'activité appliqués au métabolisme de base. Les facteurs « classiques » (1,55 pour
 * « modérément actif ») surestiment souvent la dépense d'un travail assis : on prend des valeurs
 * un peu plus prudentes. L'ajustement adaptatif (après 2 semaines) remplace de toute façon
 * cette estimation par la dépense réellement observée.
 */
export const ACTIVITY: Record<ActivityLevel, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: 'Peu actif', hint: 'Assis toute la journée, peu ou pas de sport' },
  light: { factor: 1.375, label: 'Un peu actif', hint: 'Assis surtout, sport 1 à 2 fois par semaine' },
  active: { factor: 1.5, label: 'Actif', hint: 'Assis surtout, mais sport 3 à 5 fois par semaine ou vélo au quotidien' },
  'very-active': { factor: 1.7, label: 'Très actif', hint: 'Métier physique, ou sport presque tous les jours' },
};

/** Déficit visé sous la dépense estimée : environ 0,4 à 0,5 kg par semaine. */
export const DEFICIT_KCAL = 450;

/** Plancher de cible par sexe : en dessous, la perte se fait au détriment du muscle. */
export const KCAL_FLOOR: Record<Sex, number> = { male: 1700, female: 1400 };

/** Protéines visées par kilo de poids de corps (préserver le muscle pendant le déficit). */
export const PROTEIN_PER_KG = 1.7;

/** Durée de la phase de calibration (SPEC §4.8 phase A). */
export const CALIBRATION_DAYS = 14;

/** Métabolisme de base, formule de Mifflin-St Jeor (kcal/jour). */
export function basalMetabolism(profile: Profile, weightKg: number, year: number): number {
  const age = year - profile.birthYear;
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * age;
  return base + (profile.sex === 'male' ? 5 : -161);
}

export interface Targets {
  /** Métabolisme de base (kcal). */
  bmr: number;
  /** Dépense estimée = métabolisme × facteur d'activité (kcal). */
  expenditure: number;
  /** Cible calorique du jour (kcal), arrondie à la dizaine. */
  kcal: number;
  /** Vrai si le plancher a relevé la cible. */
  floored: boolean;
  /** Cible de protéines (g). */
  protein: number;
  /** Poids utilisé pour le calcul (dernière pesée, sinon poids du profil). */
  weightKg: number;
}

export function computeTargets(profile: Profile, weightKg: number, year: number): Targets {
  const bmr = Math.round(basalMetabolism(profile, weightKg, year));
  const expenditure = Math.round(bmr * ACTIVITY[profile.activity].factor);
  const raw = Math.round((expenditure - DEFICIT_KCAL) / 10) * 10;
  const floor = KCAL_FLOOR[profile.sex];
  return {
    bmr,
    expenditure,
    kcal: Math.max(raw, floor),
    floored: raw < floor,
    protein: Math.round(PROTEIN_PER_KG * weightKg),
    weightKg,
  };
}

/** Jour de calibration (1 = premier jour), ou `null` une fois la calibration terminée. */
export function calibrationDay(start: string, today: string): number | null {
  const n = daysBetween(start, today) + 1;
  return n >= 1 && n <= CALIBRATION_DAYS ? n : null;
}

// ─── Journée alimentaire et repas ───

/**
 * Heure à laquelle commence la journée alimentaire. Une collation à 1 h du matin appartient
 * encore à la soirée de la veille : c'est ainsi qu'on la vit, et le bilan du jour reste juste.
 */
export const FOOD_DAY_START_HOUR = 4;

/** Jour alimentaire d'un instant (voir FOOD_DAY_START_HOUR). */
export function foodDay(at: Date): string {
  return dayKey(new Date(at.getTime() - FOOD_DAY_START_HOUR * 3600_000));
}

export type Meal = 'morning' | 'noon' | 'snack' | 'evening';

export const MEALS: readonly Meal[] = ['morning', 'noon', 'snack', 'evening'];

/** Repas proposé par défaut selon l'heure (modifiable à la saisie). */
export function mealForTime(at: Date): Meal {
  const h = at.getHours() + at.getMinutes() / 60;
  if (h >= FOOD_DAY_START_HOUR && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'noon';
  if (h >= 15 && h < 18.5) return 'snack';
  return 'evening';
}

// ─── Aliments et portions ───

/** Valeurs nutritionnelles suivies : on ne compte que l'énergie et les protéines. */
export interface Nutrients {
  kcal: number;
  protein: number;
}

/**
 * Une portion proposée pour un aliment : soit une quantité (g ou ml, l'aliment ayant des
 * valeurs pour 100), soit des valeurs directes (plat estimé, repas type).
 */
export interface Portion {
  label: string;
  amount?: number;
  kcal?: number;
  protein?: number;
}

/**
 * Provenance d'un aliment :
 *  - off     fiche Open Food Facts (scan)
 *  - label   saisi à la main depuis l'étiquette (produit inconnu ou scan hors ligne)
 *  - custom  aliment ou plat perso, valeurs par portion
 *  - combo   repas type enregistré à partir de plusieurs entrées
 */
export type FoodSource = 'off' | 'label' | 'custom' | 'combo';

export interface Food {
  /** « ean:3017620422003 » pour un produit à code-barres, « perso:… » sinon. */
  id: string;
  source: FoodSource;
  name: string;
  brand?: string;
  barcode?: string;
  /** Valeurs pour 100 g (ou 100 ml). Absentes pour un aliment décrit seulement par portion. */
  per100?: Nutrients;
  unit?: 'g' | 'ml';
  portions: Portion[];
  favorite?: boolean;
  /** Nombre d'utilisations et dernière utilisation : servent au tri des « récents ». */
  uses: number;
  lastUsedAt?: string;
  createdAt: string;
}

/**
 * Valeurs d'UNE portion d'un aliment (0 si l'aliment ne permet pas de les calculer), au dixième :
 * c'est ce qui est copié dans l'entrée, puis multiplié par le nombre de portions.
 */
export function portionNutrients(food: Food, portion: Portion): Nutrients {
  const tenth = (n: number) => Math.round(n * 10) / 10;
  if (portion.kcal !== undefined) return { kcal: portion.kcal, protein: portion.protein ?? 0 };
  if (portion.amount !== undefined && food.per100) {
    const k = portion.amount / 100;
    return { kcal: tenth(food.per100.kcal * k), protein: tenth(food.per100.protein * k) };
  }
  return { kcal: 0, protein: 0 };
}

/** Portion « libre » en grammes (ou ml) pour un aliment qui a des valeurs pour 100. */
export function amountPortion(food: Food, amount: number): Portion {
  return { label: `${formatAmount(amount)} ${food.unit ?? 'g'}`, amount };
}

/** « 37,5 » → « 37,5 » ; « 150 » → « 150 » (virgule française, une décimale au plus). */
export function formatAmount(n: number): string {
  return (Math.round(n * 10) / 10).toLocaleString('fr-FR');
}

// ─── Entrées du journal ───

/** Comment l'entrée a été saisie (pour le journal d'usage et, plus tard, les statistiques). */
export type EntryMethod = 'scan' | 'list' | 'hands' | 'free';

/**
 * Une ligne du journal alimentaire. Les valeurs sont COPIÉES au moment de la saisie : modifier
 * ou supprimer l'aliment ensuite ne réécrit pas l'historique.
 */
export interface FoodEntry {
  id?: number;
  /** Jour alimentaire (voir foodDay). */
  day: string;
  /** Instant de la saisie (ISO). */
  at: string;
  meal: Meal;
  foodId?: string;
  label: string;
  /** Portion choisie, en clair : « ½ paquet (75 g) ». */
  portion: string;
  /** Nombre de portions (pas de ½). */
  count: number;
  /** Valeurs d'une portion : permettent de changer `count` après coup. */
  unit: Nutrients;
  method: EntryMethod;
}

/** Valeurs d'une entrée (portion × nombre), arrondies à l'unité. */
export function entryNutrients(entry: Pick<FoodEntry, 'unit' | 'count'>): Nutrients {
  return { kcal: Math.round(entry.unit.kcal * entry.count), protein: Math.round(entry.unit.protein * entry.count) };
}

/** Total d'une liste d'entrées (somme des valeurs arrondies, comme à l'écran). */
export function sumEntries(entries: readonly Pick<FoodEntry, 'unit' | 'count'>[]): Nutrients {
  return entries.reduce(
    (acc, e) => {
      const n = entryNutrients(e);
      return { kcal: acc.kcal + n.kcal, protein: acc.protein + n.protein };
    },
    { kcal: 0, protein: 0 },
  );
}

/** Pas du sélecteur de quantité, et ses bornes. */
export const COUNT_STEP = 0.5;
export const COUNT_MAX = 20;

/** Change le nombre de portions d'un pas, sans descendre sous ½. */
export function stepCount(count: number, direction: 1 | -1): number {
  const next = Math.round((count + direction * COUNT_STEP) * 2) / 2;
  return Math.min(COUNT_MAX, Math.max(COUNT_STEP, next));
}

/** « ½ », « 1 », « 1 ½ », « 2 »… */
export function formatCount(count: number): string {
  const whole = Math.floor(count);
  const half = count - whole >= 0.5;
  if (whole === 0) return half ? '½' : '0';
  return half ? `${whole} ½` : String(whole);
}

// ─── Estimation à la main (SPEC §4.8 : repères de la main) ───

/** Une « mesure » de l'assiette : paume de protéines, poing de féculents… ou un extra. */
export interface HandMeasure {
  id: string;
  label: string;
  /** Repère visuel, au singulier et au pluriel : « paume » / « paumes »… */
  hand: string;
  hands: string;
  examples: string;
  kcal: number;
  protein: number;
}

/** Valeurs d'une assiette décrite par mesures (compte par identifiant de mesure). */
export function handEstimate(counts: Readonly<Record<string, number>>, measures: readonly HandMeasure[]): Nutrients {
  let kcal = 0;
  let protein = 0;
  for (const m of measures) {
    const n = counts[m.id] ?? 0;
    kcal += n * m.kcal;
    protein += n * m.protein;
  }
  return { kcal: Math.round(kcal), protein: Math.round(protein) };
}

/** Description courte d'une assiette estimée : « 2 paumes · 1 poing · 1 pouce ». */
export function describeHands(counts: Readonly<Record<string, number>>, measures: readonly HandMeasure[]): string {
  return measures
    .filter((m) => (counts[m.id] ?? 0) > 0)
    .map((m) => {
      const n = counts[m.id]!;
      return `${formatCount(n)} ${n > 1 ? m.hands : m.hand}`;
    })
    .join(' · ');
}

// ─── Récents et favoris ───

/** Aliments à proposer en premier : favoris, puis les plus récemment utilisés. */
export function rankFoods(foods: readonly Food[]): Food[] {
  return [...foods].sort((a, b) => {
    if (!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
    return (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt);
  });
}

/** Texte sans accents ni majuscules, pour la recherche (« Pâtes » trouve « pates »). */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Aliments dont le nom (ou la marque) contient tous les mots de la recherche. */
export function searchFoods(foods: readonly Food[], query: string): Food[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return rankFoods(foods);
  return rankFoods(foods.filter((f) => {
    const hay = normalize(`${f.name} ${f.brand ?? ''}`);
    return words.every((w) => hay.includes(w));
  }));
}

// ─── Pesée ───

/** Une pesée : une par jour (la dernière de la journée remplace les précédentes). */
export interface WeightEntry {
  day: string;
  at: string;
  kg: number;
}

/** Dernière pesée (par jour), ou `undefined`. */
export function latestWeight(weights: readonly WeightEntry[]): WeightEntry | undefined {
  let last: WeightEntry | undefined;
  for (const w of weights) if (!last || w.day > last.day) last = w;
  return last;
}

/** Nombre de pesées sur les 7 derniers jours (aujourd'hui compris). */
export function weighInsLastWeek(weights: readonly WeightEntry[], today: string): number {
  const from = addDays(today, -6);
  return weights.filter((w) => w.day >= from && w.day <= today).length;
}

/** Bornes de saisie d'un poids (évite une faute de frappe à 7,4 ou 740 kg). */
export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 250;

/** Arrondi d'affichage et de stockage d'un poids : 100 g. */
export function roundWeight(kg: number): number {
  return Math.round(kg * 10) / 10;
}
