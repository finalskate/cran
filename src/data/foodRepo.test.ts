/**
 * Tests de l'accès aux données d'alimentation (base en mémoire via fake-indexeddb).
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { Food, FoodEntry } from '../domain/nutrition';
import { CranDB } from './db';
import {
  addFoodEntry,
  findFoodByBarcode,
  getFood,
  listFoodEntries,
  listWeights,
  saveFood,
  saveWeight,
  setFavorite,
} from './foodRepo';

const opened: CranDB[] = [];

function freshDb(): CranDB {
  const database = new CranDB(`cran-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()));
});

const FOOD: Food = {
  id: 'ean:96385074',
  source: 'off',
  name: 'Skyr',
  barcode: '96385074',
  per100: { kcal: 60, protein: 10 },
  unit: 'g',
  portions: [{ label: '1 pot (150 g)', amount: 150 }],
  uses: 0,
  createdAt: '2026-11-14T08:00:00.000Z',
};

function entry(over: Partial<FoodEntry> = {}): FoodEntry {
  return {
    day: '2026-11-14',
    at: '2026-11-14T16:00:00.000Z',
    meal: 'snack',
    foodId: FOOD.id,
    label: 'Skyr',
    portion: '1 pot (150 g)',
    count: 1,
    unit: { kcal: 90, protein: 15 },
    method: 'list',
    ...over,
  };
}

describe('aliments', () => {
  it('retrouve un produit par son code-barres', async () => {
    const database = freshDb();
    await saveFood(FOOD, database);
    expect((await findFoodByBarcode('96385074', database))?.name).toBe('Skyr');
    expect(await findFoodByBarcode('3017620422003', database)).toBeUndefined();
  });

  it('garde l’usage et le favori quand le produit est réenregistré (nouveau scan)', async () => {
    const database = freshDb();
    await saveFood(FOOD, database);
    await setFavorite(FOOD.id, true, database);
    await addFoodEntry(entry(), database);
    await saveFood({ ...FOOD, name: 'Skyr nature' }, database);
    const f = await getFood(FOOD.id, database);
    expect(f?.name).toBe('Skyr nature');
    expect(f?.favorite).toBe(true);
    expect(f?.uses).toBe(1);
    expect(f?.lastUsedAt).toBe('2026-11-14T16:00:00.000Z');
  });
});

describe('journal alimentaire', () => {
  it('liste les entrées d’un jour dans l’ordre de saisie', async () => {
    const database = freshDb();
    await addFoodEntry(entry({ at: '2026-11-14T18:00:00.000Z', label: 'deux' }), database);
    await addFoodEntry(entry({ at: '2026-11-14T12:00:00.000Z', label: 'un' }), database);
    await addFoodEntry(entry({ day: '2026-11-15', label: 'lendemain' }), database);
    expect((await listFoodEntries('2026-11-14', database)).map((e) => e.label)).toEqual(['un', 'deux']);
  });

  it('une saisie libre (sans aliment) ne touche pas aux aliments', async () => {
    const database = freshDb();
    await addFoodEntry(entry({ foodId: undefined, method: 'free' }), database);
    expect(await database.foods.count()).toBe(0);
  });
});

describe('pesées', () => {
  it('une pesée par jour : la dernière remplace la précédente', async () => {
    const database = freshDb();
    await saveWeight({ day: '2026-11-14', at: '2026-11-14T07:00:00.000Z', kg: 80.4 }, database);
    await saveWeight({ day: '2026-11-14', at: '2026-11-14T07:05:00.000Z', kg: 80.2 }, database);
    await saveWeight({ day: '2026-11-13', at: '2026-11-13T07:00:00.000Z', kg: 80.6 }, database);
    expect((await listWeights(database)).map((w) => w.kg)).toEqual([80.6, 80.2]);
  });
});
