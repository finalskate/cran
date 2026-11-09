/**
 * « Ajouter » : mes aliments (favoris puis récents), et une recherche par nom qui fouille,
 * dans l'ordre :
 *  1. mes aliments (scannés, gardés, repas types) ;
 *  2. la table Ciqual embarquée (aliments génériques, hors ligne) ;
 *  3. Open Food Facts en ligne, seulement sur appui (produits de marque, chaînes) ;
 * et, si rien ne convient, « Créer un aliment » (valeurs recopiées d'une étiquette ou du site
 * d'une enseigne). Plus les deux autres façons de noter : estimer à la main, ou saisir des kcal.
 *
 * J5b : plusieurs aliments d'un coup (« wrap poulet + petite frite ») : la recherche le repère
 * et propose « Noter en une fois », qui ouvre la saisie en une phrase (PhraseSheet).
 */
import { useEffect, useState } from 'preact/hooks';
import { portionNutrients, searchFoods, type Food } from '../../domain/nutrition';
import { ciqualFoodId, ciqualToFood, loadCiqual, searchCiqual, type CiqualIndex } from '../../data/ciqual';
import { looksLikePhrase, splitPhrase } from '../../domain/phrase';
import { PHRASE_VOCABULARY } from '../../data/phraseWords';
import { listFoods } from '../../data/foodRepo';
import { searchOffByName, type NameSearchResult } from '../../data/openFoodFacts';
import { track } from '../../data/usage';
import { Sheet } from '../components/Sheet';

/** D'où vient l'aliment choisi : les aliments Ciqual et en ligne ne sont pas encore gardés. */
export type PickOrigin = 'mine' | 'ciqual' | 'online';

interface Props {
  onClose: () => void;
  onPick: (food: Food, origin: PickOrigin) => void;
  onHands: () => void;
  onFree: () => void;
  /** Créer un aliment, nom pré-rempli avec la recherche. */
  onCreate: (name: string) => void;
  /** Plusieurs aliments tapés d'un coup : saisie en une phrase. */
  onPhrase: (text: string) => void;
}

/** Au-delà, la liste devient un mur : la recherche prend le relais. */
const MAX_SHOWN = 40;
/** Résultats « mes aliments » affichés pendant une recherche. */
const MAX_MINE = 8;

/** Recherche en ligne : pas encore lancée, en cours, ou résultat (pour la recherche `query`). */
type Online = { state: 'idle' } | { state: 'loading' } | { state: 'done'; query: string; result: NameSearchResult };

function FoodRow({ food, onClick, meta }: { food: Food; onClick: () => void; meta?: string }) {
  const first = food.portions[0];
  const kcal = first ? Math.round(portionNutrients(food, first).kcal) : 0;
  return (
    <button type="button" class="food-row" onClick={onClick}>
      <span class="food-row__main">
        <span class="food-row__name">
          {food.favorite && <span class="accent" aria-label="Favori">★ </span>}
          {food.name}
        </span>
        <span class="muted food-row__meta">{meta ?? [food.brand, first?.label].filter(Boolean).join(' · ')}</span>
      </span>
      {kcal > 0 && <span class="num muted">{kcal} kcal</span>}
    </button>
  );
}

