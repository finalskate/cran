/**
 * Table Ciqual embarquée (ANSES, licence ouverte Etalab 2.0) : ~3 300 aliments génériques,
 * plats composés et produits de restauration rapide compris, consultables HORS LIGNE dans
 * « Ajouter » (SPEC §4.8). Le fichier `ciqual.json` est produit par `scripts/build-ciqual.mjs`.
 *
 * Il n'est chargé qu'à la première recherche (module à part, ≈ 60 Ko compressés), mais il est
 * précaché par le service worker comme le reste de l'appli : disponible en mode avion.
 *
 * Un aliment Ciqual n'entre dans la base locale (`foods`) que lorsqu'on le note : il rejoint
 * alors les récents, et peut devenir favori.
 */
import { matchScore, normalize, searchWords, type Food, type Portion } from '../domain/nutrition';
import { LIQUID_GROUPS, PORTION_RULES, type PortionRule } from './ciqualPortions';
import { COOKED_FORM, RAW_FORM, RAW_GROUPS } from './phraseWords';

/**
 * Quand on préfère le cuit : recul d'un aliment cru, avance d'un aliment cuit (pour comparaison,
 * un mot trouvé en début de mot vaut 3) ; « riz » donne le riz cuit plutôt que le riz cantonais.
 */
const RAW_PENALTY = 3;
const COOKED_BONUS = 2;

/** Une ligne de la table : [code, nom, sous-groupe, kcal/100 g, protéines g/100 g]. */
export type CiqualRow = readonly [code: number, name: string, group: string, kcal: number, protein: number];

export interface CiqualIndex {
  rows: readonly CiqualRow[];
  /** Noms normalisés, dans le même ordre (calculés une fois au chargement). */
  hay: readonly string[];
}

export function ciqualFoodId(code: number): string {
  return `ciqual:${code}`;
}

/** Prépare l'index de recherche d'une liste de lignes. */
export function buildIndex(rows: readonly CiqualRow[]): CiqualIndex {
  return { rows, hay: rows.map((r) => normalize(r[1])) };
}

let loading: Promise<CiqualIndex> | undefined;

/** Charge la table (une seule fois par lancement). */
export function loadCiqual(): Promise<CiqualIndex> {
  loading ??= import('./ciqual.json').then((m) => buildIndex(m.default.foods as unknown as CiqualRow[]));
  return loading;
}

/**
 * Les « aliment moyen » / « sans précision » sont la bonne réponse quand on ne sait pas
 * exactement ce qu'on a mangé : à pertinence égale, ils passent devant.
 */
const GENERIC = /aliment moyen|sans precision/;

/**
 * Meilleurs résultats pour une recherche (rien si la recherche est vide).
 * `preferCooked` (saisie en une phrase, J5b) : dans les sous-groupes où cru / cuit change tout,
 * la version cuite passe devant, sauf si la recherche dit « cru » ou « sec » (src/data/phraseWords.ts).
 */
export function searchCiqual(index: CiqualIndex, query: string, limit = 25, opts: { preferCooked?: boolean } = {}): CiqualRow[] {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const penalizeRaw = opts.preferCooked && !RAW_FORM.test(normalize(query));
  const scored: { row: CiqualRow; score: number }[] = [];
  index.rows.forEach((row, i) => {
    const hay = index.hay[i]!;
    const s = matchScore(hay, words);
    if (s <= 0) return;
    // « Pâtes sèches, cuites » est cuit : le mot « cuit » l'emporte sur « sec ».
    const cooking = penalizeRaw && RAW_GROUPS.includes(row[2]) ? (COOKED_FORM.test(hay) ? COOKED_BONUS : RAW_FORM.test(hay) ? -RAW_PENALTY : 0) : 0;
    scored.push({ row, score: s + (GENERIC.test(hay) ? 1 : 0) + cooking });
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.row);
}

/** Règle de portion qui s'applique à un aliment (la première qui correspond). */
function ruleFor(name: string, group: string, rules: readonly PortionRule[]): PortionRule | undefined {
  const hay = normalize(name);
  return rules.find((r) => (!r.groups || r.groups.includes(group)) && (!r.match || r.match.test(hay)));
}

/** Portions proposées pour un aliment Ciqual : portions types de sa catégorie, puis 100 g (ou ml). */
export function ciqualPortions(name: string, group: string, rules: readonly PortionRule[] = PORTION_RULES): Portion[] {
  const unit = LIQUID_GROUPS.includes(group) ? 'ml' : 'g';
  return [...(ruleFor(name, group, rules)?.portions ?? []), { label: `100 ${unit}`, amount: 100 }];
}

/** Aliment local correspondant à une ligne Ciqual. */
export function ciqualToFood(row: CiqualRow, now: string): Food {
  const [code, name, group, kcal, protein] = row;
  return {
    id: ciqualFoodId(code),
    source: 'ciqual',
    name,
    per100: { kcal, protein },
    unit: LIQUID_GROUPS.includes(group) ? 'ml' : 'g',
    portions: ciqualPortions(name, group),
    uses: 0,
    createdAt: now,
  };
}
