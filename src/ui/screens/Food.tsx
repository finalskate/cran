/**
 * Écran « Assiette » (SPEC §4.8, phase A « calibration ») : le journal d'un jour, ses jauges
 * kcal / protéines, et les façons de noter. Le scan est en bas, dans la zone du pouce : c'est
 * la voie principale pour les produits emballés.
 *
 * Les jours passés restent consultables et modifiables (‹ ›) : on peut rattraper un oubli
 * de la veille. Un repas de plusieurs entrées peut devenir un « repas type » réutilisable.
 */
import { useState } from 'preact/hooks';
import { addDays } from '../../domain/days';
import {
  calibrationDay,
  CALIBRATION_DAYS,
  entryNutrients,
  foodDay,
  formatCount,
  MEALS,
  sumEntries,
  type Food as FoodItem,
  type FoodEntry,
  type Meal,
} from '../../domain/nutrition';
import { findFoodByBarcode, saveFood } from '../../data/foodRepo';
import { lookupBarcode } from '../../data/openFoodFacts';
import { track } from '../../data/usage';
import { Sheet } from '../components/Sheet';
import { AddSheet } from '../food/AddSheet';
import { DayMeters } from '../food/common';
import { EntrySheet } from '../food/EntrySheet';
import { FreeSheet } from '../food/FreeSheet';
import { HandsSheet } from '../food/HandsSheet';
import { PortionSheet } from '../food/PortionSheet';
import { ProductForm } from '../food/ProductForm';
import { ScanSheet } from '../food/ScanSheet';
import { calibrationStart, profile, targets, useDayEntries } from '../foodState';
import { formatInt, MEAL_LABEL, relativeDayLabel } from '../format';

/** Panneau ouvert (un seul à la fois). */
type Panel =
  | { kind: 'add' }
  | { kind: 'scan' }
  | { kind: 'hands' }
  | { kind: 'free' }
  | { kind: 'portion'; food: FoodItem; method: 'scan' | 'list' }
  | { kind: 'product'; barcode: string; reason: 'not-found' | 'offline' | 'incomplete' | 'edit'; initial?: FoodItem }
  | { kind: 'entry'; entry: FoodEntry }
  | { kind: 'why' }
  | null;

/** Au-delà de 7 jours en arrière, on n'invite plus à rattraper (bouton ‹ désactivé). */
const MAX_DAYS_BACK = 7;

