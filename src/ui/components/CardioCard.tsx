/**
 * Carte « Prochaine sortie » de l'accueil (J5a, SPEC §4.7) : la suggestion du plan de course,
 * en texte, à programmer soi-même sur la montre si on le souhaite, ou la prochaine séance de
 * vélo. J5b : le cardio proposé en premier dépend de la phase (vélo en éloignement) et du lieu
 * (vélo, tapis de course) ; l'autre se montre d'un geste (« Plutôt du vélo ? »).
 * Le bouton ouvre la saisie, pré-remplie avec la suggestion.
 */
import { useState } from 'preact/hooks';
import { dayKey, dayToDate } from '../../domain/days';
import type { CardioChoice } from '../../domain/phase';
import { bikeAdvice, bikePlan, runAdvice, runPlan, runSlotLabel } from '../../domain/running';
import { formatShortDate } from '../format';
import { activities, kneeLogs } from '../training';

interface Props {
  /** Cardio proposé (phase et matériel du lieu choisi). */
  choice: CardioChoice;
  onLog: (type: 'run' | 'bike') => void;
}

const SWITCH_LABEL = { run: 'Plutôt courir ?', bike: 'Plutôt du vélo ?' } as const;

export function CardioCard({ choice, onLog }: Props) {
  const [switched, setSwitched] = useState(false);
  const now = new Date();
  const today = dayKey(now);
  const type = switched && choice.alternative ? choice.alternative : choice.primary;
  const other = type === choice.primary ? choice.alternative : choice.primary;
  const switchButton = other && (
    <button type="button" class="btn btn--small btn--quiet cardio-card__switch" onClick={() => setSwitched(!switched)}>
      {SWITCH_LABEL[other]}
    </button>
  );
  if (type === 'bike') {
    const plan = bikePlan(activities.value, kneeLogs.value, now);
    const advice = bikeAdvice(plan);
    const doneToday = activities.value.some((a) => a.type === 'bike' && a.day === today);
    return (
      <section class="card cardio-card" aria-labelledby="cardio-title">
        <span class="card__label">{doneToday ? 'Vélo noté aujourd’hui ✓ · la prochaine' : 'Prochaine séance de vélo'}</span>
        <span id="cardio-title" class="card__title">
          {advice.title}
        </span>
        {advice.lines.map((l) => (
          <span key={l} class="muted">
            {l}
          </span>
        ))}
        <div class="cardio-card__actions">
          <button type="button" class="btn btn--small cardio-card__log" onClick={() => onLog('bike')}>
            Noter une séance de vélo
          </button>
          {switchButton}
        </div>
      </section>
    );
  }

  const plan = runPlan(activities.value, kneeLogs.value, now);
  const advice = runAdvice(plan, choice.treadmill);
  // Course déjà notée aujourd'hui : la carte montre la suivante, il faut que ça se lise.
  const label = plan.ranToday
    ? plan.next
      ? 'Course notée aujourd’hui ✓ · la prochaine'
      : 'Course notée aujourd’hui ✓'
    : plan.next
      ? `Prochaine sortie · ${runSlotLabel(plan)}`
      : 'Course';
  return (
    <section class={`card cardio-card${plan.status === 'rest' ? ' cardio-card--rest' : ''}`} aria-labelledby="cardio-title">
      <span class="card__label">{label}</span>
      <span id="cardio-title" class="card__title">
        {advice.title}
      </span>
      {advice.lines.map((l) => (
        <span key={l} class="muted">
          {l}
        </span>
      ))}
      {plan.noDownhillUntil && plan.status !== 'week-done' && choice.treadmill !== 'only' && (
        <span class="notice-line">
          {plan.started
            ? `Pas de descente raide jusqu’au ${formatShortDate(dayToDate(plan.noDownhillUntil))}.`
            : 'Pas de descente raide pendant les 6 premières semaines.'}
        </span>
      )}
      <div class="cardio-card__actions">
        <button type="button" class="btn btn--small cardio-card__log" onClick={() => onLog('run')}>
          Noter une course
        </button>
        {switchButton}
      </div>
    </section>
  );
}
