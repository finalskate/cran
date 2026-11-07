/**
 * État partagé de l'alimentation et de la pesée (J4 phase A) : profil, pesées, cible du jour,
 * et lecture du journal d'un jour. Les écrans Accueil et Assiette s'en servent tous les deux.
 */
import { computed, signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { dayKey } from '../domain/days';
import {
  computeTargets,
  latestWeight,
  roundWeight,
  type FoodEntry,
  type Profile,
  type WeightEntry,
} from '../domain/nutrition';
import { addFoodEntry, deleteFoodEntry, listFoodEntries, listWeights, saveWeight, updateFoodEntry } from '../data/foodRepo';
import { getSetting, setSetting } from '../data/settings';
import { track } from '../data/usage';

/** Profil saisi (null tant que la cible n'a pas été calculée). */
export const profile = signal<Profile | null>(null);

/** Premier jour de la calibration (null avant la création du profil). */
export const calibrationStart = signal<string | null>(null);

/** Toutes les pesées, de la plus ancienne à la plus récente (quelques centaines au plus). */
export const weights = signal<WeightEntry[]>([]);

/** Incrémenté à chaque changement du journal alimentaire : les écrans relisent leurs entrées. */
export const foodTick = signal(0);

/** Cible du jour : recalculée avec la dernière pesée (le poids du profil sert en attendant). */
export const targets = computed(() => {
  const p = profile.value;
  if (!p) return null;
  return computeTargets(p, latestWeight(weights.value)?.kg ?? p.weightKg, new Date().getFullYear());
});

/** Relit profil et pesées depuis la base (au démarrage). */
export async function loadFoodState(): Promise<void> {
  const [p, start, w] = await Promise.all([getSetting('profile'), getSetting('calibrationStart'), listWeights()]);
  profile.value = p ?? null;
  calibrationStart.value = start ?? null;
  weights.value = w;
}

/** Enregistre le profil ; la calibration démarre le jour de la première saisie. */
export async function saveProfile(next: Profile): Promise<void> {
  profile.value = next;
  await setSetting('profile', next);
  if (!calibrationStart.value) {
    const start = dayKey(new Date());
    calibrationStart.value = start;
    await setSetting('calibrationStart', start);
  }
}

/** Note la pesée du jour (remplace celle du même jour). */
export async function recordWeight(kg: number, at = new Date()): Promise<void> {
  const entry: WeightEntry = { day: dayKey(at), at: at.toISOString(), kg: roundWeight(kg) };
  await saveWeight(entry);
  weights.value = [...weights.value.filter((w) => w.day !== entry.day), entry].sort((a, b) => a.day.localeCompare(b.day));
  track('weigh', { morning: at.getHours() < 11 });
}

// ─── Journal alimentaire ───

export async function logEntry(entry: FoodEntry): Promise<void> {
  await addFoodEntry(entry);
  foodTick.value++;
}

export async function editEntry(id: number, changes: Partial<FoodEntry>): Promise<void> {
  await updateFoodEntry(id, changes);
  track('food-edit', { action: 'update' });
  foodTick.value++;
}

export async function removeEntry(id: number): Promise<void> {
  await deleteFoodEntry(id);
  track('food-edit', { action: 'delete' });
  foodTick.value++;
}

/** Entrées d'un jour, relues à chaque changement du journal (null pendant la lecture). */
export function useDayEntries(day: string): FoodEntry[] | null {
  const [entries, setEntries] = useState<FoodEntry[] | null>(null);
  const tick = foodTick.value;
  useEffect(() => {
    let alive = true;
    void listFoodEntries(day).then((list) => alive && setEntries(list));
    return () => {
      alive = false;
    };
  }, [day, tick]);
  return entries;
}
