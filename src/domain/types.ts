/**
 * Types du domaine : catalogue d'exercices, lieux, plan de séance.
 * Aucune dépendance au navigateur ni à la base : ces types sont partagés par la logique pure et l'UI.
 */
import type { SessionFeel } from './history';

// ─── Matériel et lieux ───

/**
 * Matériel qu'un lieu peut offrir. La liste (et les libellés) est dans src/data/equipment.ts.
 * Ajouter un tag ici, puis son libellé là-bas.
 */
export type EquipmentTag =
  | 'table' // table solide (rowing inversé)
  | 'straps' // sangles de suspension
  | 'anchor' // point d'ancrage réglable : porte, poteau, arbre (sangles, élastiques)
  | 'bands' // élastiques longs
  | 'mini-bands' // mini-bandes de hanche
  | 'pushup-handles' // poignées de pompes
  | 'pullup-bar' // barre de traction (sert aussi d'ancrage haut)
  | 'dip-bars' // barres parallèles
  | 'bench' // support stable surélevé : banc, chaise solide, canapé
  | 'step' // marche, escalier
  | 'wall' // mur dégagé
  | 'backpack' // sac à dos lestable
  | 'bike' // vélo (cardio, jalon J5)
  | 'treadmill'; // tapis de course (J5b : la course en intérieur)

/**
 * Espace disponible, du plus petit au plus grand :
 * small = ~2 m² (de quoi s'allonger) ; medium = bras et jambes écartés ; large = recul ≥ 1,5 m (sangles).
 */
export type SpaceSize = 'small' | 'medium' | 'large';

/** Ordre des tailles d'espace, pour comparer « l'exercice tient-il dans ce lieu ? ». */
export const SPACE_ORDER: Record<SpaceSize, number> = { small: 0, medium: 1, large: 2 };

export interface Location {
  id: string;
  name: string;
  equipment: EquipmentTag[];
  space: SpaceSize;
  /** Ordre d'affichage. */
  order: number;
}

/**
 * Exigence de matériel : un tag (obligatoire), ou une liste de tags dont un seul suffit.
 * Ex. `['straps', ['anchor', 'pullup-bar']]` = sangles ET (ancrage OU barre).
 */
export type Requirement = EquipmentTag | EquipmentTag[];

// ─── Catalogue ───

/** Familles de mouvements. Les trois premières sont les « mouvements principaux » (SPEC §4.4). */
export type Category =
  | 'push'
  | 'pull'
  | 'legs'
  | 'knee' // prévention genou, présente dans chaque séance
  | 'core'
  | 'arms' // biceps, triceps : en fin de séance avec la priorité « haut du corps » (J3b)
  | 'shoulders'
  | 'warmup'
  | 'cooldown'
  | 'volume'; // série longue de pompes, hebdomadaire

/** Impact sur le genou (SPEC §4.6). */
export type KneeImpact = 'low' | 'mid' | 'high';

/** Objectif d'une série : des répétitions ou une durée (secondes). */
export type Target =
  | { kind: 'reps'; min: number; max: number }
  | { kind: 'time'; min: number; max: number };

export interface Variant {
  id: string;
  name: string;
  /** Matériel nécessaire (toutes les exigences doivent être satisfaites). */
  needs: Requirement[];
  /** Espace minimum. */
  space: SpaceSize;
  knee: KneeImpact;
  /**
   * Mains au sol (pompes, pike…) : le support s'adapte au lieu et à la règle poignet
   * (poignées, poings ou mains à plat, cf. availability.ts).
   */
  handsOnFloor?: boolean;
  /** Faisable sur les poings quand il n'y a pas de poignées (faux pour l'appui renversé). */
  fistsOk?: boolean;
  /** Charge forte sur le poignet : avertissement au choix du niveau (règle poignet). */
  wristHeavy?: boolean;
  /** Objectif par série. */
  target: Target;
  /** Nombre et cible exprimés par côté (fentes, pistol…). */
  perSide?: boolean;
  /** Consignes courtes (3 à 5). */
  cues: string[];
  /** Erreurs courantes. */
  mistakes: string[];
  /** Substitut faible : proposé faute de mieux, ne fait pas progresser le niveau (ex. tirage élastique). */
  substitute?: boolean;
  /**
   * Termes de recherche vidéo, quand le nom français donne de mauvais résultats
   * (par défaut : le nom + « exercice »).
   */
  videoQuery?: string;
  /** Exercice à l'élastique : la force de l'élastique est suivie (voir bands.ts). */
  band?: BandUse;
  /** Repère de départ affiché dans la fiche et au test de niveau (ex. charge du sac). */
  startHint?: string;
}

