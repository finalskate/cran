/**
 * Vue « Calendrier » du Carnet : un mois, semaine par semaine (lundi → dimanche).
 * Par jour, des repères discrets : séance de renfo (point plein), séance imposée (anneau),
 * journée notée dans l'Assiette (petit point). En bout de ligne, le nombre de séances de la
 * semaine. Jamais de série de jours, jamais de jour « manqué » (SPEC §4.10).
 *
 * Toucher un jour ouvre son détail : séances, séance imposée, total de l'Assiette, et la
 * possibilité de noter après coup une séance imposée oubliée.
 */
import { useEffect, useState } from 'preact/hooks';
import { monthGrid, monthOf, shiftMonth } from '../../domain/calendar';
import { dayKey, dayToDate } from '../../domain/days';
import { sumEntries, type FoodEntry } from '../../domain/nutrition';
import type { WorkoutRecord } from '../../domain/history';
import type { Activity } from '../../domain/recovery';
import { listFoodEntriesBetween } from '../../data/foodRepo';
import { Sheet } from '../components/Sheet';
import { foodTick } from '../foodState';
import { formatInt, formatLongDate, formatMonth } from '../format';
import { activities, removeActivity, removeWorkout, workouts } from '../training';
import { ActivityLine, WorkoutLines } from './common';
import { ImposedSheet } from './ImposedSheet';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Séances (renfo) d'un jour local. */
const workoutsOn = (list: readonly WorkoutRecord[], day: string) =>
  list.filter((w) => dayKey(new Date(w.endedAt)) === day && w.entries.some((e) => e.sets.length > 0));
const activitiesOn = (list: readonly Activity[], day: string) => list.filter((a) => a.day === day);

export function CalendarView() {
  const today = dayKey(new Date());
  const [month, setMonth] = useState(monthOf(today));
  const [open, setOpen] = useState<string | null>(null);
  const [imposedDay, setImposedDay] = useState<string | null>(null);
  const [food, setFood] = useState<Record<string, FoodEntry[]>>({});
  const weeks = monthGrid(month);
  const first = weeks[0]![0]!;
  const last = weeks.at(-1)![6]!;
  const tick = foodTick.value;

  // Journées notées dans l'Assiette, sur toute la grille affichée.
  useEffect(() => {
    let alive = true;
    void listFoodEntriesBetween(first, last).then((entries) => {
      const byDay: Record<string, FoodEntry[]> = {};
      for (const e of entries) (byDay[e.day] ??= []).push(e);
      if (alive) setFood(byDay);
    });
    return () => {
      alive = false;
    };
  }, [first, last, tick]);

  const w = workouts.value;
  const a = activities.value;

  return (
    <>
      <section class="card cal" aria-label="Calendrier">
        <div class="row">
          <button type="button" class="icon-btn icon-btn--round" aria-label="Mois précédent" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </button>
          <h2 class="card__title cal__title">{formatMonth(month)}</h2>
          <button
            type="button"
            class="icon-btn icon-btn--round"
            aria-label="Mois suivant"
            disabled={month >= monthOf(today)}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </button>
        </div>

        <div class="cal__grid" role="grid">
          {WEEKDAYS.map((d, i) => (
            <span key={i} class="cal__head" aria-hidden="true">
              {d}
            </span>
          ))}
          <span class="cal__head cal__head--week" aria-hidden="true">
            Sem.
          </span>
          {weeks.map((week) => {
            const count = week.reduce((n, d) => n + workoutsOn(w, d).length + activitiesOn(a, d).length, 0);
            return [
              ...week.map((d) => {
                const renfo = workoutsOn(w, d).length > 0;
                const imposed = activitiesOn(a, d);
                const noted = (food[d]?.length ?? 0) > 0;
                const future = d > today;
                const label = [
                  formatLongDate(dayToDate(d)),
                  renfo && 'séance',
                  imposed.length > 0 && 'séance imposée',
                  noted && 'journée notée',
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <button
                    key={d}
                    type="button"
                    class={`cal__day${monthOf(d) !== month ? ' cal__day--out' : ''}${d === today ? ' cal__day--today' : ''}`}
                    disabled={future}
                    aria-label={label}
                    onClick={() => setOpen(d)}
                  >
                    <span class="num">{Number(d.slice(8))}</span>
                    <span class="cal__marks" aria-hidden="true">
                      {renfo && <span class="cal__mark cal__mark--renfo" />}
                      {imposed.length > 0 && <span class={`cal__mark cal__mark--imposed${imposed.some((x) => x.kind === 'run') ? ' cal__mark--cardio' : ''}`} />}
                      {noted && <span class="cal__mark cal__mark--food" />}
                    </span>
                  </button>
                );
              }),
              <span key={`${week[0]}-n`} class="cal__week num" aria-label={`${count} séance${count > 1 ? 's' : ''} cette semaine`}>
                {count > 0 ? count : ''}
              </span>,
            ];
          })}
        </div>

        <div class="cal__legend muted">
          <span>
            <span class="cal__mark cal__mark--renfo" /> renfo
          </span>
          <span>
            <span class="cal__mark cal__mark--imposed" /> imposée
          </span>
          <span>
            <span class="cal__mark cal__mark--food" /> assiette notée
          </span>
        </div>
      </section>

      {open && (
        <DaySheet
          day={open}
          workouts={workoutsOn(w, open)}
          activities={activitiesOn(a, open)}
          food={food[open] ?? []}
          onClose={() => setOpen(null)}
          onAddImposed={() => {
            setImposedDay(open);
            setOpen(null);
          }}
        />
      )}
      {imposedDay && <ImposedSheet day={imposedDay} onClose={() => setImposedDay(null)} />}
    </>
  );
}

