/**
 * État partagé des habitudes alimentaires (J4B) : bilans du soir et plans « si… alors… ».
 * Relu au démarrage, mis à jour à chaque écriture : accueil et Assiette lisent la même chose.
 */
import { computed, signal } from '@preact/signals';
import { DEFAULT_PLANS } from '../data/habits';
import { listReviews, saveReview as storeReview } from '../data/habitsRepo';
import { getSetting, setSetting } from '../data/settings';
import { track } from '../data/usage';
import type { DailyReview, IfThenPlan } from '../domain/habits';

/** Bilans, du plus ancien au plus récent. */
export const reviews = signal<DailyReview[]>([]);

/** Plans modifiés par l'utilisateur (null : jamais modifiés, on montre ceux de départ). */
const userPlans = signal<IfThenPlan[] | null>(null);

/** Plans en vigueur. */
export const plans = computed<readonly IfThenPlan[]>(() => userPlans.value ?? DEFAULT_PLANS);

/** Jours qui ont déjà leur bilan. */
export const reviewedDays = computed(() => new Set(reviews.value.map((r) => r.day)));

export async function loadHabitsState(): Promise<void> {
  const [list, saved] = await Promise.all([listReviews(), getSetting('plans')]);
  reviews.value = list;
  userPlans.value = saved ?? null;
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
