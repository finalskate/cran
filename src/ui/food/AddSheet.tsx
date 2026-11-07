/**
 * « Ajouter » : mes aliments (favoris puis récents, avec recherche), et les deux autres façons
 * de noter : estimer une assiette à la main, ou saisir des kcal.
 * Chaque produit scanné et chaque plat gardé vient grossir cette liste : au bout de quelques
 * jours, l'essentiel se note en deux gestes.
 */
import { useEffect, useState } from 'preact/hooks';
import { portionNutrients, searchFoods, type Food } from '../../domain/nutrition';
import { listFoods } from '../../data/foodRepo';
import { Sheet } from '../components/Sheet';

interface Props {
  onClose: () => void;
  onPick: (food: Food) => void;
  onHands: () => void;
  onFree: () => void;
}

/** Au-delà, la liste devient un mur : la recherche prend le relais. */
const MAX_SHOWN = 40;

export function AddSheet({ onClose, onPick, onHands, onFree }: Props) {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void listFoods().then(setFoods);
  }, []);

  const shown = foods ? searchFoods(foods, query).slice(0, MAX_SHOWN) : [];

  return (
    <Sheet open onClose={onClose} title="Ajouter">
      <div class="segmented">
        <button type="button" class="btn" onClick={onHands}>
          Estimer une assiette
        </button>
        <button type="button" class="btn" onClick={onFree}>
          Saisie libre
        </button>
      </div>

      {foods && foods.length > 0 && (
        <div class="field">
          <label for="food-search" class="visually-hidden">
            Chercher dans mes aliments
          </label>
          <input
            id="food-search"
            type="search"
            placeholder="Chercher dans mes aliments"
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </div>
      )}

      <div class="food-list">
        {shown.map((f) => {
          const first = f.portions[0];
          const kcal = first ? Math.round(portionNutrients(f, first).kcal) : 0;
          return (
            <button key={f.id} type="button" class="food-row" onClick={() => onPick(f)}>
              <span class="food-row__main">
                <span class="food-row__name">
                  {f.favorite && <span class="accent" aria-label="Favori">★ </span>}
                  {f.name}
                </span>
                <span class="muted food-row__meta">
                  {[f.brand, first?.label].filter(Boolean).join(' · ')}
                </span>
              </span>
              {kcal > 0 && <span class="num muted">{kcal} kcal</span>}
            </button>
          );
        })}
        {foods && foods.length === 0 && (
          <p class="muted">
            Tes aliments apparaîtront ici : chaque produit scanné et chaque plat gardé se renote ensuite en deux gestes.
          </p>
        )}
        {foods && foods.length > 0 && shown.length === 0 && <p class="muted">Rien ne correspond. Scanne le produit, ou estime-le.</p>}
      </div>
    </Sheet>
  );
}
