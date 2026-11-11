/**
 * Accès aux remarques d'usage (retouche du 11/11). Fines fonctions au-dessus de Dexie ; base en
 * paramètre pour les tests (par défaut : celle de l'appli).
 */
import { lastScreenFrom, type Remark } from '../domain/remarks';
import { db, type CranDB } from './db';

/** Remarques, de la plus ancienne à la plus récente. */
export function listRemarks(database: CranDB = db): Promise<Remark[]> {
  return database.remarks.orderBy('at').toArray();
}

/** Enregistre une remarque ; renvoie son identifiant. */
export function addRemark(remark: Remark, database: CranDB = db): Promise<number> {
  return database.remarks.add(remark);
}

export async function deleteRemark(id: number, database: CranDB = db): Promise<void> {
  await database.remarks.delete(id);
}

/** Dernier écran vu d'après le journal d'usage (les 50 derniers événements suffisent). */
export async function lastScreen(database: CranDB = db): Promise<{ name: string; at: number } | undefined> {
  const recent = await database.events.orderBy('at').reverse().limit(50).toArray();
  return lastScreenFrom(recent.reverse());
}
