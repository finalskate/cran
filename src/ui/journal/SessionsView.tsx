/**
 * Vue « Séances » du Carnet (SPEC §4.5) : l'historique se lit comme le carnet Lafay, de la plus
 * récente à la plus ancienne. Date, exercice, séries × répétitions, ressenti « dur » signalé.
 * C'est la vue qui rend la progression tangible.
 */
import { dayKey, dayToDate } from '../../domain/days';
import type { WorkoutRecord } from '../../domain/history';
import type { Activity } from '../../domain/recovery';
import { formatShortDate, SESSION_FEEL_LABEL } from '../format';
import { activities, workouts } from '../training';
import { ActivityLine, WorkoutLines } from './common';

/** Au-delà, la liste devient lourde à faire défiler : le calendrier prend le relais. */
const MAX_SHOWN = 60;

type Item = { day: string; at: string; workout?: WorkoutRecord; activity?: Activity };

export function SessionsView() {
  const items: Item[] = [
    ...workouts.value
      .filter((w) => w.entries.some((e) => e.sets.length > 0))
      .map((w) => ({ day: dayKey(new Date(w.endedAt)), at: w.endedAt, workout: w })),
    ...activities.value.map((a) => ({ day: a.day, at: a.at, activity: a })),
  ]
    .sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at))
    .slice(0, MAX_SHOWN);

  if (items.length === 0) {
    return <p class="muted empty-note">Tes séances apparaîtront ici, comme dans un carnet : exercice, séries, répétitions.</p>;
  }

  return (
    <>
      {items.map((it) => (
        <section key={`${it.at}-${it.workout?.id ?? it.activity?.id}`} class="card log-card">
          <div class="row" style={{ minHeight: 0 }}>
            <span class="card__label">{formatShortDate(dayToDate(it.day))}</span>
            {it.workout?.sessionFeel && <span class="muted log-card__feel">{SESSION_FEEL_LABEL[it.workout.sessionFeel]}</span>}
          </div>
          {it.workout && <WorkoutLines workout={it.workout} />}
          {it.activity && <ActivityLine activity={it.activity} />}
        </section>
      ))}
    </>
  );
}
