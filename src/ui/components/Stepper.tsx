/**
 * Sélecteur « − valeur + » compact : nombre de portions, repères de la main, poids.
 * Gros boutons ronds (doigts moites), valeur au centre en Space Grotesk.
 */
import type { ComponentChildren } from 'preact';

interface Props {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  /** Mise en forme de la valeur affichée. */
  format?: (value: number) => ComponentChildren;
  /** Nom lu par les lecteurs d'écran (« Nombre de portions »). */
  label: string;
  /** Variante grande taille (pesée). */
  big?: boolean;
}

/** Arrondit au pas pour éviter les 0,30000000004 des additions successives. */
function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function Stepper({ value, onChange, step, min, max, format, label, big }: Props) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, snap(v, step))));
  return (
    <div class={`stepper${big ? ' stepper--big' : ''}`} role="group" aria-label={label}>
      <button type="button" class="stepper__btn" aria-label="Moins" disabled={value <= min} onClick={() => set(value - step)}>
        −
      </button>
      <span class="num stepper__value" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button type="button" class="stepper__btn" aria-label="Plus" disabled={value >= max} onClick={() => set(value + step)}>
        +
      </button>
    </div>
  );
}
