/**
 * Une entrée déjà notée : changer le nombre de portions ou le repas, ou la supprimer.
 * Les valeurs d'une portion ont été copiées à la saisie : elles ne changent pas ici.
 */
import { useState } from 'preact/hooks';
import { entryNutrients, formatCount, type FoodEntry, type Meal } from '../../domain/nutrition';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { editEntry, removeEntry } from '../foodState';
import { MEAL_LABEL } from '../format';
import { MealPicker, NutrientsLine } from './common';

export function EntrySheet({ entry, onClose }: { entry: FoodEntry; onClose: () => void }) {
  const [count, setCount] = useState(entry.count);
  const [meal, setMeal] = useState<Meal>(entry.meal);

  async function save() {
    await editEntry(entry.id!, { count, meal });
    onClose();
  }

  async function remove() {
    await removeEntry(entry.id!);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={entry.label}
      kicker={MEAL_LABEL[entry.meal]}
      footer={
        <div class="segmented">
          <button type="button" class="btn btn--big btn--danger" onClick={() => void remove()}>
            Supprimer
          </button>
          <button type="button" class="btn btn--big btn--accent" onClick={() => void save()}>
            Enregistrer
          </button>
        </div>
      }
    >
      <div class="row">
        <span>{entry.portion}</span>
        {/* Une assiette estimée à la main se compte une fois : pas de multiplicateur. */}
        {entry.method !== 'hands' && (
          <Stepper label="Nombre de portions" value={count} onChange={setCount} step={0.5} min={0.5} max={20} format={formatCount} />
        )}
      </div>
      <MealPicker value={meal} onChange={setMeal} />
      <NutrientsLine value={entryNutrients({ unit: entry.unit, count })} />
    </Sheet>
  );
}
