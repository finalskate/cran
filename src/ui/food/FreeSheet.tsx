/**
 * Saisie libre : un nom, des kcal, des protéines (facultatives). Pour ce qui n'a ni code-barres
 * ni place dans l'assiette type (verre de vin, part de gâteau d'anniversaire…).
 * « Garder dans mes aliments » le rend réutilisable en un geste.
 */
import { useState } from 'preact/hooks';
import { mealForTime, type Food, type Meal } from '../../domain/nutrition';
import { saveFood } from '../../data/foodRepo';
import { track } from '../../data/usage';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { logEntry } from '../foodState';
import { parseDecimal } from '../format';
import { isPastDay, makeEntry, MealPicker, NumberField } from './common';

export function FreeSheet({ day, onClose }: { day: string; onClose: () => void }) {
  const [label, setLabel] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [meal, setMeal] = useState<Meal>(mealForTime(new Date()));
  const [keep, setKeep] = useState(false);

  const kcalN = parseDecimal(kcal);
  const valid = kcalN !== undefined && kcalN > 0 && kcalN < 5000;

  async function add() {
    if (!valid) return;
    const name = label.trim() || 'Estimation';
    const unit = { kcal: Math.round(kcalN!), protein: Math.round(parseDecimal(protein) ?? 0) };
    let foodId: string | undefined;
    if (keep) {
      const food: Food = {
        id: `perso:${crypto.randomUUID()}`,
        source: 'custom',
        name,
        portions: [{ label: '1 portion', ...unit }],
        favorite: true,
        uses: 0,
        createdAt: new Date().toISOString(),
      };
      foodId = (await saveFood(food)).id;
    }
    await logEntry(makeEntry(day, meal, name, '1 portion', 1, unit, 'free', foodId));
    track('food-add', { method: 'free', meal, past: isPastDay(day), kept: keep });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Saisie libre"
      footer={
        <button type="button" class="cta cta--compact" disabled={!valid} onClick={() => void add()}>
          <span class="cta__title">Ajouter</span>
        </button>
      }
    >
      <div class="field">
        <label for="free-label">Quoi</label>
        <input id="free-label" type="text" placeholder="ex. Part de galette" value={label} onInput={(e) => setLabel(e.currentTarget.value)} />
      </div>
      <div class="field-pair">
        <NumberField id="free-kcal" label="Énergie" suffix="kcal" value={kcal} onInput={setKcal} />
        <NumberField id="free-prot" label="Protéines" suffix="g" value={protein} onInput={setProtein} hint="facultatif" />
      </div>
      <MealPicker value={meal} onChange={setMeal} />
      <Toggle label="Garder dans mes aliments" hint="Il sera proposé en favori la prochaine fois" checked={keep} onChange={setKeep} />
    </Sheet>
  );
}
