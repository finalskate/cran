/**
 * Tours de bras et de poitrine (J3b) : mensuels et facultatifs, avec les photos. Pendant une
 * perte de poids, ce sont eux qui montrent le muscle gagné : le bras peut grossir pendant que
 * la balance descend.
 *
 * Les deux valeurs se notent ensemble, mais chacune peut être laissée de côté (« pas cette
 * fois ») : un ruban à boucle se manie seul pour le bras, la poitrine demande parfois de l'aide.
 */
import { useState } from 'preact/hooks';
import { MEASURE_BOUNDS } from '../../domain/body';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { arms, chests, recordMeasure } from '../bodyState';
import { formatCm } from '../format';

/** Valeurs proposées la toute première fois : des points de départ, à ajuster. */
const FALLBACK_CM: Record<'arm' | 'chest', number> = { arm: 33, chest: 95 };

const HOW: Record<'arm' | 'chest', string> = {
  arm: 'Bras contracté, coude plié à 90°, poing serré : au plus gros du biceps, ruban à plat. Toujours le même bras.',
  chest: 'Debout, bras le long du corps : ruban horizontal à hauteur des mamelons, en fin d’expiration normale, sans serrer.',
};

const LABEL: Record<'arm' | 'chest', string> = { arm: 'Tour de bras', chest: 'Tour de poitrine' };

export function MeasuresSheet({ onClose }: { onClose: () => void }) {
  const [arm, setArm] = useState(() => arms.value.at(-1)?.value ?? FALLBACK_CM.arm);
  const [chest, setChest] = useState(() => chests.value.at(-1)?.value ?? FALLBACK_CM.chest);
  // Chaque mesure peut être laissée de côté.
  const [keep, setKeep] = useState<Record<'arm' | 'chest', boolean>>({ arm: true, chest: true });

  async function save() {
    if (keep.arm) await recordMeasure('arm', arm);
    if (keep.chest) await recordMeasure('chest', chest);
    onClose();
  }

  const field = (kind: 'arm' | 'chest', value: number, onChange: (v: number) => void) => (
    <div class="measure-field">
      {/* Deux curseurs dans la même feuille : chacun a son titre visible (le Stepper n'a qu'un aria-label). */}
      <span class="card__label">{LABEL[kind]}</span>
      {keep[kind] ? (
        <>
          <Stepper
            label={LABEL[kind]}
            value={value}
            onChange={onChange}
            step={0.5}
            min={MEASURE_BOUNDS[kind].min}
            max={MEASURE_BOUNDS[kind].max}
            format={(v) => (
              <>
                {formatCm(v).replace(' cm', '')}
                <span class="stepper__unit"> cm</span>
              </>
            )}
          />
          <p class="muted sheet__lead">{HOW[kind]}</p>
        </>
      ) : (
        <p class="muted sheet__lead">Pas cette fois.</p>
      )}
      <button type="button" class="btn btn--small btn--quiet" onClick={() => setKeep({ ...keep, [kind]: !keep[kind] })}>
        {keep[kind] ? 'Pas cette fois' : 'Le noter quand même'}
      </button>
    </div>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      title="Bras et poitrine"
      kicker="Une fois par mois"
      footer={
        <button type="button" class="cta cta--compact" disabled={!keep.arm && !keep.chest} onClick={() => void save()}>
          <span class="cta__title">Noter</span>
        </button>
      }
    >
      {field('arm', arm, setArm)}
      {field('chest', chest, setChest)}
      <p class="muted sheet__lead">
        Le matin, avant l’entraînement : un muscle qui vient de travailler gonfle pendant une heure ou deux et fausse la mesure.
      </p>
    </Sheet>
  );
}
