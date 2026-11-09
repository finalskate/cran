/**
 * État partagé de l'entraînement (J2) : historique des séances, activités (séances imposées ;
 * course, vélo et vélotaf au J5a), scores de genou. Relu au démarrage, puis après chaque
 * écriture : l'accueil, le carnet et le moteur lisent la même chose.
 */
import { computed, signal } from '@preact/signals';
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
import { dayKey } from '../domain/days';
import type { WorkoutRecord } from '../domain/history';
import { levelChanges, type LevelChange } from '../domain/progression';
import {
  MORNING_WORSE_SCORE,
  type Activity,
  type BikeActivity,
  type CommuteActivity,
  type ImposedActivity,
  type KneeLog,
  type PushupTestActivity,
  type RunActivity,
} from '../domain/recovery';
import { chooseLevel, levels, levelSince } from './state';

/** Toutes les séances terminées, de la plus ancienne à la plus récente. */
export const workouts = signal<WorkoutRecord[]>([]);

/** Jours des séances de renfo terminées avec au moins une série (une entrée par séance). */
export const renfoDays = computed(() =>
  workouts.value.filter((w) => w.entries.some((e) => e.sets.length > 0)).map((w) => dayKey(new Date(w.endedAt))),
);

/** Activités hors renfo (séances imposées, course, vélo, vélotaf), triées par jour. */
export const activities = signal<Activity[]>([]);

/**
 * Scores de genou de la dernière année : la règle kiné n'en lit que 7 jours, mais le plan de
 * course regarde le genou de chaque semaine depuis sa 1re sortie (src/domain/running.ts).
 */
export const kneeLogs = signal<KneeLog[]>([]);

/** Profondeur des scores de genou chargés (une ligne par séance, course ou matin : c'est léger). */
const KNEE_DAYS = 400;

export async function loadTraining(): Promise<void> {
  const [w, a, k] = await Promise.all([listWorkouts(), listActivities(), listRecentKneeLogs(KNEE_DAYS)]);
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

/**
 * Note une course (J5a). Le genou noté après la course va aussi dans `kneeLogs` (contexte
 * « run ») : il compte pour la règle kiné et pour le plan de course, comme un score de séance.
 */
export async function logRun(run: RunActivity): Promise<void> {
  await addActivity(run);
  await addKneeLog({ date: run.at, score: run.kneeAfter, context: 'run' });
  track('run', { minutes: run.minutes, km: run.km !== undefined, kind: run.kind, feel: run.feel, knee: run.kneeAfter, day: run.day });
  await loadTraining();
}

/** Note une séance de vélo. */
export async function logBike(bike: BikeActivity): Promise<void> {
  await addActivity(bike);
  track('bike', { minutes: bike.minutes, kind: bike.kind, feel: bike.feel, day: bike.day });
  await loadTraining();
}

/** Note un test pompes (J6b). */
export async function logPushupTest(test: PushupTestActivity): Promise<void> {
  await addActivity(test);
  track('pushup-test', { format: test.format, reps: test.reps });
  await loadTraining();
}

/** Note un vélotaf (aller, retour ou les deux). */
export async function logCommute(commute: CommuteActivity): Promise<void> {
  await addActivity(commute);
  track('commute', { trips: commute.trips, day: commute.day });
  await loadTraining();
}

export async function removeActivity(id: number): Promise<void> {
  const type = activities.value.find((a) => a.id === id)?.type;
  await deleteActivity(id);
  track('activity-delete', { type });
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
