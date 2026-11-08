/**
 * Bilan du soir en 30 secondes (J4B, SPEC §4.8 phase B) : protéines, légumes, écart et, s'il y
 * en a eu un, son déclencheur.
 *
 * - Les protéines se déduisent des entrées notées dans l'Assiette (on continue de noter après la
 *   calibration) : la question n'est posée que si rien n'a été noté ce jour-là.
 * - Au moment où un déclencheur est choisi, le plan « si… alors… » correspondant s'affiche ; s'il
 *   n'y en a pas, on peut en écrire un sur place.
 * - Jamais de reproche : un écart se note comme le reste, le message qui suit parle de la suite.
 *
 * Le bilan d'un jour peut être refait : il remplace le précédent.
 */
import { useState } from 'preact/hooks';
import { REVIEW_CLEAN, REVIEW_SLIP } from '../../data/messages';
import { TRIGGER_LABEL } from '../../data/habits';
import {
  plansFor,
  proteinFromEntries,
  TRIGGERS,
  type IfThenPlan,
  type ProteinAnswer,
  type Slip,
  type Trigger,
} from '../../domain/habits';
import { dailyMessage } from '../../domain/messages';
import { foodDay } from '../../domain/nutrition';
import { Sheet } from '../components/Sheet';
import { targets, useDayEntries } from '../foodState';
import { formatInt, MEAL_LABEL, relativeDayLabel } from '../format';
import { plans, recordReview, reviews, savePlans } from '../habitsState';
import { PlanForm, PlanText } from './PlanForm';

const PROTEIN_CHOICES: { value: ProteinAnswer; label: string }[] = [
  { value: 'yes', label: 'Oui' },
  { value: 'partly', label: 'En partie' },
  { value: 'no', label: 'Non' },
];

const SLIP_CHOICES: { value: Slip; label: string }[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'small', label: 'Petit' },
  { value: 'big', label: 'Gros' },
];

interface Props {
  day: string;
  via: 'evening' | 'catch-up' | 'food';
  onClose: () => void;
}

