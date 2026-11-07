/**
 * État partagé de l'entraînement (J2) : historique des séances, activités (séances imposées),
 * scores de genou récents. Relu au démarrage, puis après chaque écriture : l'accueil, le carnet
 * et le moteur lisent la même chose.
 */
import { signal } from '@preact/signals';
import { CATALOG } from '../data/catalog';
import {
  addActivity,
  addKneeLog,
  deleteActivity,
  deleteWorkout,
  listActivities,
  listRecentKneeLogs,
  listWorkouts,
} from '../data/repo';
import { track } from '../data/usage';
import type { WorkoutRecord } from '../domain/history';
import { levelChanges, type LevelChange } from '../domain/progression';
import { MORNING_WORSE_SCORE, type Activity, type ImposedActivity, type KneeLog } from '../domain/recovery';
import { chooseLevel, levels, levelSince } from './state';

/** Toutes les séances terminées, de la plus ancienne à la plus récente. */
export const workouts = signal<WorkoutRecord[]>([]);

/** Activités hors renfo (séances imposées). */
export const activities = signal<Activity[]>([]);

/** Scores de genou des 14 derniers jours. */
export const kneeLogs = signal<KneeLog[]>([]);

export async function loadTraining(): Promise<void> {
  const [w, a, k] = await Promise.all([listWorkouts(), listActivities(), listRecentKneeLogs()]);
  workouts.value = w;
  activities.value = a;
  kneeLogs.value = k;
}

/** Note une séance imposée. */
export async function logImposed(activity: ImposedActivity): Promise<void> {
  await addActivity(activity);
  track('imposed', { kind: activity.kind, legs: activity.legs, intensity: activity.intensity, minutes: activity.minutes });
  await loadTraining();
}

export async function removeActivity(id: number): Promise<void> {
  await deleteActivity(id);
  track('activity-delete');
  await loadTraining();
}

export async function removeWorkout(id: number): Promise<void> {
  await deleteWorkout(id);
  track('workout-delete');
  await loadTraining();
}

/** Note un score de genou (avant la séance, ou le matin). */
export async function logKnee(row: KneeLog & { side?: 'left' | 'right' | 'both' }): Promise<void> {
  await addKneeLog(row);
  kneeLogs.value = [...kneeLogs.value, row];
}

/** Réponse à « genou ce matin » : « plus mal » compte comme un score de 3. */
export async function answerMorningKnee(worse: boolean): Promise<void> {
  await logKnee({ date: new Date().toISOString(), score: worse ? MORNING_WORSE_SCORE : 0, context: 'morning', worse });
  track('knee-morning', { worse });
}

/**
 * Après une séance : relit l'historique, applique les déblocages (automatiques, SPEC §4.5) et
 * renvoie les changements pour le bilan (déblocages à célébrer, retours en arrière à proposer).
 */
export async function afterWorkout(record: WorkoutRecord): Promise<{ unlocks: LevelChange[]; stepBacks: LevelChange[] }> {
  await loadTraining();
  const changes = levelChanges(record, workouts.value, CATALOG, levels.value, levelSince.value);
  for (const u of changes.unlocks) {
    await chooseLevel(u.movementId, u.to);
    track('level-up', { movementId: u.movementId, from: u.from, to: u.to });
  }
  return changes;
}
