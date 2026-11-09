/**
 * Vue « Calendrier » du Carnet.
 *
 * En tête (J5a) : la semaine, avec ‹ › pour remonter le temps, l'objectif renfo / cardio, les
 * minutes de course et de vélo et les trajets de vélotaf ; chaque jour se touche.
 *
 * Puis le mois, semaine par semaine (lundi → dimanche). Par jour, des repères discrets : renfo
 * (point orange), cardio (point rose : course, vélo), séance imposée (anneau), vélotaf (petit
 * trait), journée notée dans l'Assiette (petit point). En bout de ligne, le nombre de séances de
 * la semaine (le vélotaf n'en est pas une). Jamais de série de jours, jamais de jour « manqué »
 * (SPEC §4.10).
 *
 * Toucher un jour ouvre son détail : séances, activités, total de l'Assiette, et de quoi noter
 * après coup une course, un vélotaf ou une séance imposée oubliés.
 *
 * J6a : la semaine en cours montre son planning (jours restants, chacun réglable d'un geste) et
 * les semaines réussies ; une semaine passée dit si elle a été réussie ou mise en pause ; dans le
 * mois, la colonne « Sem. » porte un ✓ pour chaque semaine réussie.
 */
import { useEffect, useState } from 'preact/hooks';
import { mondayOf, monthGrid, monthOf, shiftMonth } from '../../domain/calendar';
import { addDays, dayKey, dayToDate } from '../../domain/days';
import { trainingWeek } from '../../domain/week';
import { sumEntries, type FoodEntry } from '../../domain/nutrition';
import type { WorkoutRecord } from '../../domain/history';
import type { Activity } from '../../domain/recovery';
import { listFoodEntriesBetween } from '../../data/foodRepo';
import { Sheet } from '../components/Sheet';
import { foodTick } from '../foodState';
import { GoalLine, WeekStrip } from '../components/WeekStrip';
import { formatInt, formatLongDate, formatMonth, formatShortDate } from '../format';
import { prefs } from '../state';
import { activities, removeActivity, removeWorkout, renfoDays, workouts } from '../training';
import { CardioSheet } from './CardioSheet';
import { ActivityLine, WorkoutLines } from './common';
import { CommuteSheet } from './CommuteSheet';
import { ImposedSheet } from './ImposedSheet';
import { PlanList, RegularityLine } from '../components/WeekPlanView';
import { cardioChoice } from '../../domain/phase';
import { currentPhaseInfo } from '../phaseState';
import { locations } from '../state';
import { currentPause, currentWeekPlan, weekRegularity } from '../weekState';

/** Saisie après coup depuis le détail d'un jour. */
type LogKind = 'cardio' | 'commute' | 'imposed';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Séances (renfo) d'un jour local. */
const workoutsOn = (list: readonly WorkoutRecord[], day: string) =>
  list.filter((w) => dayKey(new Date(w.endedAt)) === day && w.entries.some((e) => e.sets.length > 0));
const activitiesOn = (list: readonly Activity[], day: string) => list.filter((a) => a.day === day);

export function CalendarView() {
  const today = dayKey(new Date());
  const [month, setMonth] = useState(monthOf(today));
  const [open, setOpen] = useState<string | null>(null);
  const [logging, setLogging] = useState<{ day: string; kind: LogKind } | null>(null);
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
  const results = weekRegularity().results;
  const succeeded = new Set(results.filter((r) => r.verdict === 'success').map((r) => r.monday));

  return (
    <>
      <WeekCard today={today} onDay={setOpen} />

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
            const count = week.reduce(
              (n, d) => n + workoutsOn(w, d).length + activitiesOn(a, d).filter((x) => x.type !== 'commute').length,
              0,
            );
            return [
              ...week.map((d) => {
                const renfo = workoutsOn(w, d).length > 0;
                const acts = activitiesOn(a, d);
                const imposed = acts.filter((x) => x.type === 'imposed');
                const cardio = acts.some((x) => x.type === 'run' || x.type === 'bike');
                const commute = acts.reduce((n, x) => n + (x.type === 'commute' ? x.trips : 0), 0);
                const noted = (food[d]?.length ?? 0) > 0;
                const future = d > today;
                const label = [
                  formatLongDate(dayToDate(d)),
                  renfo && 'séance',
                  cardio && 'cardio',
                  imposed.length > 0 && 'séance imposée',
                  commute > 0 && 'vélotaf',
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
                      {cardio && <span class="cal__mark cal__mark--cardio" />}
                      {imposed.length > 0 && (
                        <span class={`cal__mark cal__mark--imposed${imposed.some((x) => x.kind === 'run') ? ' cal__mark--imposed-run' : ''}`} />
                      )}
                      {noted && <span class="cal__mark cal__mark--food" />}
                    </span>
                    <span class="cal__commute" aria-hidden="true">
                      {commute > 0 && <span class={`cal__dash${commute > 1 ? ' cal__dash--double' : ''}`} />}
                    </span>
                  </button>
                );
              }),
              <span
                key={`${week[0]}-n`}
                class={`cal__week num${succeeded.has(week[0]!) ? ' cal__week--done' : ''}`}
                aria-label={`${count} séance${count > 1 ? 's' : ''} cette semaine${succeeded.has(week[0]!) ? ', semaine réussie' : ''}`}
              >
                {count > 0 ? count : ''}
                {succeeded.has(week[0]!) && <span class="cal__week-check">✓</span>}
              </span>,
            ];
          })}
        </div>

        <div class="cal__legend muted">
          <span>
            <span class="cal__mark cal__mark--renfo" /> renfo
          </span>
          <span>
            <span class="cal__mark cal__mark--cardio" /> cardio
          </span>
          <span>
            <span class="cal__mark cal__mark--imposed" /> imposée
          </span>
          <span>
            <span class="cal__dash" /> vélotaf
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
          onLog={(kind) => {
            setLogging({ day: open, kind });
            setOpen(null);
          }}
        />
      )}
      {logging?.kind === 'cardio' && <CardioSheet day={logging.day} onClose={() => setLogging(null)} />}
      {logging?.kind === 'commute' && <CommuteSheet day={logging.day} onClose={() => setLogging(null)} />}
      {logging?.kind === 'imposed' && <ImposedSheet day={logging.day} onClose={() => setLogging(null)} />}
    </>
  );
}