interface DayProps {
  day: string;
  workouts: WorkoutRecord[];
  activities: Activity[];
  food: FoodEntry[];
  onClose: () => void;
  onAddImposed: () => void;
}

/** Détail d'un jour du calendrier. */
function DaySheet({ day, workouts: ws, activities: as, food, onClose, onAddImposed }: DayProps) {
  const totals = sumEntries(food);
  const empty = ws.length === 0 && as.length === 0;

  async function deleteWorkout(w: WorkoutRecord) {
    if (w.id === undefined || !confirm('Supprimer cette séance du carnet ? Les niveaux déjà débloqués restent.')) return;
    await removeWorkout(w.id);
  }

  async function deleteActivity(x: Activity) {
    if (x.id === undefined || !confirm('Supprimer cette séance imposée ?')) return;
    await removeActivity(x.id);
  }

  return (
    <Sheet open onClose={onClose} title={formatLongDate(dayToDate(day))}>
      {ws.map((w) => (
        <div key={w.id} class="day-item">
          <WorkoutLines workout={w} />
          <button type="button" class="btn btn--small btn--quiet" onClick={() => void deleteWorkout(w)}>
            Supprimer
          </button>
        </div>
      ))}
      {as.map((x) => (
        <div key={x.id} class="day-item">
          <ActivityLine activity={x} />
          <button type="button" class="btn btn--small btn--quiet" onClick={() => void deleteActivity(x)}>
            Supprimer
          </button>
        </div>
      ))}
      {empty && <p class="muted">Pas de séance ce jour-là.</p>}

      <div class="row">
        <span class="card__label">Assiette</span>
        <span class="muted">
          {food.length > 0 ? (
            <>
              <span class="num">{formatInt(totals.kcal)}</span> kcal · <span class="num">{formatInt(totals.protein)}</span> g de
              protéines
            </>
          ) : (
            'rien de noté'
          )}
        </span>
      </div>

      <button type="button" class="btn" onClick={onAddImposed}>
        Noter une séance imposée ce jour-là
      </button>
    </Sheet>
  );
}
