/**
 * Idées de protéines (J3b) — fichier de DONNÉES, éditable. Des aliments simples, riches en
 * protéines pour peu de kcal, sans cuisine ou presque, avec une portion courante.
 *
 * Les valeurs ne sont PAS recopiées ici : chaque idée renvoie à un aliment de la table Ciqual
 * embarquée (code), et la portion est en grammes (ou ml). Les kcal et protéines affichées sont
 * donc calculées depuis Ciqual, comme pour une recherche dans « Ajouter ».
 *
 * L'ordre n'a pas d'importance : l'écran trie par protéines pour 100 kcal.
 */
export interface ProteinIdea {
  /** Code Ciqual de l'aliment. */
  code: number;
  /** Nom court affiché (le nom Ciqual est souvent long). */
  label: string;
  /** Portion courante. */
  portion: { label: string; amount: number };
  /** Petit conseil pratique (conservation, préparation). */
  tip?: string;
}

export const PROTEIN_IDEAS: readonly ProteinIdea[] = [
  { code: 36018, label: 'Filet de poulet grillé', portion: { label: '1 filet', amount: 120 }, tip: 'Se cuit d’avance pour 2–3 jours.' },
  { code: 26039, label: 'Thon au naturel', portion: { label: '1 petite boîte, égouttée', amount: 100 }, tip: 'Se garde au placard, se mange froid.' },
  { code: 28900, label: 'Jambon blanc', portion: { label: '2 tranches', amount: 80 } },
  { code: 19644, label: 'Fromage blanc 0 %', portion: { label: '1 bol', amount: 200 } },
  { code: 19724, label: 'Skyr ou yaourt protéiné nature', portion: { label: '1 pot', amount: 150 }, tip: 'Remplace un dessert ou un gâteau.' },
  { code: 10007, label: 'Crevettes cuites', portion: { label: '1 barquette', amount: 150 } },
  { code: 6251, label: 'Steak haché 5 %', portion: { label: '1 steak cuit', amount: 100 } },
  { code: 22010, label: 'Œufs durs', portion: { label: '2 œufs', amount: 100 }, tip: 'Une semaine au frigo dans leur coquille : cuis-en 6 d’un coup.' },
  { code: 26034, label: 'Sardines à l’huile', portion: { label: '1 boîte, égouttée', amount: 85 } },
  { code: 20587, label: 'Lentilles cuites', portion: { label: '1 assiette', amount: 200 } },
  { code: 19041, label: 'Lait demi-écrémé', portion: { label: '1 grand verre', amount: 250 } },
  { code: 12115, label: 'Emmental', portion: { label: '1 portion', amount: 30 } },
];