interface DayProps {
  day: string;
  workouts: WorkoutRecord[];
  activities: Activity[];
  food: FoodEntry[];
  onClose: () => void;
  onLog: (kind: LogKind) => void;
}

/** Détail d'un jour du calendrier. */
function DaySheet({ day, workouts: ws, activities: as, food, onClose, onLog }: DayProps) {
  const totals = sumEntries(food);
  const empty = ws.length === 0 && as.length === 0;

  async function deleteWorkout(w: WorkoutRecord) {
    if (w.id === undefined || !confirm('Supprimer cette séance du carnet ? Les niveaux déjà débloqués restent.')) return;
    await removeWorkout(w.id);
  }

  async function deleteActivity(x: Activity) {
    if (x.id === undefined || !confirm(`Supprimer ${ACTIVITY_NAME[x.type]} ?`)) return;
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

      <span class="card__label">Noter ce jour-là</span>
      <div class="segmented segmented--tight">
        <button type="button" class="btn btn--small" onClick={() => onLog('cardio')}>
          Course · vélo
        </button>
        <button type="button" class="btn btn--small" onClick={() => onLog('commute')}>
          Vélotaf
        </button>
        <button type="button" class="btn btn--small" onClick={() => onLog('imposed')}>
          Imposée
        </button>
      </div>
    </Sheet>
  );
}

/** Pour la confirmation de suppression. */
const ACTIVITY_NAME: Record<Activity['type'], string> = {
  imposed: 'cette séance imposée',
  run: 'cette course',
  bike: 'cette séance de vélo',
  commute: 'ce vélotaf',
};

/**
 * La semaine en tête du calendrier (J5a) : les 7 jours (touchables), l'objectif, les minutes de
 * course et de vélo, les trajets de vélotaf. ‹ › remonte les semaines.
 */
function WeekCard({ today, onDay }: { today: string; onDay: (day: string) => void }) {
  const [monday, setMonday] = useState(mondayOf(today));
  const current = monday === mondayOf(today);
  const week = trainingWeek(monday, renfoDays.value, activities.value);
  const regular = weekRegularity();
  const verdict = regular.results.find((r) => r.monday === monday);
  // Planning : la semaine en cours seulement, et pas en pause.
  const plan = current && !currentPause() ? currentWeekPlan() : null;
  const location = locations.value.find((l) => l.id === prefs.value.lastLocationId);
  const cardio = cardioChoice(currentPhaseInfo(), location?.equipment ?? []).primary;
  const totals = [
    week.runMinutes > 0 && `course ${week.runMinutes} min`,
    week.bikeMinutes > 0 && `vélo ${week.bikeMinutes} min`,
    week.commuteTrips > 0 && `vélotaf ${week.commuteTrips} trajet${week.commuteTrips > 1 ? 's' : ''}`,
  ].filter(Boolean);
  return (
    <section class="card week-detail" aria-label="Semaine">
      <div class="row">
        <button type="button" class="icon-btn icon-btn--round" aria-label="Semaine précédente" onClick={() => setMonday(addDays(monday, -7))}>
          ‹
        </button>
        <h2 class="card__title cal__title">{current ? 'Cette semaine' : `Semaine du ${formatShortDate(dayToDate(monday))}`}</h2>
        <button
          type="button"
          class="icon-btn icon-btn--round"
          aria-label="Semaine suivante"
          disabled={current}
          onClick={() => setMonday(addDays(monday, 7))}
        >
          ›
        </button>
      </div>
      <WeekStrip week={week} today={today} onDay={onDay} {...(plan ? { plan } : {})} />
      {verdict?.paused && verdict.verdict !== 'success' ? (
        <span class="muted">Semaine en pause : elle ne compte ni pour ni contre.</span>
      ) : (
        <GoalLine week={week} goal={verdict && !current ? verdict.goal : prefs.value.weekGoal} />
      )}
      {!current && verdict?.verdict === 'success' && <span class="goal-part goal-part--done">Semaine réussie ✓</span>}
      {totals.length > 0 && <span class="muted week-detail__totals">{totals.join(' · ')}</span>}
      {current && <RegularityLine summary={regular.summary} />}
      {plan && <PlanList plan={plan} goal={prefs.value.weekGoal} cardio={cardio} />}
    </section>
  );
}
