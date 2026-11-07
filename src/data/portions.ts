/**
 * Repères de la main pour estimer une assiette sans balance (SPEC §4.8) : cantine, restaurant,
 * plat du cuisinier. Donnée éditable : ajuster une valeur ne demande pas de toucher au code.
 *
 * Les valeurs sont des moyennes volontairement simples (une main d'adulte, plat cuisiné
 * « normal »). L'imprécision n'est pas grave : une erreur constante est absorbée par
 * l'ajustement adaptatif (SPEC §4.8), ce qui compte est d'estimer toujours de la même façon.
 */
import type { HandMeasure } from '../domain/nutrition';

/** Les quatre repères de l'assiette. */
export const HAND_MEASURES: readonly HandMeasure[] = [
  {
    id: 'protein',
    label: 'Protéines',
    hand: 'paume',
    hands: 'paumes',
    examples: 'viande, poisson, œufs, tofu (taille et épaisseur de la paume)',
    kcal: 150,
    protein: 25,
  },
  {
    id: 'starch',
    label: 'Féculents',
    hand: 'poing',
    hands: 'poings',
    examples: 'pâtes, riz, pommes de terre, semoule (cuits)',
    kcal: 200,
    protein: 6,
  },
  {
    id: 'veg',
    label: 'Légumes',
    hand: 'main en coupe',
    hands: 'mains en coupe',
    examples: 'crus ou cuits, crudités, soupe',
    kcal: 30,
    protein: 2,
  },
  {
    id: 'fat',
    label: 'Matières grasses',
    hand: 'pouce',
    hands: 'pouces',
    examples: 'huile, beurre, sauce, fromage râpé',
    kcal: 100,
    protein: 1,
  },
];

/** À côté de l'assiette : ce qu'on ajoute souvent à un plateau de cantine. */
export const PLATE_EXTRAS: readonly HandMeasure[] = [
  { id: 'bread', label: 'Pain', hand: 'morceau de pain', hands: 'morceaux de pain', examples: '', kcal: 80, protein: 3 },
  { id: 'cheese', label: 'Fromage', hand: 'portion de fromage', hands: 'portions de fromage', examples: '', kcal: 110, protein: 7 },
  { id: 'fruit', label: 'Fruit', hand: 'fruit', hands: 'fruits', examples: '', kcal: 70, protein: 1 },
  { id: 'yogurt', label: 'Yaourt, laitage', hand: 'laitage', hands: 'laitages', examples: '', kcal: 90, protein: 5 },
  { id: 'dessert', label: 'Dessert sucré', hand: 'dessert', hands: 'desserts', examples: '', kcal: 300, protein: 4 },
];

/** Assiette proposée au départ : une mesure de chaque, à ajuster en quelques gestes. */
export const DEFAULT_PLATE: Readonly<Record<string, number>> = { protein: 1, starch: 1, veg: 1, fat: 1 };
