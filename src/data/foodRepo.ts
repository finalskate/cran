/**
 * Accès aux données d'alimentation et de pesée (J4 phase A) : aliments connus, journal
 * alimentaire, pesées. Comme repo.ts, l'UI ne manipule jamais les tables directement.
 * La base est paramétrable pour les tests (foodRepo.test.ts).
 */
import type { Food, FoodEntry, WeightEntry } from '../domain/nutrition';
import { db, type CranDB } from './db';

// ─── Aliments ───

export function listFoods(database: CranDB = db): Promise<Food[]> {
  return database.foods.toArray();
}

export function getFood(id: string, database: CranDB = db): Promise<Food | undefined> {
  return database.foods.get(id);
}

export function findFoodByBarcode(code: string, database: CranDB = db): Promise<Food | undefined> {
  return database.foods.where('barcode').equals(code).first();
}

/**
 * Enregistre un aliment. S'il existait déjà (nouveau scan, valeurs complétées), son
 * historique d'usage et son statut de favori sont conservés.
 */
export async function saveFood(food: Food, database: CranDB = db): Promise<Food> {
  return database.transaction('rw', database.foods, async () => {
    const prev = await database.foods.get(food.id);
    const merged: Food = prev
      ? { ...food, uses: prev.uses, createdAt: prev.createdAt, ...(prev.lastUsedAt ? { lastUsedAt: prev.lastUsedAt } : {}), ...(prev.favorite ? { favorite: true } : {}) }
      : food;
    await database.foods.put(merged);
    return merged;
  });
}

export async function setFavorite(id: string, favorite: boolean, database: CranDB = db): Promise<void> {
  await database.foods.update(id, { favorite });
}

export async function deleteFood(id: string, database: CranDB = db): Promise<void> {
  await database.foods.delete(id);
}

// ─── Journal alimentaire ───

/**
 * Note une entrée et, si elle vient d'un aliment connu, met à jour son usage (tri des récents),
 * en une seule transaction.
 */
export async function addFoodEntry(entry: FoodEntry, database: CranDB = db): Promise<number> {
  return database.transaction('rw', database.foodLog, database.foods, async () => {
    const id = await database.foodLog.add(entry);
    if (entry.foodId) {
      const food = await database.foods.get(entry.foodId);
      if (food) await database.foods.update(food.id, { uses: food.uses + 1, lastUsedAt: entry.at });
    }
    return id;
  });
}

export function listFoodEntries(day: string, database: CranDB = db): Promise<FoodEntry[]> {
  return database.foodLog.where('day').equals(day).sortBy('at');
}

/** Entrées sur une plage de jours (bornes comprises), pour l'ajustement adaptatif et les bilans. */
export function listFoodEntriesBetween(from: string, to: string, database: CranDB = db): Promise<FoodEntry[]> {
  return database.foodLog.where('day').between(from, to, true, true).toArray();
}

export async function updateFoodEntry(id: number, changes: Partial<FoodEntry>, database: CranDB = db): Promise<void> {
  await database.foodLog.update(id, changes);
}

export async function deleteFoodEntry(id: number, database: CranDB = db): Promise<void> {
  await database.foodLog.delete(id);
}

// ─── Pesées ───

export function listWeights(database: CranDB = db): Promise<WeightEntry[]> {
  return database.weights.orderBy('day').toArray();
}

/** Enregistre la pesée du jour (remplace une pesée du même jour). */
export async function saveWeight(entry: WeightEntry, database: CranDB = db): Promise<void> {
  await database.weights.put(entry);
}

export async function deleteWeight(day: string, database: CranDB = db): Promise<void> {
  await database.weights.delete(day);
}
