/**
 * Carte « Prochaine sortie » de l'accueil (J5a, SPEC §4.7) : la suggestion du plan de course,
 * en texte, à programmer soi-même sur la montre si on le souhaite. Sur un lieu équipé d'un vélo
 * (éloignement, base équipée), elle propose la prochaine séance de vélo à la place.
 * Le bouton ouvre la saisie, pré-remplie avec la suggestion.
 */
import { dayKey, dayToDate } from '../../domain/days';
import { bikeAdvice, bikePlan, runAdvice, runPlan, runSlotLabel } from '../../domain/running';
import { formatShortDate } from '../format';
import { activities, kneeLogs } from '../training';

interface Props {
  /** Le lieu choisi a un vélo : suggestion de vélo plutôt que de course. */
  bike: boolean;
  onLog: (type: 'run' | 'bike') => void;
}

export function CardioCard({ bike, onLog }: Props) {
  const now = new Date();
  const today = dayKey(now);
  if (bike) {
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
        <button type="button" class="btn btn--small cardio-card__log" onClick={() => onLog('bike')}>
          Noter une séance de vélo
        </button>
      </section>
    );
  }

  const plan = runPlan(activities.value, kneeLogs.value, now);
  const advice = runAdvice(plan);
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
      {plan.noDownhillUntil && plan.status !== 'week-done' && (
        <span class="notice-line">
          {plan.started
            ? `Pas de descente raide jusqu’au ${formatShortDate(dayToDate(plan.noDownhillUntil))}.`
            : 'Pas de descente raide pendant les 6 premières semaines.'}
        </span>
      )}
      <button type="button" class="btn btn--small cardio-card__log" onClick={() => onLog('run')}>
        Noter une course
      </button>
    </section>
  );
}
