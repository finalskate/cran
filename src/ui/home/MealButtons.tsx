/**
 * Les repas du jour sur l'accueil (« Noter vite », 21/11) : un bouton par repas principal,
 * celui du moment mis en avant tant qu'il n'est pas noté ; « + J'ai grignoté » à côté ; en
 * dessous, le total du jour (vers l'Assiette, où tout se corrige).
 */
import { QUICK_MEAL_BUTTON, QUICK_SIZE_LABEL } from '../../data/quickMeals';
import { sumEntries, type FoodEntry, type Meal } from '../../domain/nutrition';
import { currentQuickMeal, mealStatus, QUICK_MEALS, snackCount, type MealStatus } from '../../domain/quickMeal';
import { profile, targets } from '../foodState';
import { formatInt } from '../format';

interface Props {
  entries: FoodEntry[] | null | undefined;
  hour: number;
  cantine: boolean;
  onMeal: (meal: Meal) => void;
  onSnack: () => void;
}

/** Ce que le bouton dit sous le nom du repas. */
function statusText(s: MealStatus): string | null {
  switch (s.state) {
    case 'empty':
      return null;
    case 'skipped':
      return 'sauté';
    case 'quick':
      return `${QUICK_SIZE_LABEL[s.size].toLowerCase()}${s.veggies ? ' · légumes' : ''}`;
    case 'detailed':
      return `≈ ${formatInt(s.kcal)} kcal`;
  }
}

export function MealButtons({ entries, hour, cantine, onMeal, onSnack }: Props) {
  const list = entries ?? [];
  const now = currentQuickMeal(hour);
  const snacks = snackCount(list);
  const totals = sumEntries(list);
  const t = targets.value;
  return (
    <div class="meals">
      <div class="row" style={{ minHeight: 0 }}>
        <span class="day-card__name">{cantine ? 'Repas · mode cantine' : 'Repas'}</span>
        <button type="button" class="btn btn--small btn--quiet meals__snack" onClick={onSnack}>
          + J’ai grignoté{snacks > 0 ? ` (${snacks})` : ''}
        </button>
      </div>
      <div class="meals__grid">
        {QUICK_MEALS.map((meal) => {
          const s = entries ? mealStatus(list, meal) : { state: 'empty' as const };
          const sub = statusText(s);
          const empty = s.state === 'empty';
          const cls = `meal-btn${empty ? ' meal-btn--empty' : ''}${empty && meal === now ? ' meal-btn--now' : ''}`;
          return (
            <button key={meal} type="button" class={cls} onClick={() => onMeal(meal)}>
              <span class="meal-btn__name">
                {QUICK_MEAL_BUTTON[meal]}
                {empty ? ' ?' : ' ✓'}
              </span>
              {sub && <span class="meal-btn__sub">{sub}</span>}
            </button>
          );
        })}
      </div>
      <a class="meals__total" href="#/assiette">
        {cantine && list.length === 0
          ? '½ légumes, ¼ protéines, ¼ féculents'
          : !profile.value
            ? 'Calculer ma cible'
            : list.length === 0
              ? 'Saisie détaillée dans l’Assiette'
              : t
                ? `≈ ${formatInt(totals.kcal)} / ${formatInt(t.kcal)} kcal · ${formatInt(totals.protein)} / ${formatInt(t.protein)} g de protéines`
                : `≈ ${formatInt(totals.kcal)} kcal · ${formatInt(totals.protein)} g de protéines`}{' '}
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}
