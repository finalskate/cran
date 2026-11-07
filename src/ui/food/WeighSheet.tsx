/**
 * Pesée (SPEC §4.9, « pesée minimale » du J4) : un poids pré-rempli (dernière pesée), ajusté
 * au dixième, enregistré en un geste. Le ton installe l'habitude sans pression : on ne commente
 * jamais la pesée du jour, seule la tendance compte (elle arrive au J3).
 */
import { useState } from 'preact/hooks';
import { dayKey } from '../../domain/days';
import { latestWeight, WEIGHT_MAX, WEIGHT_MIN } from '../../domain/nutrition';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { profile, recordWeight, weights } from '../foodState';
import { formatKg } from '../format';

/** Poids proposé quand on n'a encore rien : un point de départ, à ajuster. */
const FALLBACK_KG = 75;

export function WeighSheet({ onClose }: { onClose: () => void }) {
  const last = latestWeight(weights.value);
  const today = dayKey(new Date());
  const [kg, setKg] = useState(last?.kg ?? profile.value?.weightKg ?? FALLBACK_KG);
  const replacing = last?.day === today;

  async function save() {
    await recordWeight(kg);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Pesée"
      footer={
        <button type="button" class="cta cta--compact" onClick={() => void save()}>
          <span class="cta__title">{replacing ? 'Remplacer la pesée du jour' : 'Noter'}</span>
        </button>
      }
    >
      <Stepper
        big
        label="Poids"
        value={kg}
        onChange={setKg}
        step={0.1}
        min={WEIGHT_MIN}
        max={WEIGHT_MAX}
        format={(v) => (
          <>
            {formatKg(v).replace(' kg', '')}
            <span class="stepper__unit"> kg</span>
          </>
        )}
      />
      <div class="segmented">
        <button type="button" class="btn btn--small" onClick={() => setKg(Math.max(WEIGHT_MIN, Math.round((kg - 1) * 10) / 10))}>
          −1 kg
        </button>
        <button type="button" class="btn btn--small" onClick={() => setKg(Math.min(WEIGHT_MAX, Math.round((kg + 1) * 10) / 10))}>
          +1 kg
        </button>
      </div>
      <p class="muted sheet__lead">
        Le meilleur moment : au réveil, après les toilettes, avant de manger ou boire. Le poids varie d’un jour à l’autre
        (eau, sel, repas de la veille) : c’est la tendance sur plusieurs jours qui compte, jamais la pesée du jour.
      </p>
    </Sheet>
  );
}
