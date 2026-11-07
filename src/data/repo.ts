/**
 * Accès aux données de l'appli (lieux, niveaux, genou, historique, séance en cours).
 * Fines fonctions au-dessus de Dexie : l'UI ne manipule jamais les tables directement.
 */
import type { SessionFeel, WorkoutRecord } from '../domain/history';
import type { Activity } from '../domain/recovery';
import type { SessionState } from '../domain/session';
import type { Location } from '../domain/types';
import { db, type KneeLogRow } from './db';

// ─── Lieux ───

export function listLocations(): Promise<Location[]> {
  return db.locations.orderBy('order').toArray();
}

export async function saveLocation(location: Location): Promise<void> {
  await db.locations.put(location);
}

export async function deleteLocation(id: string): Promise<void> {
  await db.locations.delete(id);
}

// ─── Niveaux ───

/** Niveau choisi par mouvement, et date du dernier changement (la progression compte depuis). */
export async function getLevels(): Promise<{ levels: Record<string, number>; since: Record<string, string> }> {
  const rows = await db.levels.toArray();
  return {
    levels: Object.fromEntries(rows.map((r) => [r.movementId, r.level])),
    since: Object.fromEntries(rows.map((r) => [r.movementId, r.updatedAt])),
  };
}

/** Change le niveau d'un mouvement ; renvoie la date du changement. */
export async function setLevel(movementId: string, level: number): Promise<string> {
  const updatedAt = new Date().toISOString();
  await db.levels.put({ movementId, level, updatedAt });
  return updatedAt;
}

// ─── Genou ───

export async function addKneeLog(row: Omit<KneeLogRow, 'id'>): Promise<void> {
  await db.kneeLogs.add(row);
}

/** Scores des `days` derniers jours (règle kiné, genou du lendemain). */
export function listRecentKneeLogs(days = 14): Promise<KneeLogRow[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  return db.kneeLogs.where('date').aboveOrEqual(since).toArray();
}

// ─── Activités (séances imposées) ───

export function listActivities(): Promise<Activity[]> {
  return db.activities.orderBy('day').toArray();
}

export async function addActivity(activity: Activity): Promise<number> {
  return db.activities.add(activity);
}

export async function deleteActivity(id: number): Promise<void> {
  await db.activities.delete(id);
}

// ─── Historique ───

export function listWorkouts(): Promise<WorkoutRecord[]> {
  return db.workouts.orderBy('startedAt').toArray();
}

/** Supprime une séance du carnet (saisie par erreur). */
export async function deleteWorkout(id: number): Promise<void> {
  await db.workouts.delete(id);
}

export async function addWorkout(record: WorkoutRecord): Promise<void> {
  await db.workouts.add(record);
}

// ─── Séance en cours ───

export async function loadActiveSession(): Promise<SessionState | null> {
  const row = await db.activeSession.get('current');
  return row?.state ?? null;
}

export async function saveActiveSession(state: SessionState): Promise<void> {
  await db.activeSession.put({ key: 'current', state });
}

export async function clearActiveSession(): Promise<void> {
  await db.activeSession.delete('current');
}

/**
 * Enregistre la séance terminée et efface la séance en cours, en une seule transaction.
 * Renvoie l'identifiant de la séance (pour y ajouter ensuite le ressenti global).
 */
export async function finishWorkout(record: WorkoutRecord): Promise<number> {
  return db.transaction('rw', db.workouts, db.activeSession, async () => {
    const id = await db.workouts.add(record);
    await db.activeSession.delete('current');
    return id;
  });
}

/** Ajoute (ou change) le ressenti global d'une séance déjà enregistrée. */
export async function setWorkoutFeel(id: number, feel: SessionFeel): Promise<void> {
  await db.workouts.update(id, { sessionFeel: feel });
}
