/**
 * Accès aux mensurations et aux photos de progression (J3). Fines fonctions au-dessus de Dexie.
 * Les fonctions acceptent une base en paramètre pour les tests (base par défaut : celle de l'appli).
 */
import type { MeasureEntry, PhotoPose } from '../domain/body';
import { db, type CranDB, type PhotoRow } from './db';

// ─── Mesures ───

export function listMeasures(database: CranDB = db): Promise<MeasureEntry[]> {
  return database.measures.orderBy('day').toArray();
}

/** Enregistre une mesure (remplace celle du même type le même jour). */
export async function saveMeasure(entry: MeasureEntry, database: CranDB = db): Promise<void> {
  await database.measures.put(entry);
}

export async function deleteMeasure(id: string, database: CranDB = db): Promise<void> {
  await database.measures.delete(id);
}

// ─── Photos ───

/** Toutes les photos (avec leurs images), de la plus ancienne à la plus récente. */
export async function listPhotos(database: CranDB = db): Promise<PhotoRow[]> {
  const rows = await database.photos.toArray();
  return rows.sort((a, b) => a.day.localeCompare(b.day) || a.at.localeCompare(b.at));
}

/** Ajoute une photo ; une seule par pose et par mois : la nouvelle remplace l'ancienne. */
export async function savePhoto(row: Omit<PhotoRow, 'id'>, database: CranDB = db): Promise<number> {
  return database.transaction('rw', database.photos, async () => {
    await database.photos.where('month').equals(row.month).and((p) => p.pose === row.pose).delete();
    return database.photos.add(row as PhotoRow);
  });
}

/** Supprime les photos d'un mois (toutes les poses, ou une seule). */
export async function deletePhotos(month: string, pose?: PhotoPose, database: CranDB = db): Promise<void> {
  await database.photos
    .where('month')
    .equals(month)
    .and((p) => !pose || p.pose === pose)
    .delete();
}
