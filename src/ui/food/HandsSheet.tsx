/**
 * Estimation d'une assiette sans balance, avec les repères de la main (SPEC §4.8) : cantine,
 * restaurant, plat du cuisinier. Une assiette type est pré-remplie (une mesure de chaque) :
 * on ajuste en deux ou trois gestes, on ajoute les à-côtés (pain, fromage, dessert).
 */
import { useState } from 'preact/hooks';
import { describeHands, formatCount, handEstimate, mealForTime, type Meal } from '../../domain/nutrition';
import { DEFAULT_PLATE, HAND_MEASURES, PLATE_EXTRAS } from '../../data/portions';
import { track } from '../../data/usage';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { logEntry } from '../foodState';
import { MEAL_LABEL } from '../format';
import { isPastDay, makeEntry, MealPicker, NutrientsLine } from './common';

const ALL = [...HAND_MEASURES, ...PLATE_EXTRAS];

export function HandsSheet({ day, onClose }: { day: string; onClose: () => void }) {
  const [counts, setCounts] = useState<Record<string, number>>({ ...DEFAULT_PLATE });
  const [meal, setMeal] = useState<Meal>(mealForTime(new Date()));
  const [label, setLabel] = useState('');
  const total = handEstimate(counts, ALL);
  // Mise à jour fonctionnelle : deux appuis très rapprochés ne s'écrasent pas.
  const set = (id: string, n: number) => setCounts((c) => ({ ...c, [id]: n }));

  async function add() {
    const name = label.trim() || `Assiette du ${MEAL_LABEL[meal].toLowerCase()}`;
    // Une seule entrée « assiette » : on la retrouve telle quelle dans le journal.
    await logEntry(makeEntry(day, meal, name, describeHands(counts, ALL) || 'estimée', 1, total, 'hands'));
    track('food-add', { method: 'hands', meal, past: isPastDay(day) });
    onClose();
  }

  const row = (m: (typeof ALL)[number], extra: boolean) => (
    <div key={m.id} class="hand-row">
      <div class="hand-row__text">
        <span class="hand-row__name">
          {m.label}
          {!extra && <span class="muted"> · {m.hand}</span>}
        </span>
        {m.examples && <span class="muted hand-row__hint">{m.examples}</span>}
      </div>
      <Stepper label={m.label} value={counts[m.id] ?? 0} onChange={(n) => set(m.id, n)} step={0.5} min={0} max={6} format={formatCount} />
    </div>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title="Estimer une assiette"
      kicker="Repères de la main"
      footer={
        <>
          <NutrientsLine value={total} />
          <button type="button" class="cta cta--compact" disabled={total.kcal === 0} onClick={() => void add()}>
            <span class="cta__title">Ajouter</span>
          </button>
        </>
      }
    >
      <p class="muted sheet__lead">Compare chaque partie de l’assiette à ta main. Pas besoin d’être précis : sois régulier.</p>
      <div class="hand-list">{HAND_MEASURES.map((m) => row(m, false))}</div>
      <span class="card__label">À côté</span>
      <div class="hand-list">{PLATE_EXTRAS.map((m) => row(m, true))}</div>
      <MealPicker value={meal} onChange={setMeal} />
      <div class="field">
        <label for="hands-label">Nom (facultatif)</label>
        <input id="hands-label" type="text" placeholder="ex. Cantine, pizzeria" value={label} onInput={(e) => setLabel(e.currentTarget.value)} />
      </div>
    </Sheet>
  );
}
