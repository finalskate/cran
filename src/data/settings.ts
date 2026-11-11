/**
 * Accès typé aux réglages stockés dans la table `settings`.
 * Chaque nouvelle clé se déclare dans SettingsMap : le compilateur vérifie alors le type des valeurs.
 */
import type { AdjustmentRecord, DayOverride } from '../domain/adaptive';
import type { IfThenPlan } from '../domain/habits';
import type { PhaseEntry, PhaseId } from '../domain/phase';
import type { GoalChange, PauseEntry } from '../domain/regularity';
import type { DayChoice } from '../domain/weekPlan';
import type { Profile } from '../domain/nutrition';
import type { Duration, TrainingFocus } from '../domain/types';
import { DEFAULT_WEEK_GOAL, type WeekGoal } from '../domain/week';
import { db, type CranDB } from './db';

/** Niveau d'effets visuels (SPEC §4.1) : halos et flou, ou version sobre. */
export type FxLevel = 'full' | 'reduced';

export interface SettingsMap {
  /** Date ISO du tout premier lancement. */
  installedAt: string;
  /** Effets visuels choisis par l'utilisateur. */
  fx: FxLevel;
  /** Dernier lieu et dernière durée utilisés (pré-remplis sur l'accueil, SPEC §4.1). */
  lastLocationId: string;
  lastDuration: Duration;
  /** Règle poignet (SPEC §4.3), activée par défaut. */
  wristRule: boolean;
  /** Retours pendant la séance. */
  vibration: boolean;
  beep: boolean;
  voice: boolean;
  /** Notification système en fin de repos (relayée par la montre, SPEC §4.12). */
  watchNotify: boolean;
  /** Rappel « lance l'activité Musculation sur la montre » au démarrage. */
  watchReminder: boolean;
  /** Date ISO du dernier export (rappel hebdomadaire, J6a). Vide : jamais exporté. */
  lastExportAt: string;
  /** Rappel d'export repoussé (« Plus tard ») jusqu'à ce jour inclus. */
  exportSnoozedUntil: string;
  /** Profil pour la cible calorique (J4) : saisi dans l'appli, jamais dans le code. */
  profile: Profile;
  /** Premier jour de la calibration alimentaire (« 2026-11-14 »), fixé à la création du profil. */
  calibrationStart: string;
  /** Journées comptées ou mises de côté à la main pour l'ajustement adaptatif (clé = jour). */
  dayOverrides: Record<string, DayOverride>;
  /** Décisions d'ajustement de la cible, de la plus ancienne à la plus récente. */
  adjustments: AdjustmentRecord[];
  /** Objectifs de poids par étapes (J3), saisis dans l'appli : la projection vise l'étape suivante. */
  weightGoals: number[];
  /** Invitation au tour de taille repoussée jusqu'à ce jour (« 2026-11-21 »). */
  waistSnoozedUntil: string;
  /** Photos de progression floutées jusqu'au toucher (quelqu'un peut regarder l'écran). */
  photoBlur: boolean;
  /** Priorité d'entraînement (J3b) : équilibrée, ou haut du corps (séance et protéines). */
  focus: TrainingFocus;
  /** Plans « si… alors… » de l'utilisateur (J4B). Absent : les plans de départ (src/data/habits.ts). */
  plans: IfThenPlan[];
  /** Variante préférée par mouvement (choisie avec « Remplacer » parmi les équivalentes). */
  variantChoice: Readonly<Record<string, string>>;
  /** Forces des élastiques longs possédés, en kg (saisies dans Lieux). Vide : léger / moyen / fort. */
  bands: readonly number[];
  /** Objectif de la semaine (J5a) : jours de renfo et de cardio. */
  weekGoal: WeekGoal;
  /** Dernier cardio noté (la feuille « course · vélo » s'ouvre dessus). */
  lastCardio: 'run' | 'bike';
  /** Phases choisies (J5b), triées par premier jour ; une entrée future = changement programmé. */
  phases: PhaseEntry[];
  /** Clé (phaseKey) de la phase dont les choix par défaut ont été appliqués (lieu, objectif). */
  phaseApplied: string;
  /** Clé de la phase dont l'annonce a été vue sur l'accueil. */
  phaseSeen: string;
  /** Objectif de la semaine modifié dans une phase : il revient avec elle. */
  phaseGoals: Partial<Record<PhaseId, WeekGoal>>;
  /** Changements de l'objectif de la semaine (J6a) : chaque semaine est jugée sur le sien. */
  weekGoals: GoalChange[];
  /** Pauses (J6a) : l'objectif de la semaine est suspendu, rien n'est perdu. */
  pauses: PauseEntry[];
  /** Jours réglés à la main dans le planning de la semaine (clé = jour). */
  planChoices: Record<string, DayChoice>;
  /** Badges gagnés (J6b) : identifiant → jour du franchissement. Jamais retirés. */
  badges: Record<string, string>;
  /** Lundi de la dernière semaine dont le bilan du dimanche a été confirmé. */
  weekReviewDone: string;
  /** Test pompes du mois repoussé (« Plus tard ») jusqu'à ce jour inclus. */
  pushupTestSnoozed: string;
  /** Rappels de plan « si… alors… » fermés sur l'accueil (clés « jour:moment », voir planMomentKey). */
  planMomentsSeen: string[];
}

export type SettingKey = keyof SettingsMap;

/** Valeurs par défaut des réglages de préférence. */
export const SETTING_DEFAULTS = {
  fx: 'full',
  lastLocationId: 'home',
  lastDuration: 20,
  wristRule: true,
  vibration: true,
  beep: true,
  voice: false,
  watchNotify: false,
  watchReminder: true,
  photoBlur: true,
  focus: 'balanced',
  variantChoice: {},
  bands: [],
  weekGoal: DEFAULT_WEEK_GOAL,
  lastCardio: 'run',
  phases: [],
  phaseApplied: '',
  phaseSeen: '',
  phaseGoals: {},
  weekGoals: [],
  pauses: [],
  planChoices: {},
  badges: {},
  weekReviewDone: '',
  pushupTestSnoozed: '',
  planMomentsSeen: [],
  // Dates : vides tant qu'elles n'ont pas été écrites (installedAt l'est au 1er lancement).
  installedAt: '',
  lastExportAt: '',
  exportSnoozedUntil: '',
} as const satisfies Partial<SettingsMap>;

/** Lit un réglage ; `undefined` s'il n'a jamais été écrit. */
export async function getSetting<K extends SettingKey>(
  key: K,
  database: CranDB = db,
): Promise<SettingsMap[K] | undefined> {
  const row = await database.settings.get(key);
  return row?.value as SettingsMap[K] | undefined;
}

/** Écrit (ou remplace) un réglage. */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: SettingsMap[K],
  database: CranDB = db,
): Promise<void> {
  await database.settings.put({ key, value });
}
