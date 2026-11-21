/**
 * « J'ai grignoté » (21/11) : la taille, et en option ce que c'était et ce qui l'a déclenché.
 * Le déclencheur choisi affiche aussitôt le plan « si… alors… » qui va avec (comme le bilan du
 * soir), et compte pour la rotation des plans de la journée. Jamais de reproche : un grignotage
 * se note comme un repas.
 */
import { useState } from 'preact/hooks';
import { TRIGGER_LABEL } from '../../data/habits';
import { QUICK_TABLE, SNACK_SIZE_LABEL, SNACK_TASTE_LABEL } from '../../data/quickMeals';
import { plansFor, TRIGGERS, type Trigger } from '../../domain/habits';
import { SNACK_SIZES, SNACK_TASTES, snackEstimate, type SnackSize, type SnackTaste } from '../../domain/quickMeal';
import { Sheet } from '../components/Sheet';
import { formatInt } from '../format';
import { plans } from '../habitsState';
import { PlanText } from './PlanForm';
import { recordSnack } from './quick';

export function SnackSheet({ onClose }: { onClose: () => void }) {
  const [size, setSize] = useState<SnackSize | null>(null);
  const [taste, setTaste] = useState<SnackTaste | null>(null);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [busy, setBusy] = useState(false);
  const estimate = size ? snackEstimate(QUICK_TABLE, size) : null;
  const triggerPlans = trigger ? plansFor(plans.value, trigger) : [];

  async function save() {
    if (!size) return;
    setBusy(true);
    try {
      await recordSnack({ type: 'snack', size, ...(taste ? { taste } : {}), ...(trigger ? { trigger } : {}) });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Un grignotage"
      kicker="Noter vite"
      footer={
        <button type="button" class="cta cta--compact" disabled={!size || busy} onClick={() => void save()}>
          <span class="cta__title">Noter</span>
        </button>
      }
    >
      <section class="quick__group" aria-labelledby="sn-size">
        <span id="sn-size" class="quick__label">
          Combien ?
        </span>
        <div class="segmented" role="group" aria-labelledby="sn-size">
          {SNACK_SIZES.map((s) => (
            <button key={s} type="button" class="btn" aria-pressed={size === s} onClick={() => setSize(s)}>
              {SNACK_SIZE_LABEL[s]}
            </button>
          ))}
        </div>
        <span class="muted quick__hint">Petit : une poignée, un biscuit · Moyen : un paquet individuel · Gros : un bol, une part de gâteau</span>
      </section>

      <section class="quick__group" aria-labelledby="sn-taste">
        <span id="sn-taste" class="quick__label">
          C’était (facultatif)
        </span>
        <div class="segmented" role="group" aria-labelledby="sn-taste">
          {SNACK_TASTES.map((t) => (
            <button key={t} type="button" class="btn btn--small" aria-pressed={taste === t} onClick={() => setTaste(taste === t ? null : t)}>
              {SNACK_TASTE_LABEL[t]}
            </button>
          ))}
        </div>
      </section>

      <section class="quick__group" aria-labelledby="sn-trigger">
        <span id="sn-trigger" class="quick__label">
          Ce qui t’y a poussé (facultatif)
        </span>
        <div class="segmented segmented--grid" role="group" aria-labelledby="sn-trigger">
          {TRIGGERS.map((t) => (
            <button key={t} type="button" class="btn btn--small" aria-pressed={trigger === t} onClick={() => setTrigger(trigger === t ? null : t)}>
              {TRIGGER_LABEL[t]}
            </button>
          ))}
        </div>
        {triggerPlans.length > 0 && (
          <div class="plan-box">
            <span class="card__label">Ton plan, la prochaine fois</span>
            {triggerPlans.map((p) => (
              <PlanText key={p.id} when={p.when} then={p.then} />
            ))}
          </div>
        )}
      </section>

      {estimate && (
        <p class="muted" style={{ margin: 0 }}>
          Estimé : <strong class="num quick__estimate">{formatInt(estimate.low)} à {formatInt(estimate.high)} kcal</strong>
        </p>
      )}
    </Sheet>
  );
}
