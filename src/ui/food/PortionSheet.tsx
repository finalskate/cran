/**
 * Choix de la portion d'un aliment connu (scanné, favori, récent) : portion, nombre (par ½),
 * repas, puis « Ajouter ». Jamais de grammes obligatoires : les portions toutes prêtes
 * (« ½ paquet », « 1 portion ») suffisent ; les grammes restent possibles si on les connaît.
 *
 * Un aliment trouvé par la recherche (Ciqual, en ligne) n'est gardé localement qu'au moment
 * où on le note ou le met en favori : regarder ne remplit pas la liste.
 */
import { useState } from 'preact/hooks';
import {
  amountPortion,
  formatCount,
  mealForTime,
  portionNutrients,
  type Food,
  type Meal,
  type Portion,
} from '../../domain/nutrition';
import { saveFood, setFavorite } from '../../data/foodRepo';
import { track } from '../../data/usage';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { logEntry } from '../foodState';
import { parseDecimal } from '../format';
import { isPastDay, makeEntry, MealPicker, NumberField, NutrientsLine } from './common';

interface Props {
  food: Food;
  day: string;
  /** D'où vient l'aliment (journal d'usage). */
  method: 'scan' | 'list';
  /** Vrai si l'aliment n'est pas encore dans la base locale (résultat de recherche). */
  unsaved?: boolean;
  onClose: () => void;
  /** Valeurs manquantes ou fausses : ouvrir la saisie depuis l'étiquette. */
  onEditValues?: () => void;
}

/** Index spécial : quantité libre en grammes. */
const CUSTOM = -1;

export function PortionSheet({ food, day, method, unsaved, onClose, onEditValues }: Props) {
  const [choice, setChoice] = useState(0);
  const [grams, setGrams] = useState('');
  const [count, setCount] = useState(1);
  const [meal, setMeal] = useState<Meal>(mealForTime(new Date()));
  const [favorite, setFav] = useState(!!food.favorite);
  const [saved, setSaved] = useState(!unsaved);

  const portion: Portion | undefined =
    choice === CUSTOM ? (parseDecimal(grams) ? amountPortion(food, parseDecimal(grams)!) : undefined) : food.portions[choice];
  const unit = portion ? portionNutrients(food, portion) : { kcal: 0, protein: 0 };
  const total = { kcal: unit.kcal * count, protein: unit.protein * count };
  const missingValues = !food.per100 && food.portions.every((p) => p.kcal === undefined);

  async function add() {
    if (!portion) return;
    if (!saved) await saveFood(food);
    await logEntry(makeEntry(day, meal, food.name, portion.label, count, unit, method, food.id));
    track('food-add', { method, meal, past: isPastDay(day), source: food.source });
    onClose();
  }

  async function toggleFavorite() {
    setFav(!favorite);
    if (saved) {
      await setFavorite(food.id, !favorite);
    } else {
      await saveFood({ ...food, favorite: !favorite });
      setSaved(true);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={food.name}
      kicker={food.brand}
      footer={
        <button type="button" class="cta cta--compact" disabled={!portion || missingValues} onClick={() => void add()}>
          <span class="cta__title">Ajouter</span>
        </button>
      }
    >
      {missingValues ? (
        <div class="notice">
          <p>Ce produit n’a pas de valeurs nutritionnelles dans la base.</p>
          {onEditValues && (
            <button type="button" class="btn" onClick={onEditValues}>
              Les recopier depuis l’étiquette
            </button>
          )}
        </div>
      ) : (
        <>
          <div class="choice-list" role="radiogroup" aria-label="Portion">
            {food.portions.map((p, i) => (
              <button key={i} type="button" class="choice" role="radio" aria-checked={choice === i} onClick={() => setChoice(i)}>
                <span>{p.label}</span>
                <span class="muted num">{Math.round(portionNutrients(food, p).kcal)} kcal</span>
              </button>
            ))}
            {food.per100 && (
              <button type="button" class="choice" role="radio" aria-checked={choice === CUSTOM} onClick={() => setChoice(CUSTOM)}>
                <span>Autre quantité</span>
                <span class="muted">en {food.unit ?? 'g'}</span>
              </button>
            )}
          </div>
          {choice === CUSTOM && (
            <NumberField id="portion-grams" label="Quantité" suffix={food.unit ?? 'g'} value={grams} onInput={setGrams} />
          )}

          <div class="row">
            <span>Combien</span>
            <Stepper label="Nombre de portions" value={count} onChange={setCount} step={0.5} min={0.5} max={20} format={formatCount} />
          </div>

          <MealPicker value={meal} onChange={setMeal} />
          <NutrientsLine value={total} />

          <div class="row">
            <button type="button" class="btn btn--small" aria-pressed={favorite} onClick={() => void toggleFavorite()}>
              {favorite ? '★ Favori' : '☆ Mettre en favori'}
            </button>
            {onEditValues && food.per100 && (
              <button type="button" class="btn btn--small btn--quiet" onClick={onEditValues}>
                Corriger les valeurs
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
