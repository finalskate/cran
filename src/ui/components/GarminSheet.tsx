/**
 * « Garmin propose une séance ? » (retour du 14/11) : on choisit la catégorie et la durée que la
 * montre affiche, Cran dit tout de suite s'il faut la faire, la raccourcir, la courir en aisance
 * ou s'en passer (garminVerdict, src/domain/running.ts). Rien n'est noté ici : la séance faite se
 * note ensuite comme toute course, avec le type « Garmin ».
 */
import { useState } from 'preact/hooks';
import type { GarminWorkout } from '../../domain/recovery';
import { garminVerdict, type GarminVerdict, type RunPlan } from '../../domain/running';
import { GARMIN_LABEL } from '../format';
import { Sheet } from './Sheet';
import { Stepper } from './Stepper';

interface Props {
  plan: RunPlan;
  onClose: () => void;
}

const WORKOUTS = Object.entries(GARMIN_LABEL) as [GarminWorkout, string][];

/** Titre de l'avis, en une ligne. */
function verdictTitle(v: GarminVerdict): string {
  switch (v.verdict) {
    case 'go':
      return 'Vas-y ✓';
    case 'shorten':
      return `Oui, mais ${v.minutes} min`;
    case 'easy':
      return `Plutôt ${v.minutes} min en aisance`;
    case 'skip':
      return 'Pas aujourd’hui';
  }
}

export function GarminSheet({ plan, onClose }: Props) {
  const [workout, setWorkout] = useState<GarminWorkout>('base');
  const [minutes, setMinutes] = useState(plan.next?.minutes ?? 30);
  const verdict = garminVerdict(plan, workout, minutes);

  return (
    <Sheet open onClose={onClose} title="Séance Garmin" kicker="La faire ou pas ?">
      <p class="muted" style={{ margin: 0 }}>
        La montre choisit d’après ta forme, pas d’après ton genou. Dis ce qu’elle propose :
      </p>
      <div class="segmented segmented--tight segmented--grid" role="radiogroup" aria-label="Séance proposée">
        {WORKOUTS.map(([value, label]) => (
          <button key={value} type="button" class="btn btn--small" role="radio" aria-checked={workout === value} onClick={() => setWorkout(value)}>
            {label}
          </button>
        ))}
      </div>
      <div class="row">
        <span>Durée affichée</span>
        <Stepper label="Durée proposée en minutes" value={minutes} onChange={setMinutes} step={5} min={10} max={180} format={(v) => `${v} min`} />
      </div>
      <section class={`card garmin-verdict garmin-verdict--${verdict.verdict}`} aria-live="polite">
        <span class="card__title">{verdictTitle(verdict)}</span>
        {verdict.lines.map((l) => (
          <span key={l} class="muted">
            {l}
          </span>
        ))}
      </section>
    </Sheet>
  );
}
