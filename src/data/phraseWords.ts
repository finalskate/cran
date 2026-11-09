/**
 * Vocabulaire de la saisie en une phrase (J5b) : « wrap poulet + petite frite + coca zéro ».
 * Fichier de DONNÉES, passé à src/domain/phrase.ts (découpage, quantités) et utilisé par
 * src/data/phraseMatch.ts (correspondance avec mes aliments et la table Ciqual). Tout est écrit
 * SANS accents ni majuscules : la phrase est normalisée avant d'être lue.
 */
import type { PhraseVocabulary } from '../domain/phrase';

/** Séparateurs entre deux aliments (en plus de « + », « , », « ; » et du retour à la ligne). */
export const PHRASE_SEPARATORS: readonly string[] = ['et', 'puis', 'plus'];

/** Nombres écrits en toutes lettres, en tête d'aliment. */
export const NUMBER_WORDS: Readonly<Record<string, number>> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  demi: 0.5,
  demie: 0.5,
  moitie: 0.5,
  quart: 0.25,
  quarts: 0.25,
};

/** Tailles : choisissent la portion dont le libellé contient le mot (« Petite frite »). */
export const SIZE_WORDS: PhraseVocabulary['sizes'] = {
  petit: 'small',
  petite: 'small',
  petits: 'small',
  petites: 'small',
  moyen: 'medium',
  moyenne: 'medium',
  moyens: 'medium',
  moyennes: 'medium',
  grand: 'large',
  grande: 'large',
  grands: 'large',
  grandes: 'large',
  gros: 'large',
  grosse: 'large',
  grosses: 'large',
};

/** Comment repérer une taille dans le libellé d'une portion. */
export const SIZE_IN_LABEL: PhraseVocabulary['sizeInLabel'] = {
  small: /petit/,
  medium: /moyen/,
  large: /grand|gros/,
};

/**
 * Contenants et morceaux : « 2 tranches de jambon » choisit la portion « 1 tranche ». Le mot est
 * cherché (au singulier) dans le libellé des portions de l'aliment. Il n'est retiré de la
 * recherche que s'il est suivi de « de » (« une part de tarte », mais « une pizza » reste une pizza).
 */
export const PORTION_WORDS: readonly string[] = [
  'assiette',
  'bol',
  'barquette',
  'part',
  'tranche',
  'morceau',
  'piece',
  'portion',
  'verre',
  'tasse',
  'mug',
  'canette',
  'bouteille',
  'gobelet',
  'pot',
  'cuillere',
  'poignee',
  'paquet',
  'sachet',
  'barre',
  'carre',
  'boule',
];

/** Mots de liaison retirés en tête d'aliment (« 2 tranches DE jambon »). */
export const LEADING_FILLERS: readonly string[] = ['de', 'd', 'du', 'des', 'la', 'le', 'les', 'l'];

/**
 * Noms courants → noms de la table Ciqual. Appliqués dans l'ordre (le plus précis d'abord).
 */
export const PHRASE_SYNONYMS: readonly (readonly [RegExp, string])[] = [
  [/\bcoca(?:[ -]cola)? (?:zero|light)\b/, 'cola sans sucres ajoutes'],
  [/\bcoca(?:[ -]cola)?\b/, 'cola sucre'],
  [/\bsteak\b(?! hache)/, 'steak hache'],
  [/\bexpresso\b|\bespresso\b/, 'cafe expresso'],
];

/**
 * Aliments de la table qu'on mange rarement tels quels (crus, secs, en poudre) : à pertinence
 * égale, la version cuite passe devant, sauf si la phrase dit « cru » ou « sec ». Seulement dans
 * les sous-groupes où cru / cuit change tout : féculents, viandes crues, pommes de terre (pas les
 * œufs : « Oeuf cru » est l'œuf entier, « Oeuf, blanc, cuit » n'en est qu'une partie).
 */
export const RAW_FORM = /\bcrue?s?\b|non cuit|\bseche?s?\b|en poudre|a cuire/;
/** Mention « cuit » dans le nom : l'emporte sur « sec » (« Pâtes sèches, cuites »). */
export const COOKED_FORM = /\bcuite?s?\b/;
export const RAW_GROUPS: readonly string[] = ['0301', '0402', '0202'];

/** Tout le vocabulaire, tel que la lecture de la phrase l'attend. */
export const PHRASE_VOCABULARY: PhraseVocabulary = {
  separators: PHRASE_SEPARATORS,
  numbers: NUMBER_WORDS,
  sizes: SIZE_WORDS,
  sizeInLabel: SIZE_IN_LABEL,
  portionWords: PORTION_WORDS,
  fillers: LEADING_FILLERS,
  synonyms: PHRASE_SYNONYMS,
};
