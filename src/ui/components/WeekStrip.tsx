/**
 * La semaine en un coup d'œil (J5a, SPEC §4.1) : 7 pastilles du lundi au dimanche et l'objectif
 * « Renfo 2/3 · Cardio 1/2 ». Par jour : point orange = renfo, point rose = cardio (course, vélo,
 * séance imposée cardio), petit trait = vélotaf. Rien n'est montré pour un jour sans séance :
 * pas de « jour manqué » (SPEC §2.3).
 *
 * Sur l'accueil, la carte entière mène au Carnet ; dans le calendrier, chaque jour se touche.
 */
import { dayToDate } from '../../domain/days';
import type { TrainingWeek, WeekGoal } from '../../domain/week';
import { formatLongDate } from '../format';

const LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** « Renfo 2/3 · Cardio 1/2 », avec un ✓ par objectif atteint. */
export function GoalLine({ week, goal }: { week: TrainingWeek; goal: WeekGoal }) {
  const part = (label: string, n: number, target: number) =>
    target > 0 && (
      <span class={n >= target ? 'goal-part goal-part--done' : 'goal-part'}>
        {label} <span class="num">{n}/{target}</span>
        {n >= target ? ' ✓' : ''}
      </span>
    );
  return (
    <span class="goal-line">
      {part('Renfo', week.strength, goal.strength)}
      {part('Cardio', week.cardio, goal.cardio)}
    </span>
  );
}

interface Props {
  week: TrainingWeek;
  today: string;
  /** Jours touchables (calendrier) : ouvre le détail du jour. */
  onDay?: (day: string) => void;
}

export function WeekStrip({ week, today, onDay }: Props) {
  return (
    <div class="week-strip" role={onDay ? undefined : 'img'} aria-label={onDay ? undefined : stripLabel(week)}>
      {week.days.map((d, i) => {
        const future = d.day > today;
        const marks = (
          <>
            <span class="week-strip__letter" aria-hidden="true">
              {LETTERS[i]}
            </span>
            <span class="week-strip__dots" aria-hidden="true">
              {d.strength && <span class="cal__mark cal__mark--renfo" />}
              {d.cardio && <span class="cal__mark cal__mark--cardio" />}
            </span>
            <span class="week-strip__commute" aria-hidden="true">
              {d.commute > 0 && <span class={`cal__dash${d.commute > 1 ? ' cal__dash--double' : ''}`} />}
            </span>
          </>
        );
        const cls = `week-strip__day${d.day === today ? ' week-strip__day--today' : ''}${future ? ' week-strip__day--future' : ''}`;
        return onDay ? (
          <button key={d.day} type="button" class={cls} disabled={future} aria-label={dayLabel(d)} onClick={() => onDay(d.day)}>
            {marks}
          </button>
        ) : (
          <span key={d.day} class={cls}>
            {marks}
          </span>
        );
      })}
    </div>
  );
}

function dayLabel(d: TrainingWeek['days'][number]): string {
  return [formatLongDate(dayToDate(d.day)), d.strength && 'renfo', d.cardio && 'cardio', d.commute > 0 && 'vélotaf']
    .filter(Boolean)
    .join(', ');
}

function stripLabel(w: TrainingWeek): string {
  const n = (k: 'strength' | 'cardio') => w.days.filter((d) => d[k]).length;
  return `Cette semaine : ${n('strength')} jour${n('strength') > 1 ? 's' : ''} de renfo, ${n('cardio')} de cardio, ${w.commuteTrips} trajet${w.commuteTrips > 1 ? 's' : ''} de vélotaf`;
}
