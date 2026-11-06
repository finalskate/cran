/**
 * Accès aux données de l'appli (lieux, niveaux, genou, historique, séance en cours).
 * Fines fonctions au-dessus de Dexie : l'UI ne manipule jamais les tables directement.
 */
import type { WorkoutRecord } from '../domain/history';
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

/** Niveau choisi par mouvement. */
export async function getLevels(): Promise<Record<string, number>> {
  const rows = await db.levels.toArray();
  return Object.fromEntries(rows.map((r) => [r.movementId, r.level]));
}

export async function setLevel(movementId: string, level: number): Promise<void> {
  await db.levels.put({ movementId, level, updatedAt: new Date().toISOString() });
}

// ─── Genou ───

export async function addKneeLog(row: Omit<KneeLogRow, 'id'>): Promise<void> {
  await db.kneeLogs.add(row);
}

// ─── Historique ───

export function listWorkouts(): Promise<WorkoutRecord[]> {
  return db.workouts.orderBy('startedAt').toArray();
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

/** Enregistre la séance terminée et efface la séance en cours, en une seule transaction. */
export async function finishWorkout(record: WorkoutRecord): Promise<void> {
  await db.transaction('rw', db.workouts, db.activeSession, async () => {
    await db.workouts.add(record);
    await db.activeSession.delete('current');
  });
}
