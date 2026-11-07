/**
 * Petits éléments partagés par les panneaux de l'alimentation : choix du repas, jauges
 * kcal / protéines, champ numérique, fabrication d'une entrée du journal.
 */
import type { ComponentChildren } from 'preact';
import { foodDay, MEALS, type EntryMethod, type FoodEntry, type Meal, type Nutrients, type Targets } from '../../domain/nutrition';
import { formatInt, MEAL_LABEL } from '../format';

/** Choix du repas (pré-rempli selon l'heure). */
export function MealPicker({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  return (
    <div class="segmented segmented--tight" role="radiogroup" aria-label="Repas">
      {MEALS.map((m) => (
        <button key={m} type="button" class="btn btn--small" role="radio" aria-checked={value === m} onClick={() => onChange(m)}>
          {MEAL_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

/**
 * Jauge « consommé / cible ». Au-delà de la cible, la jauge reste pleine et le texte le dit
 * sobrement : pas de rouge, pas de reproche (SPEC §2.3).
 */
function Meter({ label, value, target, unit, tone }: { label: string; value: number; target: number; unit: string; tone: 'kcal' | 'protein' }) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  const left = target - value;
  return (
    <div class="meter">
      <div class="meter__head">
        <span class="meter__label">{label}</span>
        <span>
          <span class="num meter__value">{formatInt(value)}</span>
          <span class="muted"> / {formatInt(target)} {unit}</span>
        </span>
      </div>
      <div class="meter__track" aria-hidden="true">
        <div class={`meter__fill meter__fill--${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <span class="muted meter__note">
        {left > 0 ? `reste ${formatInt(left)} ${unit}` : left === 0 ? 'pile la cible' : `${formatInt(-left)} ${unit} au-dessus de la cible`}
      </span>
    </div>
  );
}

/** Les deux jauges du jour ; sans cible (profil absent), seulement les totaux. */
export function DayMeters({ totals, targets }: { totals: Nutrients; targets: Targets | null }) {
  if (!targets) {
    return (
      <div class="row">
        <span>
          <span class="num meter__value">{formatInt(totals.kcal)}</span> <span class="muted">kcal</span>
        </span>
        <span>
          <span class="num meter__value">{formatInt(totals.protein)}</span> <span class="muted">g de protéines</span>
        </span>
      </div>
    );
  }
  return (
    <>
      <Meter label="Énergie" value={totals.kcal} target={targets.kcal} unit="kcal" tone="kcal" />
      <Meter label="Protéines" value={totals.protein} target={targets.protein} unit="g" tone="protein" />
    </>
  );
}

/** Ligne de résultat d'un panneau : « ≈ 360 kcal · 5 g de protéines ». */
export function NutrientsLine({ value, children }: { value: Nutrients; children?: ComponentChildren }) {
  return (
    <p class="nutrients-line">
      <span class="num">≈ {formatInt(value.kcal)}</span> kcal · <span class="num">{formatInt(value.protein)}</span> g de protéines
      {children}
    </p>
  );
}

/** Champ numérique (clavier décimal du téléphone), texte libre relu par parseDecimal. */
export function NumberField({
  label,
  value,
  onInput,
  suffix,
  hint,
  id,
}: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  suffix?: string;
  hint?: string;
  id: string;
}) {
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <div class="field__with-suffix">
        <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} onInput={(e) => onInput(e.currentTarget.value)} />
        {suffix && <span class="muted">{suffix}</span>}
      </div>
      {hint && <span class="muted field__hint">{hint}</span>}
    </div>
  );
}

/**
 * Fabrique une entrée du journal. `day` est le jour affiché à l'écran : on peut noter après coup
 * un oubli de la veille. L'heure reste celle de la saisie.
 */
export function makeEntry(
  day: string,
  meal: Meal,
  label: string,
  portion: string,
  count: number,
  unit: Nutrients,
  method: EntryMethod,
  foodId?: string,
): FoodEntry {
  return {
    day,
    at: new Date().toISOString(),
    meal,
    ...(foodId ? { foodId } : {}),
    label,
    portion,
    count,
    unit,
    method,
  };
}

/** Le jour affiché est-il un jour passé ? (pour le journal d'usage : oublis rattrapés.) */
export function isPastDay(day: string): boolean {
  return day < foodDay(new Date());
}
