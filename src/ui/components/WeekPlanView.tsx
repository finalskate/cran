/**
 * Planning de la semaine à l'écran (J6a) :
 *  - `PlanLine` : une ligne sur l'accueil, « Aujourd'hui : renfo », ou le soir « Demain : … » ;
 *  - `PlanList` : les jours qui restent, dans le Carnet ; toucher un jour le règle d'un geste
 *    (renfo, cardio, repos, pas dispo, ou laisser Cran choisir), le reste se réarrange ;
 *  - `RegularityLine` : « 4 semaines réussies · 3 sur les 4 dernières ».
 * Un jour de repos s'affiche comme un choix (« Repos prévu ✓ »), jamais comme un manque.
 */
import { useState } from 'preact/hooks';
import { dayToDate } from '../../domain/days';
import type { Regularity } from '../../domain/regularity';
import { choiceWarning, nextPlanned, type CardioSlot, type DayChoice, type PlanDay, type WeekPlan } from '../../domain/weekPlan';
import { formatLongDate, formatShortDate } from '../format';
import { currentWeekPlan, setDayChoice } from '../weekState';
import { Sheet } from './Sheet';

/** L'objectif de la semaine est déjà atteint : les jours restants sont libres. */
const goalDone = (plan: WeekPlan) => plan.remaining.strength === 0 && plan.remaining.cardio === 0;

function slotLabel(slot: CardioSlot | undefined): string {
  if (!slot) return 'Cardio';
  switch (slot.kind) {
    case 'long':
      return `Sortie longue · ${slot.minutes} min`;
    case 'play':
      return `Course · sortie jeu`;
    case 'base':
      return `Course · ${slot.minutes} min`;
    case 'bike':
      return `Vélo · ${slot.minutes} min`;
  }
}

