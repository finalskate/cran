/**
 * État global de l'interface, partagé entre écrans (signaux Preact).
 * Les valeurs persistantes sont relues depuis IndexedDB au démarrage puis réécrites à chaque changement.
 */
import { effect, signal } from '@preact/signals';
import { finishWorkout, getLevels, listLevelHistory, listLocations, loadActiveSession, saveActiveSession, setLevel } from '../data/repo';
import type { LevelHistoryEntry } from '../domain/progression';
import { getSetting, setSetting, SETTING_DEFAULTS, type FxLevel, type SettingsMap } from '../data/settings';
import { ensurePersistence, type PersistState } from '../data/storage';
import { toRecord, type SessionState } from '../domain/session';
import { loadBodyState } from './bodyState';
import { loadFoodState } from './foodState';
import { loadHabitsState } from './habitsState';
import { syncPhase } from './phaseState';
import { loadTraining } from './training';
import type { Location, Plan } from '../domain/types';

// ─── Préférences ───

/** Réglages de préférence (tous ceux qui ont une valeur par défaut). */
export type Prefs = { [K in keyof typeof SETTING_DEFAULTS]: SettingsMap[K] };

export const prefs = signal<Prefs>({ ...SETTING_DEFAULTS });

/** Change une préférence et l'enregistre. */
export async function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): Promise<void> {
  prefs.value = { ...prefs.value, [key]: value };
  await setSetting(key, value as SettingsMap[K]);
}

/** Raccourci historique (J0) pour les effets visuels. */
export function setFx(level: FxLevel): Promise<void> {
  return setPref('fx', level);
}

// ─── Données ───

/** État du stockage persistant (affiché dans Réglages). */
export const persistState = signal<PersistState | 'unknown'>('unknown');

export const locations = signal<Location[]>([]);

/** Niveau choisi par mouvement. */
export const levels = signal<Record<string, number>>({});

/** Date du dernier changement de niveau, par mouvement (la progression compte depuis). */
export const levelSince = signal<Record<string, string>>({});

/** Changements de niveau, du plus ancien au plus récent (badges, bilan du dimanche). */
export const levelHistory = signal<LevelHistoryEntry[]>([]);

/** Séance en cours (null = aucune). Enregistrée à chaque changement pour pouvoir la reprendre. */
export const session = signal<SessionState | null>(null);

/** Plan proposé, en attente de démarrage (écran Aperçu). */
export const draftPlan = signal<Plan | null>(null);

/** Vrai une fois les données relues depuis la base. */
export const ready = signal(false);

export async function reloadLocations(): Promise<void> {
  locations.value = await listLocations();
}

export async function chooseLevel(movementId: string, level: number): Promise<void> {
  levels.value = { ...levels.value, [movementId]: level };
  const at = await setLevel(movementId, level);
  levelSince.value = { ...levelSince.value, [movementId]: at };
  levelHistory.value = [...levelHistory.value, { movementId, level, at }];
}

/** Met à jour la séance en cours et l'enregistre (sans attendre l'écriture : l'UI reste fluide). */
export function updateSession(next: SessionState | null): void {
  session.value = next;
  if (next) void saveActiveSession(next);
}

// ─── Démarrage ───

/**
 * À appeler une fois au démarrage. Les étapes sont indépendantes : si l'une échoue
 * (base indisponible, navigateur restrictif), les autres se font quand même.
 */
export async function initState(): Promise<void> {
  await Promise.allSettled([loadData(), loadFoodState(), loadBodyState(), loadHabitsState(), loadTraining(), refreshPersistence()]);
  // Changement de phase programmé arrivé à date : appliqué avant le premier affichage.
  await syncPhase().catch(() => undefined);
  ready.value = true;
}

// Appli laissée ouverte (ou en arrière-plan) jusqu'au jour d'un changement de phase programmé.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ready.value) void syncPhase().catch(() => undefined);
});

async function loadData(): Promise<void> {
  // Premier lancement : on note la date (utile plus tard pour l'onboarding et les statistiques).
  if ((await getSetting('installedAt')) === undefined) {
    await setSetting('installedAt', new Date().toISOString());
  }

  const loaded = { ...SETTING_DEFAULTS } as Prefs;
  for (const key of Object.keys(SETTING_DEFAULTS) as (keyof Prefs)[]) {
    const value = await getSetting(key);
    if (value !== undefined) (loaded as Record<string, unknown>)[key] = value;
  }
  prefs.value = loaded;

  const [locs, lvls, active, history] = await Promise.all([listLocations(), getLevels(), loadActiveSession(), listLevelHistory()]);
  levelHistory.value = history;
  locations.value = locs;
  levels.value = lvls.levels;
  levelSince.value = lvls.since;

  // Séance terminée mais pas encore archivée (appli fermée pile à la fin) : on l'archive maintenant.
  if (active?.phase === 'done') {
    await finishWorkout(toRecord(active, Date.now()));
    session.value = null;
  } else {
    session.value = active;
  }
}

/** Demande (ou redemande) la persistance et met à jour l'état affiché. */
export async function refreshPersistence(): Promise<void> {
  try {
    persistState.value = await ensurePersistence();
  } catch {
    persistState.value = 'denied';
  }
}

// Le CSS lit l'attribut data-fx sur <html> (voir theme.css).
effect(() => {
  document.documentElement.dataset.fx = prefs.value.fx;
});