/**
 * Élastiques longs : leur force est un second levier de progression, avant la variante suivante
 * (plus de répétitions, puis un élastique plus fort, puis le niveau au-dessus).
 *  - `start` : élastique conseillé au départ, sur une échelle 0 (le plus léger) → 2 (le plus fort),
 *    ramenée au nombre d'élastiques réellement possédés ;
 *  - `assist` : l'élastique AIDE (tractions assistées) : progresser = prendre plus léger ;
 *  - `fixed` : pas de progression par l'élastique (isométrie : la tension sert juste à tenir).
 */
export interface BandUse {
  start: 0 | 1 | 2;
  assist?: boolean;
  fixed?: boolean;
}

/** Élastique utilisé : rang parmi les élastiques possédés (0 = le plus léger), et son libellé. */
export interface BandChoice {
  rank: number;
  /** Nombre d'élastiques possédés à ce moment-là. */
  of: number;
  label: string;
}

/** Un niveau de l'échelle : une ou plusieurs variantes équivalentes, pour des matériels différents. */
export interface Level {
  variants: Variant[];
}

export interface Movement {
  id: string;
  name: string;
  category: Category;
  /** Échelle, du plus facile (index 0) au plus dur. */
  levels: Level[];
  /** Substituts utilisés quand aucun niveau n'est faisable sur le lieu. */
  substitutes?: Variant[];
  /** Courte explication affichée dans l'écran Niveaux. */
  note?: string;
}

// ─── Plan de séance ───

/**
 * Priorité d'entraînement (J3b), choisie dans Profil :
 *  - balanced : pousser, tirer et jambes à parts égales ;
 *  - upper : haut du corps (pectoraux, bras, abdos) — une série de plus en pousser et tirer,
 *    bras en fin de séance, jambes environ 2 fois par semaine (la prévention genou ne change pas).
 */
export type TrainingFocus = 'balanced' | 'upper';

/** Durées proposées (SPEC §4.4). 40 = « 40 min et plus ». */
export type Duration = 10 | 20 | 30 | 40;

export const DURATIONS: Duration[] = [10, 20, 30, 40];

/** Façon de tenir les mains pour un exercice « mains au sol ». */
export type HandSupport = 'handles' | 'fists' | 'flat';

/** Un exercice dans le plan. */
export interface PlanItem {
  movementId: string;
  variantId: string;
  /** Niveau (index dans l'échelle) réellement utilisé ; peut être inférieur au niveau choisi si le lieu l'impose. */
  level: number;
  /** Vrai si le niveau a dû être abaissé faute de matériel, ou si c'est un substitut. */
  adapted: boolean;
  sets: number;
  target: Target;
  /** Valeur pré-remplie de chaque série (objectif du jour). */
  prefill: number;
  /** Objectif exprimé par côté (copié de la variante). */
  perSide?: boolean;
  handSupport?: HandSupport;
  /** Exercice guidé (échauffement, retour au calme) : on suit le minuteur, rien à noter. */
  guided?: boolean;
  /** Séries de la dernière séance avec cette variante (rappel du carnet pendant la séance). */
  last?: number[];
  /** Élastique prévu (exercices à l'élastique) ; modifiable pendant la séance. */
  band?: BandChoice;
  /** Élastique de la dernière séance, affiché avec son rappel (« élastique 20 kg »). */
  lastBand?: string;
}

/** Un bloc : un exercice seul, un superset (2 exercices alternés) ou un circuit. */
export interface PlanBlock {
  kind: 'warmup' | 'knee' | 'superset' | 'single' | 'core' | 'volume' | 'cooldown';
  title: string;
  items: PlanItem[];
  /** Repos entre deux exercices du même tour (superset), en secondes. */
  restBetween: number;
  /** Repos à la fin d'un tour, en secondes. */
  restAfterRound: number;
  /** Bloc facultatif : on peut le passer d'un geste (retour au calme). */
  optional?: boolean;
}

export interface Plan {
  createdAt: string;
  locationId: string;
  duration: Duration;
  kneeScore: number;
  blocks: PlanBlock[];
  /** Estimation en minutes. */
  estimatedMinutes: number;
  /** Adaptations du jour expliquées en clair (2e séance, jambes au repos, volume, reprise). */
  notes?: string[];
  /** Ressenti global de la séance précédente, rappelé dans l'aperçu (« la dernière fois, c'était dur »). */
  recall?: { feel: SessionFeel; startedAt: string; locationId: string };
}
