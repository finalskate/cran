/**
 * Vue « Séances » du Carnet (SPEC §4.5) : l'historique se lit comme le carnet Lafay, de la plus
 * récente à la plus ancienne. Date, exercice, séries × répétitions, ressenti « dur » signalé.
 * C'est la vue qui rend la progression tangible.
 *
 * J3 : en tête, les séances par semaine sur 12 semaines (renfo et imposées). On compte des
 * semaines, jamais des jours d'affilée (SPEC §2.3).
 */
import { weeklyCounts } from '../../domain/calendar';
import { dayKey, dayToDate } from '../../domain/days';
import type { WorkoutRecord } from '../../domain/history';
import type { Activity } from '../../domain/recovery';
import { formatShortDate, SESSION_FEEL_LABEL } from '../format';
import { activities, workouts } from '../training';
import { WeeksChart } from '../components/SmallCharts';
import { ActivityLine, WorkoutLines } from './common';

/** Semaines montrées dans la courbe des séances. */
const WEEKS_SHOWN = 12;

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

  const weeks = weeklyCounts(
    workouts.value.filter((w) => w.entries.some((e) => e.sets.length > 0)).map((w) => dayKey(new Date(w.endedAt))),
    activities.value.filter((a) => a.type === 'imposed').map((a) => a.day),
    dayKey(new Date()),
    WEEKS_SHOWN,
  );

  return (
    <>
      <section class="card" aria-labelledby="weeks-title">
        <div class="row" style={{ minHeight: 0 }}>
          <h2 id="weeks-title" class="card__title">
            Séances par semaine
          </h2>
          <span class="muted num">cette semaine : {weeks.at(-1)!.renfo + weeks.at(-1)!.imposed}</span>
        </div>
        <WeeksChart weeks={weeks} />
        <div class="chart-legend muted">
          <span>
            <i class="chart-legend__box" aria-hidden="true" />
            renfo
          </span>
          <span>
            <i class="chart-legend__box chart-legend__box--alt" aria-hidden="true" />
            imposées
          </span>
        </div>
      </section>
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
