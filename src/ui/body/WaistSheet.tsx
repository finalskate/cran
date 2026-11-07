/**
 * Tour de taille (SPEC §4.9) : hebdomadaire et facultatif. Proposé juste après une pesée (même
 * moment, mêmes conditions), ou noté à tout moment depuis Carnet › Corps.
 *
 * `WaistField` est la partie saisie (réutilisée dans l'écran qui suit la pesée) ; `WaistSheet`
 * l'emballe dans un panneau.
 */
import { useState } from 'preact/hooks';
import { WAIST_MAX, WAIST_MIN } from '../../domain/body';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { recordWaist, waists } from '../bodyState';
import { formatCm } from '../format';

/** Valeur proposée la toute première fois : un point de départ, à ajuster. */
const FALLBACK_CM = 85;

/** Valeur de départ du sélecteur : la dernière mesure. */
export function initialWaist(): number {
  return waists.value.at(-1)?.value ?? FALLBACK_CM;
}

export function WaistField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <>
      <Stepper
        label="Tour de taille"
        value={value}
        onChange={onChange}
        step={0.5}
        min={WAIST_MIN}
        max={WAIST_MAX}
        format={(v) => (
          <>
            {formatCm(v).replace(' cm', '')}
            <span class="stepper__unit"> cm</span>
          </>
        )}
      />
      <p class="muted sheet__lead">
        Ruban souple au niveau du nombril, debout, en fin d’expiration normale, sans serrer. Toujours au même endroit :
        c’est la régularité qui rend la mesure utile.
      </p>
    </>
  );
}

export function WaistSheet({ onClose }: { onClose: () => void }) {
  const [cm, setCm] = useState(initialWaist);

  async function save() {
    await recordWaist(cm);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Tour de taille"
      footer={
        <button type="button" class="cta cta--compact" onClick={() => void save()}>
          <span class="cta__title">Noter</span>
        </button>
      }
    >
      <WaistField value={cm} onChange={setCm} />
    </Sheet>
  );
}