/** Ce qui est prévu un jour, en clair. */
export function planDayLabel(d: PlanDay, plan: WeekPlan): string {
  if (d.kneeRest) return 'Repos ou mobilité (genou sensible)';
  switch (d.kind) {
    case 'strength':
      return d.noLegs ? 'Renfo · sans jambes' : 'Renfo';
    case 'cardio':
      return slotLabel(d.slot);
    case 'off':
      return 'Pas dispo';
    default:
      return goalDone(plan) ? 'Libre' : 'Repos prévu';
  }
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Version réduite quand l'objectif complet ne tient plus : dit simplement, sans reproche. */
function reducedText(plan: WeekPlan, done: { strength: number; cardio: number }): string {
  const s = done.strength + plan.planned.strength;
  const c = done.cardio + plan.planned.cardio;
  return `Cette semaine, vise ${s} renfo${s > 1 ? 's' : ''} + ${c} cardio : le reste ne tient plus sans enchaîner. C’est déjà bien.`;
}

/** Séances déjà faites cette semaine (objectif moins ce qui reste, sans dépasser). */
function doneCounts(plan: WeekPlan, goal: { strength: number; cardio: number }) {
  return { strength: goal.strength - plan.remaining.strength, cardio: goal.cardio - plan.remaining.cardio };
}

/** Ligne de l'accueil : aujourd'hui, ou demain le soir. */
export function PlanLine({ plan, next, today, hour, goal }: { plan: WeekPlan; next?: WeekPlan; today: string; hour: number; goal: { strength: number; cardio: number } }) {
  const item = nextPlanned(plan, today, hour, next);
  if (!item) return null;
  const { day } = item;
  const ref = next && day.day >= next.monday ? next : plan;
  let label = lowerFirst(planDayLabel(day, ref));
  if (item.when === 'today' && day.kind === 'rest' && !day.kneeRest && !goalDone(plan)) label += ' ✓';
  if (day.noLegs) label += ', course demain';
  return (
    <span class="plan-line">
      <span class="plan-line__when">{item.when === 'today' ? 'Aujourd’hui' : 'Demain'} :</span> {label}
      {!plan.reachable && <span class="plan-line__note muted">{reducedText(plan, doneCounts(plan, goal))}</span>}
    </span>
  );
}

/** « 4 semaines réussies · 3 sur les 4 dernières » (rien tant qu'aucune n'est réussie). */
export function RegularityLine({ summary }: { summary: Regularity }) {
  if (summary.total === 0) return null;
  return (
    <span class="regularity-line">
      <span class="num">{summary.total}</span> semaine{summary.total > 1 ? 's' : ''} réussie{summary.total > 1 ? 's' : ''}
      {summary.window >= 2 && (
        <span class="muted">
          {' '}
          · <span class="num">{summary.recent}</span> sur les <span class="num">{summary.window}</span> dernières
        </span>
      )}
    </span>
  );
}

/** Les jours qui restent cette semaine, touchables (Carnet › Calendrier). */
export function PlanList({ plan, goal, cardio }: { plan: WeekPlan; goal: { strength: number; cardio: number }; cardio: 'run' | 'bike' }) {
  const [open, setOpen] = useState<PlanDay | null>(null);
  const upcoming = plan.days.filter((d) => d.status === 'planned');
  if (upcoming.length === 0) return null;
  return (
    <div class="plan-list" aria-label="Planning des jours qui restent">
      <span class="card__label">Planning</span>
      {upcoming.map((d) => (
        <button key={d.day} type="button" class={`planday-row planday-row--${d.kind}`} onClick={() => setOpen(d)}>
          <span class="planday-row__day">{formatShortDate(dayToDate(d.day))}</span>
          <span class="planday-row__what">
            {planDayLabel(d, plan)}
            {d.chosen && <span class="planday-row__chosen"> · réglé</span>}
          </span>
          <span class="planday-row__go" aria-hidden="true">
            ›
          </span>
        </button>
      ))}
      <span class="muted plan-list__hint">
        {goalDone(plan)
          ? 'Objectif atteint ✓ : le reste de la semaine est libre.'
          : !plan.reachable
            ? reducedText(plan, doneCounts(plan, goal))
            : 'Touche un jour pour le changer : le reste se réarrange.'}
      </span>
      {open && <PlanDaySheet day={open} cardio={cardio} onClose={() => setOpen(null)} />}
    </div>
  );
}

const CHOICES: { value: DayChoice; label: (cardio: 'run' | 'bike') => string }[] = [
  { value: 'strength', label: () => 'Renfo' },
  { value: 'cardio', label: (c) => (c === 'bike' ? 'Vélo' : 'Course') },
  { value: 'rest', label: () => 'Repos' },
  { value: 'off', label: () => 'Pas dispo' },
];

/**
 * Régler un jour d'un geste. Un choix qui enfreint une règle (deux renfos d'affilée…) est
 * respecté, mais la feuille reste ouverte pour le dire (J6b).
 */
function PlanDaySheet({ day, cardio, onClose }: { day: PlanDay; cardio: 'run' | 'bike'; onClose: () => void }) {
  const [warning, setWarning] = useState<string | null>(null);
  async function pick(choice: DayChoice | null) {
    await setDayChoice(day.day, choice);
    // Le reste vient d'être réarrangé : on vérifie le choix face au nouveau planning.
    const message = choice ? choiceWarning(currentWeekPlan(), day.day, choice, cardio) : null;
    if (message) setWarning(message);
    else onClose();
  }
  if (warning) {
    return (
      <Sheet open onClose={onClose} title={formatLongDate(dayToDate(day.day))} kicker="Planning">
        <p style={{ margin: 0 }}>C’est noté.</p>
        <p class="notice-line">{warning}</p>
        <button type="button" class="btn" onClick={onClose}>
          Compris
        </button>
      </Sheet>
    );
  }
  return (
    <Sheet open onClose={onClose} title={formatLongDate(dayToDate(day.day))} kicker="Planning">
      <div class="segmented segmented--tight plan-choices" role="group" aria-label="Ce jour-là">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            class="btn"
            aria-pressed={day.chosen === true && day.kind === c.value}
            onClick={() => void pick(c.value)}
          >
            {c.label(cardio)}
          </button>
        ))}
      </div>
      {day.chosen && (
        <button type="button" class="btn btn--quiet" onClick={() => void pick(null)}>
          Laisser Cran choisir
        </button>
      )}
      <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
        Le reste de la semaine se réarrange tout seul, sans jamais doubler une journée : pas deux renfos d’affilée, pas de
        course au lendemain d’une journée qui a chargé les jambes, au moins un jour de repos.
      </p>
    </Sheet>
  );
}
