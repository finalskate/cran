/**
 * Écran « Assiette » (SPEC §4.8, phase A « calibration ») : le journal d'un jour, ses jauges
 * kcal / protéines, et les façons de noter. Le scan est en bas, dans la zone du pouce : c'est
 * la voie principale pour les produits emballés.
 *
 * Les jours passés restent consultables et modifiables (‹ ›) : on peut rattraper un oubli
 * de la veille. Un repas de plusieurs entrées peut devenir un « repas type » réutilisable.
 *
 * Après la calibration, une carte propose d'ajuster la cible sur la dépense réelle, et chaque
 * journée passée dit si elle compte pour ce calcul (modifiable d'un geste).
 *
 * J3b : « Idées de protéines » sous les jauges du jour ; à partir de 14 h, s'il manque encore
 * de quoi atteindre la cible, la ligne le dit (sans reproche) et propose les idées.
 */
import { useState } from 'preact/hooks';
import {
  ADJUST_PERIOD_DAYS,
  dayCounts,
  isPartialDay,
  MAX_STEP_KCAL,
  MIN_COUNTED_DAYS,
  MIN_WEIGH_INS,
  type Adjustment,
} from '../../domain/adaptive';
import { addDays } from '../../domain/days';
import {
  calibrationDay,
  CALIBRATION_DAYS,
  DEFICIT_KCAL,
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
import { ProteinIdeasSheet } from '../food/ProteinIdeasSheet';
import { ScanSheet } from '../food/ScanSheet';
import {
  calibrationStart,
  dayOverrides,
  decideAdjustment,
  profile,
  setDayOverride,
  targets,
  useDayEntries,
  usePendingAdjustment,
} from '../foodState';
import { formatInt, MEAL_LABEL, relativeDayLabel } from '../format';

/** Panneau ouvert (un seul à la fois). */
type Panel =
  | { kind: 'add' }
  | { kind: 'scan' }
  | { kind: 'hands' }
  | { kind: 'free' }
  | { kind: 'portion'; food: FoodItem; method: 'scan' | 'list'; unsaved?: boolean }
  | {
      kind: 'product';
      barcode?: string;
      reason: 'not-found' | 'offline' | 'incomplete' | 'edit' | 'create';
      initial?: FoodItem;
      initialName?: string;
    }
  | { kind: 'entry'; entry: FoodEntry }
  | { kind: 'why' }
  | { kind: 'protein' }
  | null;

/** Au-delà de 7 jours en arrière, on n'invite plus à rattraper (bouton ‹ désactivé). */
const MAX_DAYS_BACK = 7;

/** Rappel des protéines : à partir de cette heure, s'il manque au moins PROTEIN_NUDGE_G. */
const PROTEIN_NUDGE_HOUR = 14;
const PROTEIN_NUDGE_G = 20;

export function Food() {
  const today = foodDay(new Date());
  const [day, setDay] = useState(today);
  const [panel, setPanel] = useState<Panel>(null);
  const entries = useDayEntries(day);
  const close = () => setPanel(null);

  const totals = sumEntries(entries ?? []);
  const calib = calibrationStart.value ? calibrationDay(calibrationStart.value, today) : null;
  const pending = usePendingAdjustment();
  const proteinLeft = targets.value ? Math.max(0, Math.round(targets.value.protein - totals.protein)) : null;
  const proteinNudge =
    day === today && proteinLeft !== null && proteinLeft >= PROTEIN_NUDGE_G && new Date().getHours() >= PROTEIN_NUDGE_HOUR;

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
        {(calib !== null || pending?.result.status === 'not-enough') && (
          <button type="button" class="row row--button" onClick={() => setPanel({ kind: 'why' })}>
            <span class="chip">{calib !== null ? `Calibration · jour ${calib} sur ${CALIBRATION_DAYS}` : 'Calibration prolongée'}</span>
            <span class="muted calib-why">Pourquoi ?</span>
          </button>
        )}
        <DayMeters totals={totals} targets={targets.value} />
        {day < today && entries && entries.length > 0 && targets.value && (
          <DayCountLine day={day} kcal={totals.kcal} expenditure={targets.value.expenditure} />
        )}
        {day === today && (
          <div class="row day-count">
            <span class="muted">{proteinNudge ? `Encore ${formatInt(proteinLeft!)} g de protéines pour ta journée.` : ''}</span>
            <button
              type="button"
              class="btn btn--small btn--quiet"
              onClick={() => {
                track('protein-ideas', { open: proteinNudge ? 'nudge' : 'link' });
                setPanel({ kind: 'protein' });
              }}
            >
              {proteinNudge ? 'Des idées' : 'Idées de protéines'}
            </button>
          </div>
        )}
      </section>

      {day === today && pending?.result.status === 'ready' && (
        <AdjustCard result={pending.result} currentKcal={targets.value?.kcal ?? 0} />
      )}
      {day === today && pending?.result.status === 'not-enough' && <NotEnoughNote result={pending.result} />}

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
          onPick={(food, origin) => setPanel({ kind: 'portion', food, method: 'list', unsaved: origin !== 'mine' })}
          onHands={() => setPanel({ kind: 'hands' })}
          onFree={() => setPanel({ kind: 'free' })}
          onCreate={(name) => setPanel({ kind: 'product', reason: 'create', initialName: name })}
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
          unsaved={panel.unsaved}
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
          initialName={panel.initialName}
          onClose={close}
          onSaved={(food) => setPanel({ kind: 'portion', food, method: panel.barcode ? 'scan' : 'list' })}
        />
      )}
      {panel?.kind === 'entry' && <EntrySheet entry={panel.entry} onClose={close} />}
      {panel?.kind === 'protein' && (
        <ProteinIdeasSheet
          remaining={proteinLeft}
          onClose={close}
          onPick={(food, unsaved) => setPanel({ kind: 'portion', food, method: 'list', unsaved })}
        />
      )}
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
            <p>
              Un jour sans rien noter n’est pas grave : il est simplement ignoré. Un jour très peu noté (un repas
              oublié, sans doute) est mis de côté aussi ; tu peux le compter quand même depuis ce jour-là.
            </p>
            <p>
              Il faut au moins {MIN_COUNTED_DAYS} journées notées et {MIN_WEIGH_INS} pesées étalées sur{' '}
              {ADJUST_PERIOD_DAYS} jours. Sinon, la calibration se prolonge d’elle-même, sans rien perdre.
            </p>
          </div>
        </Sheet>
      )}
    </main>
  );
}

