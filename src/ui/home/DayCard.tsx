/**
 * Bloc « Ta journée » de l'accueil (21/11) : toujours au même endroit, il remplace quatre cartes
 * (semaine, prochaine sortie, alimentation, poids) et la rangée de raccourcis.
 *  - la semaine : pastilles, objectif, « Aujourd'hui : … » / « Demain : … », semaines réussies,
 *    et « Séance faite ✓ » une fois la séance du jour terminée (toucher → Carnet) ;
 *  - les repas du jour en une ligne (toucher → Assiette) ; les boutons de repas arriveront avec
 *    « Noter vite » ;
 *  - le poids : la tendance, jamais la pesée du jour (toucher → Carnet › Corps, où l'on se pèse
 *    à toute heure) ; avant la toute première pesée, un bouton « Se peser » ;
 *  - « Noter : course · vélo, vélotaf, imposée » (l'ancienne rangée de raccourcis).
 */
import { dayKey } from '../../domain/days';
import { photoDue } from '../../domain/body';
import { sumEntries } from '../../domain/nutrition';
import type { TrainingWeek } from '../../domain/week';
import type { WeekPlan } from '../../domain/weekPlan';
import type { Regularity } from '../../domain/regularity';
import { photos, summary, trend } from '../bodyState';
import { Sparkline } from '../components/SmallCharts';
import { GoalLine, WeekStrip } from '../components/WeekStrip';
import { PlanLine, RegularityLine } from '../components/WeekPlanView';
import { profile, targets } from '../foodState';
import { formatApproxDate, formatInt, formatKg, formatSigned } from '../format';
import { openCalendar } from '../screens/Journal';
import { prefs } from '../state';
import type { FoodEntry } from '../../domain/nutrition';

/** Nombre de pesées montrées dans la petite courbe. */
const SPARK_POINTS = 14;

interface Props {
  now: Date;
  week: TrainingWeek;
  plan: WeekPlan | null;
  next?: WeekPlan;
  paused: boolean;
  regular: Regularity;
  /** Séance du jour faite : son message de récupération (titre seul). */
  doneMessage: string | null;
  entries: FoodEntry[] | null | undefined;
  cantine: boolean;
  onCardio: () => void;
  onCommute: () => void;
  onImposed: () => void;
  /** Ouvre la pesée (panneau tenu par l'écran : il reste ouvert quand la ligne change). */
  onWeigh: () => void;
}

export function DayCard(p: Props) {
  const goal = prefs.value.weekGoal;
  const today = dayKey(p.now);
  return (
    <section class="card day-card" aria-label="Ta journée">
      <button type="button" class="day-card__week week-card" onClick={() => openCalendar()}>
        <div class="row" style={{ minHeight: 0 }}>
          <span class="day-card__name">Cette semaine</span>
          {p.paused ? <span class="muted">Objectif suspendu</span> : <GoalLine week={p.week} goal={goal} />}
        </div>
        <WeekStrip week={p.week} today={today} {...(p.plan ? { plan: p.plan } : {})} />
        {p.doneMessage && (
          <span class="done-line">
            <span class="done-line__check">Séance faite ✓</span> <span class="muted">· {p.doneMessage}</span>
          </span>
        )}
        {p.plan && <PlanLine plan={p.plan} {...(p.next ? { next: p.next } : {})} today={today} hour={p.now.getHours()} goal={goal} />}
        <RegularityLine summary={p.regular} />
      </button>

      <hr class="day-card__rule" />
      <MealsRow entries={p.entries} cantine={p.cantine} />

      <hr class="day-card__rule" />
      <WeightRow today={today} onWeigh={p.onWeigh} />

      <hr class="day-card__rule" />
      <div class="day-card__log">
        <span class="muted">Noter :</span>
        <button type="button" class="btn btn--small" onClick={p.onCardio}>
          Course · vélo
        </button>
        <button type="button" class="btn btn--small" onClick={p.onCommute}>
          Vélotaf
        </button>
        <button type="button" class="btn btn--small" onClick={p.onImposed}>
          Imposée
        </button>
      </div>
    </section>
  );
}

/** Repas du jour en une ligne (provisoire : « Noter vite » la remplacera par un bouton par repas). */
function MealsRow({ entries, cantine }: { entries: FoodEntry[] | null | undefined; cantine: boolean }) {
  const totals = sumEntries(entries ?? []);
  const t = targets.value;
  const noted = (entries?.length ?? 0) > 0;
  let value: string;
  if (cantine) value = noted ? `≈ ${formatInt(totals.kcal)} kcal · ${formatInt(totals.protein)} g de protéines` : '½ légumes, ¼ protéines, ¼ féculents';
  else if (!profile.value) value = 'Calculer ma cible';
  else if (!noted) value = 'Rien de noté pour l’instant';
  else if (t) value = `${formatInt(totals.kcal)} / ${formatInt(t.kcal)} kcal · ${formatInt(totals.protein)} / ${formatInt(t.protein)} g de protéines`;
  else value = `${formatInt(totals.kcal)} kcal · ${formatInt(totals.protein)} g de protéines`;
  return (
    <a class="day-row" href="#/assiette">
      <span class="day-card__name">{cantine ? 'Repas · mode cantine' : 'Repas'}</span>
      <span class="day-row__value">
        {value} <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}

/** Le poids : la tendance (vers Carnet › Corps), ou « Se peser » avant la toute première pesée. */
function WeightRow({ today, onWeigh }: { today: string; onWeigh: () => void }) {
  const s = summary.value;
  const due = photoDue(photos.value, today);
  if (s.trend === null) {
    return (
      <div class="day-row">
        <span class="day-card__name">Poids</span>
        <button type="button" class="btn btn--small" onClick={onWeigh}>
          Se peser
        </button>
      </div>
    );
  }
  const line = s.projection ? `${formatKg(s.projection.goal)} vers ${formatApproxDate(s.projection.day, today)}` : null;
  return (
    <a class="day-row body-card" href="#/corps">
      <div class="body-card__text">
        <span class="day-card__name">Poids · tendance</span>
        <span class="body-card__value num">
          {formatKg(s.trend)}
          {s.rate !== null && <span class={`body-card__rate ${s.direction === 'down' ? 'trend-good' : 'muted'}`}> {formatSigned(s.rate)} kg/sem.</span>}
        </span>
        {line && <span class="muted body-card__line">{line}</span>}
        {due && <span class="notice-line">{photos.value.length > 0 ? 'Photos du mois à faire' : 'Photos de départ à faire'}</span>}
      </div>
      <Sparkline values={trend.value.slice(-SPARK_POINTS).map((x) => x.trend)} />
    </a>
  );
}
