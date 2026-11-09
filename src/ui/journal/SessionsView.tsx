/**
 * Vue « Séances » du Carnet (SPEC §4.5) : l'historique se lit comme le carnet Lafay, de la plus
 * récente à la plus ancienne. Date, exercice, séries × répétitions, ressenti « dur » signalé.
 * C'est la vue qui rend la progression tangible.
 *
 * J3 : en tête, les séances par semaine sur 12 semaines. On compte des semaines, jamais des
 * jours d'affilée (SPEC §2.3).
 * J5a : les courses, le vélo et le vélotaf rejoignent le carnet ; la courbe des séances empile
 * renfo et « cardio et imposées » (le vélotaf n'est pas une séance) ; une 2e courbe montre les
 * minutes de course et de vélo par semaine (SPEC §4.10), dès qu'il y en a.
 * J6a : les records en tête (régularité, série de pompes, plus longue course, chaque exercice).
 * J6b : badges et puzzle de poids avant les records ; séries de la semaine par famille.
 */
import { weeklyCounts } from '../../domain/calendar';
import { activityGoal, weeklyCardioMinutes } from '../../domain/week';
import { dayKey, dayToDate } from '../../domain/days';
import type { WorkoutRecord } from '../../domain/history';
import type { Activity } from '../../domain/recovery';
import { formatShortDate, SESSION_FEEL_LABEL } from '../format';
import { activities, renfoDays, workouts } from '../training';
import { WeeksChart } from '../components/SmallCharts';
import { ActivityLine, WorkoutLines } from './common';
import { RecordsCard } from './RecordsCard';
import { BadgesCard, PuzzleCard, WeekSetsCard } from '../components/PrideCards';

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

  const today = dayKey(new Date());
  const weeks = weeklyCounts(
    renfoDays.value,
    activities.value.filter((a) => activityGoal(a) !== null).map((a) => a.day),
    today,
    WEEKS_SHOWN,
  );
  const cardio = weeklyCardioMinutes(activities.value, today, WEEKS_SHOWN);
  const cardioTotal = cardio.reduce((n, w) => n + w.run + w.bike, 0);

  return (
    <>
      <BadgesCard />
      <PuzzleCard />
      <RecordsCard />
      <WeekSetsCard />
      <section class="card" aria-labelledby="weeks-title">
        <div class="row" style={{ minHeight: 0 }}>
          <h2 id="weeks-title" class="card__title">
            Séances par semaine
          </h2>
          <span class="muted num">cette semaine : {weeks.at(-1)!.renfo + weeks.at(-1)!.other}</span>
        </div>
        <WeeksChart
          weeks={weeks.map((w) => ({ monday: w.monday, low: w.renfo, high: w.other }))}
          label={(total) => `Séances par semaine sur ${weeks.length} semaines : ${total} au total`}
        />
        <div class="chart-legend muted">
          <span>
            <i class="chart-legend__box" aria-hidden="true" />
            renfo
          </span>
          <span>
            <i class="chart-legend__box chart-legend__box--alt" aria-hidden="true" />
            cardio et imposées
          </span>
        </div>
      </section>
      {cardioTotal > 0 && (
        <section class="card" aria-labelledby="cardio-weeks-title">
          <div class="row" style={{ minHeight: 0 }}>
            <h2 id="cardio-weeks-title" class="card__title">
              Minutes de cardio
            </h2>
            <span class="muted num">cette semaine : {cardio.at(-1)!.run + cardio.at(-1)!.bike} min</span>
          </div>
          <WeeksChart
            weeks={cardio.map((w) => ({ monday: w.monday, low: w.run, high: w.bike }))}
            floor={60}
            label={(total) => `Minutes de course et de vélo sur ${cardio.length} semaines : ${total} au total`}
          />
          <div class="chart-legend muted">
            <span>
              <i class="chart-legend__box" aria-hidden="true" />
              course
            </span>
            <span>
              <i class="chart-legend__box chart-legend__box--alt" aria-hidden="true" />
              vélo
            </span>
          </div>
        </section>
      )}
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
