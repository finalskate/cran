/**
 * Le plan « si… alors… » du moment, en UNE ligne discrète (accueil du 21/11 : en carte, il
 * paraissait aussi important que la pesée, alors que c'est un simple rappel). Toucher la ligne
 * ouvre « Mes plans » ; la croix la masque pour la journée (même effet que l'ancien « Vu »).
 * S'il y a plusieurs plans pour le moment (le soir : cuisine et soirée), le premier s'affiche,
 * les autres sont comptés.
 */
import { TRIGGER_LABEL } from '../../data/habits';
import type { PlanMoment } from '../../domain/habits';
import { dismissPlanMoment } from '../habitsState';

/** Nom du moment, lu par les lecteurs d'écran. */
function momentName(moment: PlanMoment): string {
  if (moment.slot === 'post-ride') return 'Après le vélo';
  if (moment.slot === 'evening') return 'Pour ce soir';
  return TRIGGER_LABEL[moment.plans[0]!.trigger];
}

export function PlanHint({ moment, onEdit }: { moment: PlanMoment; onEdit: () => void }) {
  const [first, ...others] = moment.plans;
  if (!first) return null;
  return (
    <div class="plan-hint" role="note" aria-label={`Ton plan · ${momentName(moment)}`}>
      <button type="button" class="plan-hint__text" onClick={onEdit}>
        <svg class="plan-hint__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
        <span>
          <span class="plan-hint__when">Si {first.when}</span> → {first.then}
          {others.length > 0 && <span class="muted"> · +{others.length}</span>}
        </span>
      </button>
      <button type="button" class="plan-hint__close" aria-label="Masquer pour aujourd’hui" onClick={() => void dismissPlanMoment(moment)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
