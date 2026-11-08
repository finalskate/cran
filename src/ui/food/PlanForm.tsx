/**
 * Saisie d'un plan « si… alors… » (J4B) : deux champs de texte. Utilisée dans le bilan (écrire
 * un plan au moment d'un écart) et dans « Mes plans » (modifier la liste).
 */
import { useState } from 'preact/hooks';
import { isCompletePlan } from '../../domain/habits';

interface Props {
  idPrefix: string;
  initial?: { when: string; then: string };
  submitLabel: string;
  onSubmit: (plan: { when: string; then: string }) => void;
  onCancel?: () => void;
}

export function PlanForm({ idPrefix, initial, submitLabel, onSubmit, onCancel }: Props) {
  const [when, setWhen] = useState(initial?.when ?? '');
  const [then, setThen] = useState(initial?.then ?? '');
  const plan = { when: when.trim(), then: then.trim() };
  return (
    <div class="plan-form">
      <div class="field">
        <label for={`${idPrefix}-when`}>Si…</label>
        <input id={`${idPrefix}-when`} type="text" autoComplete="off" placeholder="je rentre affamé" value={when} onInput={(e) => setWhen(e.currentTarget.value)} />
      </div>
      <div class="field">
        <label for={`${idPrefix}-then`}>… alors</label>
        <input
          id={`${idPrefix}-then`}
          type="text"
          autoComplete="off"
          placeholder="un skyr avant d’ouvrir les placards"
          value={then}
          onInput={(e) => setThen(e.currentTarget.value)}
        />
      </div>
      <div class="segmented">
        {onCancel && (
          <button type="button" class="btn btn--small" onClick={onCancel}>
            Annuler
          </button>
        )}
        <button type="button" class="btn btn--small btn--solid" disabled={!isCompletePlan(plan)} onClick={() => onSubmit(plan)}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/** Un plan, lu comme une phrase : « Si je rentre affamé → un skyr… ». */
export function PlanText({ when, then }: { when: string; then: string }) {
  return (
    <p class="plan-text">
      <span class="muted">Si</span> {when} <span class="accent">→</span> {then}
    </p>
  );
}