export function ReviewSheet({ day, via, onClose }: Props) {
  const existing = reviews.value.find((r) => r.day === day);
  const entries = useDayEntries(day);
  const check = entries ? proteinFromEntries(entries, targets.value?.protein) : null;

  const [protein, setProtein] = useState<ProteinAnswer | null>(existing && !existing.proteinAuto ? existing.protein : null);
  const [veggies, setVeggies] = useState<boolean | null>(existing?.veggies ?? null);
  const [slip, setSlip] = useState<Slip | null>(existing?.slip ?? null);
  const [trigger, setTrigger] = useState<Trigger | null>(existing?.trigger ?? null);
  const [writing, setWriting] = useState(false);
  const [saved, setSaved] = useState(false);

  const today = foodDay(new Date());
  const proteinValue = check ? check.answer : protein;
  const ready = proteinValue !== null && veggies !== null && slip !== null && (slip === 'none' || trigger !== null);
  const triggerPlans = trigger ? plansFor(plans.value, trigger) : [];

  async function save() {
    if (!ready) return;
    await recordReview(
      {
        day,
        at: new Date().toISOString(),
        protein: proteinValue!,
        proteinAuto: !!check,
        veggies: veggies!,
        slip: slip!,
        ...(slip !== 'none' && trigger ? { trigger } : {}),
      },
      via,
    );
    setSaved(true);
  }

  async function addPlan(plan: { when: string; then: string }) {
    const next: IfThenPlan = { id: crypto.randomUUID(), trigger: trigger!, ...plan };
    await savePlans([...plans.value, next], 'add');
    setWriting(false);
  }

  if (saved) {
    const pool = slip === 'none' ? REVIEW_CLEAN : REVIEW_SLIP;
    return (
      <Sheet
        open
        onClose={onClose}
        title="Bilan noté ✓"
        kicker={relativeDayLabel(day, today)}
        footer={
          <button type="button" class="cta cta--compact" onClick={onClose}>
            <span class="cta__title">Fermer</span>
          </button>
        }
      >
        <p class="sheet__lead">{dailyMessage(pool, day, slip === 'none' ? 'review-clean' : 'review-slip')}</p>
        {slip !== 'none' && triggerPlans.length > 0 && (
          <section class="plan-box" aria-label="Ton plan">
            <span class="card__label">La prochaine fois</span>
            {triggerPlans.map((p) => (
              <PlanText key={p.id} when={p.when} then={p.then} />
            ))}
          </section>
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={day === today ? 'Bilan de ta journée' : 'Bilan d’hier'}
      kicker={day === today || via !== 'food' ? '30 secondes' : relativeDayLabel(day, today)}
      footer={
        <button type="button" class="cta cta--compact" disabled={!ready} onClick={() => void save()}>
          <span class="cta__title">{existing ? 'Mettre à jour' : 'Noter le bilan'}</span>
        </button>
      }
    >
      <section class="review-q" aria-labelledby="rv-protein">
        <span id="rv-protein" class="card__label">
          Protéines
        </span>
        {check ? (
          <>
            <p class="review-auto">
              <strong class="num">{formatInt(check.total)} g</strong>
              {targets.value && <span class="muted num"> sur {formatInt(targets.value.protein)}</span>}
              {check.meals.length > 0 && (
                <span class="muted">
                  {' · '}
                  {check.meals.map((m) => `${MEAL_LABEL[m.meal].toLowerCase()} ${m.protein} g${m.ok ? ' ✓' : ''}`).join(' · ')}
                </span>
              )}
            </p>
            <span class="muted review-note">D’après ce que tu as noté.</span>
          </>
        ) : (
          <>
            <span class="muted review-note">Une portion de viande, poisson, œufs ou laitage à chaque repas ?</span>
            <div class="segmented" role="radiogroup" aria-labelledby="rv-protein">
              {PROTEIN_CHOICES.map((c) => (
                <button key={c.value} type="button" class="btn btn--small" role="radio" aria-checked={protein === c.value} onClick={() => setProtein(c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section class="review-q" aria-labelledby="rv-veggies">
        <span id="rv-veggies" class="card__label">
          Des légumes aujourd’hui ?
        </span>
        <div class="segmented" role="radiogroup" aria-labelledby="rv-veggies">
          {[
            [true, 'Oui'],
            [false, 'Non'],
          ].map(([value, label]) => (
            <button key={label} type="button" class="btn btn--small" role="radio" aria-checked={veggies === value} onClick={() => setVeggies(value as boolean)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section class="review-q" aria-labelledby="rv-slip">
        <span id="rv-slip" class="card__label">
          Un écart ?
        </span>
        <div class="segmented" role="radiogroup" aria-labelledby="rv-slip">
          {SLIP_CHOICES.map((c) => (
            <button key={c.value} type="button" class="btn btn--small" role="radio" aria-checked={slip === c.value} onClick={() => setSlip(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {slip !== null && slip !== 'none' && (
        <section class="review-q" aria-labelledby="rv-trigger">
          <span id="rv-trigger" class="card__label">
            Qu’est-ce qui l’a déclenché ?
          </span>
          <div class="segmented segmented--grid" role="radiogroup" aria-labelledby="rv-trigger">
            {TRIGGERS.map((t) => (
              <button
                key={t}
                type="button"
                class="btn btn--small"
                role="radio"
                aria-checked={trigger === t}
                onClick={() => {
                  setTrigger(t);
                  setWriting(false);
                }}
              >
                {TRIGGER_LABEL[t]}
              </button>
            ))}
          </div>

          {trigger && (
            <div class="plan-box">
              {triggerPlans.length > 0 ? (
                <>
                  <span class="card__label">Ton plan</span>
                  {triggerPlans.map((p) => (
                    <PlanText key={p.id} when={p.when} then={p.then} />
                  ))}
                </>
              ) : writing ? (
                <PlanForm idPrefix="rv-plan" submitLabel="Garder ce plan" onSubmit={(p) => void addPlan(p)} onCancel={() => setWriting(false)} />
              ) : (
                <div class="row" style={{ minHeight: 0 }}>
                  <span class="muted">Pas encore de plan pour ça.</span>
                  <button type="button" class="btn btn--small btn--quiet" onClick={() => setWriting(true)}>
                    En écrire un
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </Sheet>
  );
}
