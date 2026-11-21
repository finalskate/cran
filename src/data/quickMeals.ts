/**
 * « Noter vite » (21/11) — fichier de DONNÉES, éditable : libellés et repères chiffrés des
 * saisies rapides. Ordres de grandeur d'un adulte, volontairement ronds : l'ajustement de la
 * cible corrige un biais régulier, ce qui compte est de noter chaque repas.
 *
 * Repères (repas « normal », déjeuner ou dîner) :
 *  - fait maison : une assiette complète (féculent, viande ou poisson, légumes) ≈ 650 kcal ;
 *  - sandwich + boisson ou dessert léger ≈ 550 kcal ;
 *  - fast-food : menu (burger ou wrap, frites, boisson) ≈ 1 000 kcal ;
 *  - resto, cantine : plat + entrée ou dessert ≈ 800 kcal ;
 *  - fête, raclette, repas de famille : plusieurs services ≈ 1 300 kcal ;
 *  - sur le pouce (pas vraiment un repas) ≈ 450 kcal.
 */
import type { QuickKind, QuickSize, QuickTable, SnackSize, SnackTaste } from '../domain/quickMeal';

export const QUICK_TABLE: QuickTable = {
  base: {
    home: { kcal: 650, protein: 30 },
    sandwich: { kcal: 550, protein: 22 },
    fastfood: { kcal: 1000, protein: 35 },
    out: { kcal: 800, protein: 35 },
    party: { kcal: 1300, protein: 45 },
    onthego: { kcal: 450, protein: 15 },
  },
  size: { light: 0.7, normal: 1, big: 1.4 },
  breakfast: 0.6,
  snack: {
    small: { kcal: 150, protein: 3 },
    medium: { kcal: 300, protein: 5 },
    big: { kcal: 550, protein: 8 },
  },
  spread: 0.25,
};

export const QUICK_KIND_LABEL: Record<QuickKind, string> = {
  home: 'Fait maison',
  sandwich: 'Sandwich',
  fastfood: 'Fast-food',
  out: 'Resto, cantine',
  party: 'Fête, raclette',
  onthego: 'Sur le pouce',
};

export const QUICK_SIZE_LABEL: Record<QuickSize, string> = {
  light: 'Léger',
  normal: 'Normal',
  big: 'Copieux',
};

export const SNACK_SIZE_LABEL: Record<SnackSize, string> = {
  small: 'Petit',
  medium: 'Moyen',
  big: 'Gros',
};

export const SNACK_TASTE_LABEL: Record<SnackTaste, string> = {
  sweet: 'Sucré',
  salty: 'Salé',
  drink: 'Boisson',
};

/** Titre du panneau selon le repas. */
export const QUICK_MEAL_TITLE = {
  morning: 'Le petit-déj',
  noon: 'Le déjeuner',
  snack: 'La collation',
  evening: 'Le dîner',
} as const;

/** Libellé court du bouton de l'accueil. */
export const QUICK_MEAL_BUTTON = {
  morning: 'Petit-déj',
  noon: 'Midi',
  snack: 'Collation',
  evening: 'Soir',
} as const;