/**
 * Sous les jauges d'un jour passé : compte-t-il pour le calcul de la dépense réelle ? Une
 * journée partielle est mise de côté d'office ; on peut inverser le choix d'un geste.
 */
function DayCountLine({ day, kcal, expenditure }: { day: string; kcal: number; expenditure: number }) {
  const override = dayOverrides.value[day];
  const partial = isPartialDay(kcal, expenditure);
  const counts = dayCounts(kcal, expenditure, override);
  // Inverser le choix ; revenir à l'automatique quand il donne déjà le résultat voulu.
  const next = counts ? (partial ? undefined : 'skip') : partial ? 'count' : undefined;
  return (
    <div class="row day-count">
      <span class="muted">{counts ? 'Compte pour le calcul de ta dépense.' : 'Mise de côté pour le calcul : journée peu notée.'}</span>
      <button type="button" class="btn btn--small btn--quiet" onClick={() => void setDayOverride(day, next)}>
        {counts ? 'Incomplète ?' : 'La compter'}
      </button>
    </div>
  );
}

/** « −0,35 kg », « +0,1 kg » (vrai signe moins). */
function signedKg(kg: number): string {
  const sign = kg > 0 ? '+' : kg < 0 ? '−' : '';
  return `${sign}${Math.abs(kg).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg`;
}

/** Proposition d'ajustement : la dépense réelle mesurée et la cible qui en découle. */
function AdjustCard({ result, currentKcal }: { result: Extract<Adjustment, { status: 'ready' }>; currentKcal: number }) {
  const same = result.proposedKcal === currentKcal;
  return (
    <section class="card adjust" aria-label="Ajustement de la cible">
      <span class="card__label">Ta dépense réelle</span>
      <p>
        Sur les {ADJUST_PERIOD_DAYS} derniers jours : {result.countedDays} journées comptées,{' '}
        <span class="num">{formatInt(result.meanIntake)}</span> kcal en moyenne, poids{' '}
        <span class="num">{signedKg(result.kgPerWeek)}</span> par semaine.
      </p>
      <div class="calc">
        <span>Dépense mesurée</span>
        <span class="num">{formatInt(result.measured)} kcal</span>
        <span>− déficit</span>
        <span class="num">{formatInt(DEFICIT_KCAL)} kcal</span>
        <strong>{same ? 'Ta cible reste' : 'Nouvelle cible'}</strong>
        <strong class="num accent">{formatInt(result.proposedKcal)} kcal</strong>
      </div>
      {result.capped && (
        <p class="muted calc__note">Écart limité à {MAX_STEP_KCAL} kcal d’un coup : le reste se verra au prochain point.</p>
      )}
      {result.fastLoss && <p class="muted calc__note">Tu perds plus de 1 % de ton poids par semaine : la cible ne baisse pas.</p>}
      {result.floored && <p class="muted calc__note">Relevée au plancher : descendre plus bas ferait perdre du muscle.</p>}
      <div class="adjust__actions">
        <button type="button" class="cta cta--compact" onClick={() => void decideAdjustment(result.proposedKcal, 'accepted')}>
          <span class="cta__title">{same ? 'Compris' : `Adopter ${formatInt(result.proposedKcal)} kcal`}</span>
        </button>
        {!same && (
          <button type="button" class="btn btn--quiet" onClick={() => void decideAdjustment(result.proposedKcal, 'declined')}>
            Garder {formatInt(currentKcal)} kcal
          </button>
        )}
      </div>
      <p class="muted calc__note">Prochain point dans {ADJUST_PERIOD_DAYS} jours.</p>
    </section>
  );
}

/** Calibration prolongée : ce qui manque encore, sans reproche. */
function NotEnoughNote({ result }: { result: Extract<Adjustment, { status: 'not-enough' }> }) {
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const parts = [
    result.missingWeighIns > 0 ? plural(result.missingWeighIns, 'pesée') : '',
    result.missingDays > 0 ? `${plural(result.missingDays, 'journée')} notée${result.missingDays > 1 ? 's' : ''}` : '',
  ].filter(Boolean);
  return (
    <p class="muted empty-note">
      Pour mesurer ta dépense réelle, il manque encore {parts.join(' et ')} sur les {ADJUST_PERIOD_DAYS} derniers jours.
      Continue simplement : le calcul se fera dès que ce sera suffisant.
    </p>
  );
}
