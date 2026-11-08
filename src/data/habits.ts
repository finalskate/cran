/**
 * Habitudes alimentaires (J4B) — fichier de DONNÉES, éditable : libellés des déclencheurs et
 * plans « si… alors… » proposés au départ (SPEC §4.8). L'utilisateur les modifie dans l'appli
 * (Assiette → « Mes plans ») ; ses versions sont stockées dans le réglage `plans`.
 *
 * Confidentialité : ces plans de départ restent génériques (dépôt public). Les détails
 * personnels (qui achète les gâteaux, où on lit…) se saisissent dans l'appli.
 */
import type { IfThenPlan, Trigger } from '../domain/habits';

/** Libellés courts (puces du bilan, résumé de la semaine). */
export const TRIGGER_LABEL: Record<Trigger, string> = {
  boredom: 'Ennui, lecture',
  'post-ride': 'Faim après le vélo',
  evening: 'Soirée',
  social: 'Repas, sortie',
  stress: 'Stress, fatigue',
  cooking: 'En cuisinant, restes',
  other: 'Autre',
};

/** Plans proposés tant que l'utilisateur n'a rien modifié. */
export const DEFAULT_PLANS: readonly IfThenPlan[] = [
  { id: 'boredom-read', trigger: 'boredom', when: 'je m’installe pour lire ou je m’ennuie', then: 'tisane, ou un en-cas déjà servi dans un bol : jamais le paquet' },
  { id: 'boredom-cakes', trigger: 'boredom', when: 'des gâteaux traînent à la maison', then: 'boîte opaque, rangée hors de vue' },
  { id: 'post-ride', trigger: 'post-ride', when: 'je rentre du vélo affamé', then: 'la collation prévue (skyr + fruit) avant d’ouvrir les placards' },
  { id: 'evening', trigger: 'evening', when: 'le dîner est fini', then: 'cuisine fermée, dents brossées' },
  { id: 'social', trigger: 'social', when: 'repas ou apéro avec d’autres', then: 'je me sers une fois, protéines et légumes d’abord' },
  { id: 'stress', trigger: 'stress', when: 'journée dure ou fatigue', then: 'un grand verre d’eau, puis une collation protéinée prévue, assis, dans une assiette' },
  { id: 'cooking', trigger: 'cooking', when: 'je cuisine ou il reste des restes', then: 'je goûte une fois à la cuillère ; les restes vont directement en boîte au frigo' },
];
