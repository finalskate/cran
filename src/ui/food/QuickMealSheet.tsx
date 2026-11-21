/**
 * Panneau « Noter vite » d'un repas (21/11, maquette validée) :
 *  - en haut, les repas habituels de ce moment, en un geste (vraies valeurs recopiées) ;
 *  - sinon le type de repas, puis la quantité (« Normal » déjà choisi : deux gestes suffisent),
 *    et en option légumes et protéines ; la fourchette estimée se met à jour ;
 *  - « Sauté » pour un repas qu'on n'a pas pris ; « Saisie détaillée » mène à l'Assiette.
 * Noter de nouveau un repas remplace sa saisie rapide précédente (jamais une saisie détaillée).
 */
import { useState } from 'preact/hooks';
import { QUICK_KIND_LABEL, QUICK_MEAL_TITLE, QUICK_SIZE_LABEL, QUICK_TABLE } from '../../data/quickMeals';
import { foodDay, type Meal } from '../../domain/nutrition';
import { habitualMeals, mealStatus, QUICK_KINDS, QUICK_SIZES, quickEstimate, type QuickKind, type QuickSize } from '../../domain/quickMeal';
import { Sheet } from '../components/Sheet';
import { useDayEntries } from '../foodState';
import { formatInt } from '../format';
import { go } from '../router';
import { recordHabit, recordQuickMeal, useRecentEntries } from './quick';

export function QuickMealSheet({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const now = new Date();
  const today = foodDay(now);
  const recent = useRecentEntries(now);
  const dayEntries = useDayEntries(today);
  const habits = recent ? habitualMeals(recent, meal, today) : [];
  const status = dayEntries ? mealStatus(dayEntries, meal) : null;

  const [kind, setKind] = useState<QuickKind | null>(null);
  const [size, setSize] = useState<QuickSize>('normal');
  const [veggies, setVeggies] = useState(false);
  const [protein, setProtein] = useState(false);
  const [busy, setBusy] = useState(false);

  const estimate = kind ? quickEstimate(QUICK_TABLE, kind, size, meal, protein || undefined) : null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={QUICK_MEAL_TITLE[meal]}
      kicker="Noter vite"
      footer={
        <button
          type="button"
          class="cta cta--compact"
          disabled={!kind || busy}
          onClick={() =>
            kind &&
            void run(() => recordQuickMeal(meal, { type: 'meal', kind, size, ...(veggies ? { veggies: true } : {}), ...(protein ? { protein: true } : {}) }))
          }
        >
          <span class="cta__title">Noter</span>
        </button>
      }
    >
      {status?.state === 'detailed' && (
        <p class="muted quick__note">Déjà noté en détail (≈ {formatInt(status.kcal)} kcal) : ce que tu notes ici s’ajoute.</p>
      )}
      {(status?.state === 'quick' || status?.state === 'skipped') && <p class="muted quick__note">Déjà noté : ce que tu notes ici le remplace.</p>}

      {habits.length > 0 && (
        <section class="quick__group" aria-labelledby="qm-habits">
          <span id="qm-habits" class="quick__label">
            Comme d’habitude, en un geste
          </span>
          <div class="quick__habits">
            {habits.map((h) => (
              <button key={h.key} type="button" class="btn quick__habit" disabled={busy} onClick={() => void run(() => recordHabit(meal, h))}>
                <span>{h.label}</span>
                <span class="muted num">≈ {formatInt(h.total.kcal)} kcal</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section class="quick__group" aria-labelledby="qm-kind">
        <span id="qm-kind" class="quick__label">
          {habits.length > 0 ? 'Sinon : c’était quoi ?' : 'C’était quoi ?'}
        </span>
        <div class="quick__grid" role="group" aria-labelledby="qm-kind">
          {QUICK_KINDS.map((k) => (
            <button key={k} type="button" class="btn" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {QUICK_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </section>

      <section class="quick__group" aria-labelledby="qm-size">
        <span id="qm-size" class="quick__label">
          Quelle quantité ?
        </span>
        <div class="segmented" role="group" aria-labelledby="qm-size">
          {QUICK_SIZES.map((s) => (
            <button key={s} type="button" class="btn" aria-pressed={size === s} onClick={() => setSize(s)}>
              {QUICK_SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      <section class="quick__group" aria-labelledby="qm-with">
        <span id="qm-with" class="quick__label">
          Il y avait (facultatif)
        </span>
        <div class="quick__toggles">
          <button type="button" class="btn btn--small quick__toggle quick__toggle--veg" aria-pressed={veggies} onClick={() => setVeggies(!veggies)}>
            Légumes{veggies ? ' ✓' : ''}
          </button>
          <button type="button" class="btn btn--small quick__toggle" aria-pressed={protein} onClick={() => setProtein(!protein)}>
            Viande, poisson, œufs{protein ? ' ✓' : ''}
          </button>
        </div>
      </section>

      <div class="quick__footer-row">
        <span class="muted" aria-live="polite">
          {estimate ? (
            <>
              Estimé : <strong class="num quick__estimate">{formatInt(estimate.low)} à {formatInt(estimate.high)} kcal</strong> · ~{estimate.protein} g de protéines
            </>
          ) : (
            'Choisis le type de repas.'
          )}
        </span>
      </div>
      <div class="quick__footer-row">
        <button type="button" class="btn btn--small btn--quiet" disabled={busy} onClick={() => void run(() => recordQuickMeal(meal, { type: 'skip' }))}>
          Repas sauté
        </button>
        <button
          type="button"
          class="btn btn--small btn--quiet"
          onClick={() => {
            onClose();
            go('food');
          }}
        >
          Saisie détaillée →
        </button>
      </div>
    </Sheet>
  );
}
