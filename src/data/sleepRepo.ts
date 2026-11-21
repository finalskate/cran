/**
 * Accès aux nuits notées (« Ta nuit ? », accueil du 21/11). Fines fonctions au-dessus de Dexie ;
 * base en paramètre pour les tests (par défaut : celle de l'appli).
 */
import type { NightEntry } from '../domain/sleep';
import { db, type CranDB } from './db';

export function listNights(database: CranDB = db): Promise<NightEntry[]> {
  return database.nights.orderBy('day').toArray();
}

/** Enregistre la nuit d'un jour de réveil (remplace celle du même jour). */
export async function saveNight(night: NightEntry, database: CranDB = db): Promise<void> {
  await database.nights.put(night);
}
