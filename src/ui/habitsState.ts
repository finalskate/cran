/**
 * État partagé des habitudes alimentaires (J4B) : bilans du soir et plans « si… alors… ».
 * Relu au démarrage, mis à jour à chaque écriture : accueil et Assiette lisent la même chose.
 */
import { computed, signal } from '@preact/signals';
import { DEFAULT_PLANS } from '../data/habits';
import { listReviews, saveReview as storeReview } from '../data/habitsRepo';
import { listFoodEntriesBetween } from '../data/foodRepo';
import { getSetting, setSetting } from '../data/settings';
import { track } from '../data/usage';
import { addDays, dayKey } from '../domain/days';
import { PLAN_HISTORY_DAYS, planMoment, type CitedTrigger, type DailyReview, type IfThenPlan, type PlanMoment, type Trigger } from '../domain/habits';
import { foodDay } from '../domain/nutrition';
import { badNight } from '../domain/sleep';
import { nights } from './sleepState';
import { prefs, setPref } from './state';
import { activities } from './training';

/** Bilans, du plus ancien au plus récent. */
export const reviews = signal<DailyReview[]>([]);

/** Plans modifiés par l'utilisateur (null : jamais modifiés, on montre ceux de départ). */
const userPlans = signal<IfThenPlan[] | null>(null);

/** Plans en vigueur. */
export const plans = computed<readonly IfThenPlan[]>(() => userPlans.value ?? DEFAULT_PLANS);

/** Jours qui ont déjà leur bilan. */
export const reviewedDays = computed(() => new Set(reviews.value.map((r) => r.day)));

/** Déclencheurs notés avec un grignotage (« Noter vite », 21/11) ces 28 derniers jours. */
export const snackTriggers = signal<CitedTrigger[]>([]);

export async function loadHabitsState(): Promise<void> {
  const today = foodDay(new Date());
  const [list, saved, recent] = await Promise.all([listReviews(), getSetting('plans'), listFoodEntriesBetween(addDays(today, -PLAN_HISTORY_DAYS), today)]);
  reviews.value = list;
  userPlans.value = saved ?? null;
  snackTriggers.value = recent.flatMap((e) => (e.quick?.type === 'snack' && e.quick.trigger ? [{ day: e.day, trigger: e.quick.trigger }] : []));
}

/** Un grignotage vient d'être noté avec son déclencheur : il compte pour la rotation des plans. */
export function noteSnackTrigger(day: string, trigger: Trigger): void {
  snackTriggers.value = [...snackTriggers.value, { day, trigger }];
}

/** Enregistre un bilan. `via` : d'où il a été fait (journal d'usage). */
export async function recordReview(review: DailyReview, via: 'evening' | 'catch-up' | 'food'): Promise<void> {
  await storeReview(review);
  reviews.value = [...reviews.value.filter((r) => r.day !== review.day), review].sort((a, b) => a.day.localeCompare(b.day));
  track('review', {
    via,
    slip: review.slip,
    ...(review.trigger ? { trigger: review.trigger } : {}),
    protein: review.protein,
    proteinAuto: review.proteinAuto,
    veggies: review.veggies,
  });
}

/** Remplace toute la liste des plans (ajout, modification, suppression). */
export async function savePlans(next: IfThenPlan[], action: 'add' | 'edit' | 'delete'): Promise<void> {
  userPlans.value = next;
  await setSetting('plans', next);
  track('plan', { action, count: next.length });
}

// ─── Le plan au bon moment (retouche du 11/11) ───

/** Heure (ms) de la dernière saisie d'un vélotaf ou d'une séance de vélo, ou null. */
function lastRideAt(): number | null {
  let last: number | null = null;
  for (const a of activities.value) {
    if (a.type !== 'commute' && a.type !== 'bike') continue;
    const at = Date.parse(a.at);
    if (!Number.isNaN(at) && (last === null || at > last)) last = at;
  }
  return last;
}

/** Plan « si… alors… » à rappeler sur l'accueil maintenant (voir planMoment), ou null. */
export function planMomentNow(now: Date): PlanMoment | null {
  const tired = badNight(nights.value, dayKey(now));
  return planMoment(now, plans.value, reviews.value, lastRideAt(), new Set(prefs.value.planMomentsSeen), { badNight: tired, cited: snackTriggers.value });
}

/** « Vu » : ce moment ne revient pas aujourd'hui. Ne garde que les clés d'hier et d'aujourd'hui. */
export async function dismissPlanMoment(moment: PlanMoment, now = new Date()): Promise<void> {
  const keep = addDays(foodDay(now), -1);
  const seen = prefs.value.planMomentsSeen.filter((k) => k.slice(0, 10) >= keep);
  await setPref('planMomentsSeen', [...seen, moment.key]);
  track('plan-moment', { slot: moment.slot, action: 'seen' });
}
