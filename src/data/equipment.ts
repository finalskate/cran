/**
 * Libellés du matériel et lieux préconfigurés (SPEC §4.2). Fichier de DONNÉES.
 * Les lieux ne sont que des valeurs de départ : l'utilisateur les modifie dans l'appli.
 */
import type { EquipmentTag, Location, SpaceSize } from '../domain/types';

/** Ordre d'affichage et libellés du matériel. */
export const EQUIPMENT: { tag: EquipmentTag; label: string; hint?: string }[] = [
  { tag: 'pushup-handles', label: 'Poignées de pompes' },
  { tag: 'straps', label: 'Sangles de suspension' },
  { tag: 'anchor', label: 'Ancrage de porte', hint: 'Ou poteau, arbre : les sangles restent collées au support' },
  { tag: 'pullup-bar', label: 'Barre de traction', hint: 'Ou poutre : ancrage dégagé, les sangles pendent librement (dips)' },
  { tag: 'dip-bars', label: 'Barres parallèles', hint: 'Ou double poutre : pour les dips' },
  { tag: 'bands', label: 'Élastiques longs' },
  { tag: 'mini-bands', label: 'Mini-bandes de hanche' },
  { tag: 'table', label: 'Table solide', hint: 'Pour le rowing inversé : vérifie qu’elle ne bascule pas' },
  { tag: 'bench', label: 'Banc, chaise ou canapé' },
  { tag: 'step', label: 'Marche ou escalier' },
  { tag: 'wall', label: 'Mur dégagé' },
  { tag: 'backpack', label: 'Sac à dos lestable' },
  { tag: 'bike', label: 'Vélo' },
];

/**
 * Consignes d'installation affichées dans la fiche quand une variante utilise ce matériel.
 * (Ancrage de porte à mors : la porte se ferme sur l'ancrage et reste tenue par la tension.)
 */
export const SETUP_NOTES: Partial<Record<EquipmentTag, string>> = {
  straps:
    'Ancrage de porte : porte fermée sur l’ancrage. Place-toi du côté où elle s’ouvre en poussant : en tirant, tu la plaques contre son cadre au lieu de l’ouvrir.',
};

export const SPACES: { value: SpaceSize; label: string }[] = [
  { value: 'small', label: 'Petit (~2 m², de quoi s’allonger)' },
  { value: 'medium', label: 'Moyen (bras et jambes écartés)' },
  { value: 'large', label: 'Grand (recul ≥ 1,5 m)' },
];

/** Lieux créés au premier lancement. */
export const DEFAULT_LOCATIONS: Location[] = [
  {
    id: 'home',
    name: 'Maison',
    equipment: ['pushup-handles', 'straps', 'anchor', 'bands', 'mini-bands', 'table', 'bench', 'step', 'wall', 'backpack'],
    space: 'large',
    order: 0,
  },
  {
    id: 'work',
    name: 'Travail',
    equipment: ['pullup-bar', 'bench', 'step', 'wall'],
    space: 'large',
    order: 1,
  },
  {
    id: 'park',
    name: 'Parc',
    equipment: ['pullup-bar', 'dip-bars', 'bench', 'step', 'wall'],
    space: 'large',
    order: 2,
  },
  {
    id: 'small',
    name: 'Petit espace',
    equipment: ['wall'],
    space: 'small',
    order: 3,
  },
  {
    id: 'away',
    name: 'Éloigné',
    equipment: ['straps', 'pullup-bar', 'bands', 'mini-bands', 'wall', 'backpack', 'bike'],
    space: 'small',
    order: 4,
  },
  {
    id: 'equipped',
    name: 'Base équipée',
    equipment: ['pullup-bar', 'dip-bars', 'straps', 'bands', 'mini-bands', 'bench', 'step', 'wall', 'backpack', 'bike'],
    space: 'large',
    order: 5,
  },
];