export function AddSheet({ onClose, onPick, onHands, onFree, onCreate, onPhrase }: Props) {
  const [foods, setFoods] = useState<Food[] | null>(null);
  const [query, setQuery] = useState('');
  const [ciqual, setCiqual] = useState<CiqualIndex | null>(null);
  const [online, setOnline] = useState<Online>({ state: 'idle' });

  useEffect(() => {
    void listFoods().then(setFoods);
  }, []);

  const q = query.trim();
  const phrase = looksLikePhrase(q, PHRASE_VOCABULARY);
  const searching = q.length >= 2 && !phrase;

  // La table Ciqual n'est chargée qu'à la première recherche.
  useEffect(() => {
    if (searching && !ciqual) void loadCiqual().then(setCiqual);
  }, [searching, ciqual]);

  const mine = foods ? searchFoods(foods, q).slice(0, searching ? MAX_MINE : MAX_SHOWN) : [];
  const now = new Date().toISOString();
  const stored = new Map((foods ?? []).map((f) => [f.id, f]));
  // Un aliment Ciqual déjà noté apparaît dans « mes aliments » : pas de doublon.
  const generic = searching && ciqual ? searchCiqual(ciqual, q).filter((r) => !mine.some((f) => f.id === ciqualFoodId(r[0]))) : [];
  const onlineResult = online.state === 'done' && online.query === q ? online.result : null;

  async function searchOnline() {
    setOnline({ state: 'loading' });
    const result = await searchOffByName(q, new Date().toISOString());
    track('food-search', { status: result.status, results: result.status === 'found' ? result.products.length : 0 });
    setOnline({ state: 'done', query: q, result });
  }

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

      <div class="field">
        <label for="food-search" class="visually-hidden">
          Chercher un aliment
        </label>
        <input
          id="food-search"
          type="search"
          placeholder="Chercher (ou : wrap poulet + petite frite)"
          autoComplete="off"
          value={query}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </div>

      {phrase && (
        <button type="button" class="card card--link card--button phrase-cta" onClick={() => onPhrase(q)}>
          <span class="card__label">Plusieurs aliments</span>
          <span class="card__title">Noter en une fois</span>
          <span class="muted">{splitPhrase(q, PHRASE_VOCABULARY).join(' · ')}</span>
        </button>
      )}

      {!searching && !phrase && (
        <div class="food-list">
          {mine.map((f) => (
            <FoodRow key={f.id} food={f} onClick={() => onPick(f, 'mine')} />
          ))}
          {foods && foods.length === 0 && (
            <p class="muted">
              Tape un nom pour chercher parmi 3 000 aliments, même hors ligne. Tes aliments apparaîtront ensuite ici :
              ce que tu notes se renote en deux gestes.
            </p>
          )}
        </div>
      )}

      {searching && (
        <>
          {mine.length > 0 && (
            <div class="food-list" aria-label="Mes aliments">
              <span class="card__label">Mes aliments</span>
              {mine.map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => onPick(f, 'mine')} />
              ))}
            </div>
          )}

          <div class="food-list" aria-label="Aliments génériques">
            <span class="card__label">Aliments génériques · hors ligne</span>
            {!ciqual && <p class="muted">Chargement…</p>}
            {ciqual && generic.length === 0 && <p class="muted">Aucun aliment générique ne correspond.</p>}
            {generic.map((row) => {
              const food = stored.get(ciqualFoodId(row[0])) ?? ciqualToFood(row, now);
              return <FoodRow key={food.id} food={food} onClick={() => onPick(food, 'ciqual')} />;
            })}
          </div>

          <div class="food-list" aria-label="En ligne">
            <span class="card__label">En ligne · Open Food Facts</span>
            {!onlineResult && (
              <button type="button" class="btn" disabled={online.state === 'loading'} onClick={() => void searchOnline()}>
                {online.state === 'loading' ? 'Recherche en ligne…' : `Chercher « ${q} » en ligne`}
              </button>
            )}
            {onlineResult?.status === 'offline' && (
              <p class="muted">Pas de réseau. Les aliments génériques et la création restent disponibles.</p>
            )}
            {onlineResult?.status === 'busy' && (
              <>
                <p class="muted">Open Food Facts est saturé pour le moment.</p>
                <button type="button" class="btn btn--small" onClick={() => void searchOnline()}>
                  Réessayer
                </button>
              </>
            )}
            {onlineResult?.status === 'found' && onlineResult.products.length === 0 && <p class="muted">Rien trouvé en ligne.</p>}
            {onlineResult?.status === 'found' &&
              onlineResult.products.map(({ food }) => {
                const known = stored.get(food.id);
                return <FoodRow key={food.id} food={known ?? food} onClick={() => onPick(known ?? food, known ? 'mine' : 'online')} />;
              })}
          </div>

          <button type="button" class="btn btn--quiet" onClick={() => onCreate(q)}>
            Pas trouvé ? Créer « {q} »
          </button>
        </>
      )}
    </Sheet>
  );
}
