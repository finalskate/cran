/**
 * « Noter vite » côté interface (21/11) : enregistre une saisie rapide, un repas habituel ou un
 * grignotage dans le journal alimentaire. La logique (estimations, remplacements, repas
 * habituels) est dans src/domain/quickMeal.ts ; ici, on écrit et on prévient l'appli.
 */
import { useEffect, useState } from 'preact/hooks';
import { addFoodEntry, deleteFoodEntry, listFoodEntries, listFoodEntriesBetween } from '../../data/foodRepo';
import { QUICK_KIND_LABEL, QUICK_SIZE_LABEL, QUICK_TABLE, SNACK_SIZE_LABEL, SNACK_TASTE_LABEL } from '../../data/quickMeals';
import { track } from '../../data/usage';
import { addDays } from '../../domain/days';
import { foodDay, type FoodEntry, type Meal } from '../../domain/nutrition';
import { HABIT_DAYS, quickEstimate, replacedByQuick, snackEstimate, type HabitualMeal, type QuickInfo } from '../../domain/quickMeal';
import { foodTick } from '../foodState';
import { noteSnackTrigger } from '../habitsState';

/** Portion affichée dans l'Assiette pour une saisie rapide. */
const QUICK_PORTION = 'estimation rapide';

/** Efface la saisie rapide précédente du repas (une nouvelle la remplace). */
async function clearQuick(day: string, meal: Meal): Promise<void> {
  for (const e of replacedByQuick(await listFoodEntries(day), meal)) if (e.id !== undefined) await deleteFoodEntry(e.id);
}

async function add(entry: FoodEntry): Promise<void> {
  await addFoodEntry(entry);
  foodTick.value++;
}

/** Repas noté vite : type et quantité (avec légumes, protéines), ou sauté. */
export async function recordQuickMeal(meal: Meal, info: Extract<QuickInfo, { type: 'meal' } | { type: 'skip' }>, now = new Date()): Promise<void> {
  const day = foodDay(now);
  await clearQuick(day, meal);
  if (info.type === 'skip') {
    await add({ day, at: now.toISOString(), meal, label: 'Repas sauté', portion: '—', count: 1, unit: { kcal: 0, protein: 0 }, method: 'quick', quick: info });
    track('quick-meal', { meal, via: 'skip' });
    return;
  }
  const est = quickEstimate(QUICK_TABLE, info.kind, info.size, meal, info.protein);
  const label = [QUICK_KIND_LABEL[info.kind], QUICK_SIZE_LABEL[info.size].toLowerCase(), info.veggies ? 'légumes' : null].filter(Boolean).join(' · ');
  await add({ day, at: now.toISOString(), meal, label, portion: QUICK_PORTION, count: 1, unit: { kcal: est.kcal, protein: est.protein }, method: 'quick', quick: info });
  track('quick-meal', {
    meal,
    via: 'kind',
    kind: info.kind,
    size: info.size,
    ...(info.veggies !== undefined ? { veggies: info.veggies } : {}),
    ...(info.protein !== undefined ? { protein: info.protein } : {}),
  });
}

/** Repas habituel : ses lignes recopiées avec leurs vraies valeurs. */
export async function recordHabit(meal: Meal, habit: HabitualMeal, now = new Date()): Promise<void> {
  const day = foodDay(now);
  await clearQuick(day, meal);
  for (const e of habit.entries) await addFoodEntry({ ...e, day, at: now.toISOString(), meal, method: 'habit' });
  foodTick.value++;
  track('quick-meal', { meal, via: 'habit', items: habit.entries.length, times: habit.times });
}

/** Grignotage : taille, et en option ce que c'était et ce qui l'a déclenché. */
export async function recordSnack(info: Extract<QuickInfo, { type: 'snack' }>, now = new Date()): Promise<void> {
  const day = foodDay(now);
  const est = snackEstimate(QUICK_TABLE, info.size);
  const label = ['Grignotage', SNACK_SIZE_LABEL[info.size].toLowerCase(), info.taste ? SNACK_TASTE_LABEL[info.taste].toLowerCase() : null].filter(Boolean).join(' · ');
  await add({ day, at: now.toISOString(), meal: 'snack', label, portion: QUICK_PORTION, count: 1, unit: { kcal: est.kcal, protein: est.protein }, method: 'quick', quick: info });
  if (info.trigger) noteSnackTrigger(day, info.trigger);
  track('snack', { size: info.size, ...(info.taste ? { taste: info.taste } : {}), ...(info.trigger ? { trigger: info.trigger } : {}) });
}

/** Entrées des HABIT_DAYS derniers jours (repas habituels), relues à chaque changement du journal. */
export function useRecentEntries(now = new Date()): FoodEntry[] | null {
  const today = foodDay(now);
  const [entries, setEntries] = useState<FoodEntry[] | null>(null);
  const tick = foodTick.value;
  useEffect(() => {
    let alive = true;
    void listFoodEntriesBetween(addDays(today, -(HABIT_DAYS - 1)), today).then((list) => alive && setEntries(list));
    return () => {
      alive = false;
    };
  }, [today, tick]);
  return entries;
}
