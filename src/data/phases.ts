/**
 * Les phases (SPEC §1.3) et ce qu'elles changent par défaut. Fichier de DONNÉES : on peut
 * changer un libellé, un lieu proposé ou un objectif sans toucher à la logique (src/domain/phase.ts).
 * Les lieux sont désignés par leur identifiant (src/data/equipment.ts).
 *
 * Aucune date ici : le changement de phase se fait dans l'appli (Réglages → Phase).
 */
import type { PhaseId, PhaseInfo } from '../domain/phase';

export const PHASES: Record<PhaseId, PhaseInfo> = {
  holidays: {
    label: 'Vacances',
    description: 'Du temps, la maison et le parc : on installe les habitudes et on calibre l’assiette.',
    locationId: 'home',
    weekGoal: { strength: 3, cardio: 2 },
    cardio: 'run',
    indoorOnly: false,
    cantine: false,
  },
  work: {
    label: 'Travail',
    description: 'Le rythme habituel : une séance quand un créneau se présente, progression régulière.',
    locationId: 'work',
    weekGoal: { strength: 3, cardio: 2 },
    cardio: 'run',
    indoorOnly: false,
    cantine: false,
  },
  away: {
    label: 'Éloigné',
    description: 'Loin de chez soi : peu de place, vélo d’appartement, repas à la cantine. On entretient sans s’épuiser.',
    locationId: 'away',
    // Entretien léger (SPEC §1.3) : des micro-séances de 10 min comptent.
    weekGoal: { strength: 2, cardio: 2 },
    cardio: 'bike',
    indoorOnly: true,
    cantine: true,
  },
  equipped: {
    label: 'Base équipée',
    description: 'Plus de matériel : reprise en douceur, puis progression.',
    locationId: 'equipped',
    weekGoal: { strength: 3, cardio: 2 },
    cardio: 'run',
    indoorOnly: false,
    cantine: false,
  },
};

/**
 * Assiette de cantine (SPEC §4.8, mode cantine) : la règle à appliquer au plateau, et quelques
 * repères. Parts en fraction de l'assiette (le dessert est à côté).
 */
export const CANTINE_PLATE = {
  parts: [
    { key: 'veg', label: 'Légumes', share: 0.5 },
    { key: 'protein', label: 'Protéines', share: 0.25 },
    { key: 'starch', label: 'Féculents', share: 0.25 },
  ],
  dessert: 'Un fruit en dessert',
  tips: [
    'Commence par les légumes et la viande ou le poisson.',
    'Une seule portion de féculents, pas de pain en plus si le plat en a déjà.',
    'Sauce à part quand c’est possible.',
    'Un laitage nature si tu as encore faim : ça fait des protéines en plus.',
  ],
} as const;
