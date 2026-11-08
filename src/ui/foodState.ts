/**
 * État partagé de l'alimentation et de la pesée (J4 phase A) : profil, pesées, cible du jour,
 * lecture du journal d'un jour, et ajustement adaptatif de la cible. Les écrans Accueil et
 * Assiette s'en servent tous les deux.
 */
import { computed, signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import {
  adjustmentWindow,
  adoptedExpenditure,
  computeAdjustment,
  type Adjustment,
  type AdjustmentRecord,
  type DayOverride,
} from '../domain/adaptive';
import { dayKey } from '../domain/days';
import {
  computeTargets,
  DEFICIT_KCAL,
  entryNutrients,
  foodDay,
  KCAL_FLOOR,
  latestWeight,
  proteinPerKg,
  roundWeight,
  type FoodEntry,
  type Profile,
  type WeightEntry,
} from '../domain/nutrition';
import {
  addFoodEntry,
  deleteFoodEntry,
  listFoodEntries,
  listFoodEntriesBetween,
  listWeights,
  saveWeight,
  updateFoodEntry,
} from '../data/foodRepo';
import { getSetting, setSetting } from '../data/settings';
import { track } from '../data/usage';
// Import circulaire assumé (state importe aussi ce module) : `prefs` n'est lu que dans `computed`.
import { prefs } from './state';

/** Profil saisi (null tant que la cible n'a pas été calculée). */
export const profile = signal<Profile | null>(null);

/** Premier jour de la calibration (null avant la création du profil). */
export const calibrationStart = signal<string | null>(null);

/** Toutes les pesées, de la plus ancienne à la plus récente (quelques centaines au plus). */
export const weights = signal<WeightEntry[]>([]);

/** Incrémenté à chaque changement du journal alimentaire : les écrans relisent leurs entrées. */
export const foodTick = signal(0);

/** Journées comptées ou mises de côté à la main (ajustement adaptatif). */
export const dayOverrides = signal<Record<string, DayOverride>>({});

/** Décisions d'ajustement de la cible. */
export const adjustments = signal<AdjustmentRecord[]>([]);

/**
 * Cible du jour : recalculée avec la dernière pesée (le poids du profil sert en attendant), et
 * avec la dépense mesurée si un ajustement a été accepté.
 */
export const targets = computed(() => {
  const p = profile.value;
  if (!p) return null;
  return computeTargets(
    p,
    latestWeight(weights.value)?.kg ?? p.weightKg,
    new Date().getFullYear(),
    adoptedExpenditure(adjustments.value),
    proteinPerKg(prefs.value.focus),
  );
});

/** Relit profil, pesées et ajustements depuis la base (au démarrage). */
export async function loadFoodState(): Promise<void> {
  const [p, start, w, overrides, adj] = await Promise.all([
    getSetting('profile'),
    getSetting('calibrationStart'),
    listWeights(),
    getSetting('dayOverrides'),
    getSetting('adjustments'),
  ]);
  profile.value = p ?? null;
  calibrationStart.value = start ?? null;
  weights.value = w;
  dayOverrides.value = overrides ?? {};
  adjustments.value = adj ?? [];
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

// ─── Ajustement adaptatif ───

/** Compte ou met de côté une journée pour l'ajustement (`undefined` : retour au choix automatique). */
export async function setDayOverride(day: string, value: DayOverride | undefined): Promise<void> {
  const next = { ...dayOverrides.value };
  if (value) next[day] = value;
  else delete next[day];
  dayOverrides.value = next;
  await setSetting('dayOverrides', next);
  track('day-count', { value: value ?? 'auto' });
}

/** Proposition d'ajustement en attente, avec sa période. */
export interface PendingAdjustment {
  from: string;
  to: string;
  result: Adjustment;
}

/**
 * Proposition d'ajustement du jour, ou `null` s'il n'est pas encore temps (calibration en
 * cours, décision prise il y a moins de 14 jours). Recalculée quand le journal, les pesées ou
 * les choix de journées changent.
 */
export function usePendingAdjustment(): PendingAdjustment | null {
  const [pending, setPending] = useState<PendingAdjustment | null>(null);
  const start = calibrationStart.value;
  const t = targets.value;
  const p = profile.value;
  const last = adjustments.value.at(-1)?.day;
  const tick = foodTick.value;
  const w = weights.value;
  const overrides = dayOverrides.value;
  const today = foodDay(new Date());
  const period = start ? adjustmentWindow(start, today, last) : null;

  useEffect(() => {
    if (!period || !t || !p) {
      setPending(null);
      return;
    }
    let alive = true;
    void listFoodEntriesBetween(period.from, period.to).then((entries) => {
      const dayKcal: Record<string, number> = {};
      for (const e of entries) dayKcal[e.day] = (dayKcal[e.day] ?? 0) + entryNutrients(e).kcal;
      const result = computeAdjustment({
        ...period,
        dayKcal,
        overrides,
        weights: w,
        expenditure: t.expenditure,
        currentKcal: t.kcal,
        floor: KCAL_FLOOR[p.sex],
      });
      if (alive) setPending({ ...period, result });
    });
    return () => {
      alive = false;
    };
  }, [period?.from, period?.to, t?.kcal, t?.expenditure, p?.sex, tick, w, overrides]);

  return pending;
}

/** Accepte ou refuse la cible proposée ; le prochain point aura lieu dans 14 jours. */
export async function decideAdjustment(proposedKcal: number, decision: 'accepted' | 'declined'): Promise<void> {
  const t = targets.value;
  if (!t) return;
  const record: AdjustmentRecord = {
    day: foodDay(new Date()),
    decision,
    kcalBefore: t.kcal,
    kcalAfter: decision === 'accepted' ? proposedKcal : t.kcal,
    // La dépense retenue est celle qui donne la cible adoptée (garde-fous compris).
    expenditure: decision === 'accepted' ? proposedKcal + DEFICIT_KCAL : t.expenditure,
  };
  const next = [...adjustments.value, record];
  adjustments.value = next;
  await setSetting('adjustments', next);
  track('adjust', { decision, before: record.kcalBefore, after: record.kcalAfter });
}

