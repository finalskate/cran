/**
 * Accès aux bilans du soir (J4B). Fines fonctions au-dessus de Dexie ; base en paramètre pour
 * les tests (par défaut : celle de l'appli). Les plans « si… alors… » sont un réglage (`plans`).
 */
import type { DailyReview } from '../domain/habits';
import { db, type CranDB } from './db';

export function listReviews(database: CranDB = db): Promise<DailyReview[]> {
  return database.reviews.orderBy('day').toArray();
}

/** Enregistre le bilan d'un jour (remplace celui du même jour). */
export async function saveReview(review: DailyReview, database: CranDB = db): Promise<void> {
  await database.reviews.put(review);
}