export function Food() {
  const today = foodDay(new Date());
  const [day, setDay] = useState(today);
  const [panel, setPanel] = useState<Panel>(null);
  const entries = useDayEntries(day);
  const close = () => setPanel(null);

  const totals = sumEntries(entries ?? []);
  const calib = calibrationStart.value ? calibrationDay(calibrationStart.value, today) : null;

  /** Après la lecture d'un code : base locale d'abord (hors ligne), puis Open Food Facts. */
  async function resolveBarcode(code: string, via: 'camera' | 'typed') {
    const known = await findFoodByBarcode(code);
    if (known) {
      track('scan', { via, result: 'known' });
      setPanel({ kind: 'portion', food: known, method: 'scan' });
      return;
    }
    const result = await lookupBarcode(code, new Date().toISOString());
    track('scan', { via, result: result.status });
    if (result.status === 'found') {
      const food = await saveFood(result.product.food);
      setPanel(
        result.product.incomplete
          ? { kind: 'product', barcode: code, reason: 'incomplete', initial: food }
          : { kind: 'portion', food, method: 'scan' },
      );
    } else {
      setPanel({ kind: 'product', barcode: code, reason: result.status });
    }
  }

  /** Enregistre un repas de plusieurs entrées comme repas type (favori réutilisable). */
  async function saveCombo(meal: Meal, list: FoodEntry[]) {
    const name = prompt('Nom de ce repas type :', `${MEAL_LABEL[meal]} type`);
    if (!name?.trim()) return;
    const sum = sumEntries(list);
    await saveFood({
      id: `perso:${crypto.randomUUID()}`,
      source: 'combo',
      name: name.trim(),
      portions: [{ label: list.map((e) => e.label).join(', '), kcal: sum.kcal, protein: sum.protein }],
      favorite: true,
      uses: 0,
      createdAt: new Date().toISOString(),
    });
    track('combo', { entries: list.length });
    alert(`« ${name.trim()} » est dans tes favoris.`);
  }

  return (
    <main class="screen screen--calm">
      <header class="screen-header screen-header--row">
        <div class="screen-header__titles">
          <span class="screen-header__kicker">{relativeDayLabel(day, today)}</span>
          <h1 class="screen-header__title">Assiette</h1>
        </div>
        <div class="daynav">
          <button
            type="button"
            class="icon-btn icon-btn--round"
            aria-label="Jour précédent"
            disabled={day <= addDays(today, -MAX_DAYS_BACK)}
            onClick={() => setDay(addDays(day, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            class="icon-btn icon-btn--round"
            aria-label="Jour suivant"
            disabled={day >= today}
            onClick={() => setDay(addDays(day, 1))}
          >
            ›
          </button>
        </div>
      </header>

      {!profile.value && (
        <a class="card card--link" href="#/profil">
          <span class="card__label">Première fois</span>
          <span class="card__title">Calcule ta cible du jour</span>
          <span class="muted">Taille, poids, activité : une minute. Tu peux déjà noter sans. →</span>
        </a>
      )}

      <section class="card" aria-label="Total du jour">
        {calib !== null && (
          <button type="button" class="row row--button" onClick={() => setPanel({ kind: 'why' })}>
            <span class="chip">
              Calibration · jour {calib} sur {CALIBRATION_DAYS}
            </span>
            <span class="muted calib-why">Pourquoi ?</span>
          </button>
        )}
        <DayMeters totals={totals} targets={targets.value} />
      </section>

      {entries && entries.length === 0 && (
        <p class="muted empty-note">{day === today ? 'Rien de noté pour l’instant aujourd’hui.' : 'Rien de noté ce jour-là.'}</p>
      )}

      {MEALS.map((meal) => {
        const list = (entries ?? []).filter((e) => e.meal === meal);
        if (list.length === 0) return null;
        const sub = sumEntries(list);
        return (
          <section key={meal} class="card" aria-label={MEAL_LABEL[meal]}>
            <div class="row" style={{ minHeight: 0 }}>
              <span class="card__label">{MEAL_LABEL[meal]}</span>
              <span class="muted num">{formatInt(sub.kcal)} kcal</span>
            </div>
            {list.map((e) => {
              const n = entryNutrients(e);
              return (
                <button key={e.id} type="button" class="food-row" onClick={() => setPanel({ kind: 'entry', entry: e })}>
                  <span class="food-row__main">
                    <span class="food-row__name">{e.label}</span>
                    <span class="muted food-row__meta">
                      {e.count !== 1 ? `${formatCount(e.count)} × ` : ''}
                      {e.portion}
                    </span>
                  </span>
                  <span class="num">{formatInt(n.kcal)}</span>
                </button>
              );
            })}
            {list.length >= 2 && (
              <button type="button" class="btn btn--small btn--quiet" onClick={() => void saveCombo(meal, list)}>
                Enregistrer comme repas type
              </button>
            )}
          </section>
        );
      })}

      <div class="bottom-zone">
        <div class="segmented">
          <button type="button" class="btn btn--big btn--solid" onClick={() => setPanel({ kind: 'add' })}>
            Ajouter
          </button>
          <button type="button" class="cta cta--compact" onClick={() => setPanel({ kind: 'scan' })}>
            <span class="cta__title">Scanner</span>
          </button>
        </div>
      </div>

      {panel?.kind === 'add' && (
        <AddSheet
          onClose={close}
          onPick={(food) => setPanel({ kind: 'portion', food, method: 'list' })}
          onHands={() => setPanel({ kind: 'hands' })}
          onFree={() => setPanel({ kind: 'free' })}
        />
      )}
      {panel?.kind === 'scan' && <ScanSheet onClose={close} resolve={resolveBarcode} />}
      {panel?.kind === 'hands' && <HandsSheet day={day} onClose={close} />}
      {panel?.kind === 'free' && <FreeSheet day={day} onClose={close} />}
      {panel?.kind === 'portion' && (
        <PortionSheet
          key={panel.food.id}
          food={panel.food}
          day={day}
          method={panel.method}
          onClose={close}
          onEditValues={
            panel.food.barcode
              ? () => setPanel({ kind: 'product', barcode: panel.food.barcode!, reason: 'edit', initial: panel.food })
              : undefined
          }
        />
      )}
      {panel?.kind === 'product' && (
        <ProductForm
          barcode={panel.barcode}
          reason={panel.reason}
          initial={panel.initial}
          onClose={close}
          onSaved={(food) => setPanel({ kind: 'portion', food, method: 'scan' })}
        />
      )}
      {panel?.kind === 'entry' && <EntrySheet entry={panel.entry} onClose={close} />}
      {panel?.kind === 'why' && (
        <Sheet open onClose={close} title="Pourquoi tout noter ?" kicker="Calibration">
          <div class="prose">
            <p>
              Pendant {CALIBRATION_DAYS} jours, note tout ce que tu manges, même approximativement. La cible affichée
              est une estimation par formule : elle peut se tromper de plusieurs centaines de kcal.
            </p>
            <p>
              Ensuite, l’appli compare ce que tu as noté à l’évolution réelle de ton poids, et en déduit ta dépense
              réelle. Une erreur <strong>constante</strong> (sous-estimer de 15 % à chaque fois, par exemple) est
              absorbée : ce qui compte, c’est d’estimer toujours de la même façon, et de te peser souvent.
            </p>
            <p>Un jour sans rien noter n’est pas grave : il est simplement ignoré.</p>
          </div>
        </Sheet>
      )}
    </main>
  );
}
