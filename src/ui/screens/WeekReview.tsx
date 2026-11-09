/**
 * Bilan du dimanche (J6b, SPEC §4.10, maquette validée le 09/11) : un seul écran, ouvert depuis
 * l'accueil le dimanche dès 17 h (rattrapable le lundi jusqu'à midi).
 *
 * De haut en bas : la semaine (réussie ou non, sans reproche), ce dont être fier (niveaux,
 * records, plus longue course, badges, pièce de puzzle), la tendance de poids, l'assiette (bilans
 * du soir, écarts, le déclencheur le plus fréquent et le plan prévu pour lui), le genou (sobre).
 * Puis l'objectif de la semaine suivante, confirmé d'un geste : il part du lundi, la semaine qui
 * s'achève reste jugée sur le sien.
 */
import { useEffect, useState } from 'preact/hooks';
import { BADGES } from '../../data/badges';
import { TRIGGER_LABEL } from '../../data/habits';
import { track } from '../../data/usage';
import { weightBadges } from '../../domain/badges';
import { addDays, dayToDate } from '../../domain/days';
import { weekSummary } from '../../domain/habits';
import { trainingWeek, WEEK_GOAL_MAX, type WeekGoal } from '../../domain/week';
import { weekHighlights } from '../../domain/weekReview';
import { GoalLine, WeekStrip } from '../components/WeekStrip';
import { Sparkline } from '../components/SmallCharts';
import { Stepper } from '../components/Stepper';
import { planDayLabel, RegularityLine } from '../components/WeekPlanView';
import { formatKg, formatShortDate, formatSigned } from '../format';
import { formatRecord, variantInfo } from '../journal/RecordsCard';
import { summary, trend, weightGoals } from '../bodyState';
import { plans, reviews } from '../habitsState';
import { movementById } from '../planner';
import { confirmWeekReview, dayOfIso, puzzleNow, weekReviewNow } from '../prideState';
import { go } from '../router';
import { levelHistory, prefs } from '../state';
import { activities, kneeLogs, renfoDays, workouts } from '../training';
import { weekPlanFor, weekRegularity } from '../weekState';

export function WeekReview() {
  // La semaine est fixée à l'ouverture : confirmer la fait disparaître de l'accueil, pas d'ici.
  const [monday] = useState(() => weekReviewNow());
  const [goal, setGoal] = useState<WeekGoal>(prefs.value.weekGoal);

  useEffect(() => {
    if (!monday) go('today', true);
    else track('week-review', { action: 'open', monday });
  }, [monday]);
  if (!monday) return null;

  const sunday = addDays(monday, 6);
  const inWeek = (day: string) => day >= monday && day <= sunday;
  const week = trainingWeek(monday, renfoDays.value, activities.value);
  const { results, summary: regular } = weekRegularity();
  const result = results.find((r) => r.monday === monday);
  const weekGoal = result?.goal ?? prefs.value.weekGoal;
  const success = result?.verdict === 'success';
  const highlights = weekHighlights(monday, workouts.value, activities.value, levelHistory.value, kneeLogs.value, dayOfIso);
  const defs = [...BADGES, ...weightBadges(weightGoals.value)];
  const newBadges = defs.filter((d) => inWeek(prefs.value.badges[d.id] ?? ''));
  const puzzle = puzzleNow();
  const pieces = puzzle ? puzzle.earnedOn.filter(inWeek).length : 0;
  const food = weekSummary(reviews.value, sunday);
  const topTrigger = food.triggers[0];
  const plan = topTrigger ? plans.value.find((p) => p.trigger === topTrigger.trigger) : undefined;
  const s = summary.value;
  const renfoMinutes = workouts.value
    .filter((w) => inWeek(dayOfIso(w.endedAt)) && w.entries.some((e) => e.sets.length > 0))
    .reduce((n, w) => n + Math.round((Date.parse(w.endedAt) - Date.parse(w.startedAt)) / 60_000), 0);
  const nextPlan = weekPlanFor(addDays(monday, 7), new Date(), goal);
  const preview = nextPlan.days.filter((d) => d.kind === 'strength' || d.kind === 'cardio').slice(0, 3);
  const pride = highlights.levelUps.length + highlights.records.length + newBadges.length + (highlights.longestRun ? 1 : 0) + pieces;
  const same = goal.strength === prefs.value.weekGoal.strength && goal.cardio === prefs.value.weekGoal.cardio;

  async function confirm() {
    await confirmWeekReview(monday!, goal);
    go('today', true);
  }

  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Semaine du {formatShortDate(dayToDate(monday))} · bilan</span>
        <h1 class="screen-header__title">{success ? 'Semaine réussie ✓' : 'Ta semaine'}</h1>
        <RegularityLine summary={regular} />
      </header>

      <section class="card" aria-label="La semaine">
        <div class="row" style={{ minHeight: 0 }}>
          <span class="card__label">Séances</span>
          <GoalLine week={week} goal={weekGoal} />
        </div>
        <WeekStrip week={week} today={sunday} />
        <div class="review-stats">
          <div>
            <span class="review-stats__n num">{week.strength}</span>
            <span class="muted">renfo{week.strength > 1 ? 's' : ''}{renfoMinutes > 0 ? ` · ${renfoMinutes} min` : ''}</span>
          </div>
          <div>
            <span class="review-stats__n num">{week.runMinutes + week.bikeMinutes} min</span>
            <span class="muted">de cardio</span>
          </div>
          <div>
            <span class="review-stats__n num">{week.commuteTrips}</span>
            <span class="muted">trajet{week.commuteTrips > 1 ? 's' : ''} vélotaf</span>
          </div>
        </div>
        {!success && result?.verdict !== 'neutral' && (
          <span class="muted">Pas l’objectif complet cette fois : ce qui est fait reste fait, et compte pour la suite.</span>
        )}
        {result?.paused && !success && <span class="muted">Semaine en pause : elle ne compte ni pour ni contre.</span>}
      </section>

      {pride > 0 && (
        <section class="card record-card" aria-label="Fierté de la semaine">
          <span class="card__label">Fierté de la semaine</span>
          {highlights.levelUps.map((u) => (
            <div key={u.movementId} class="row records__row">
              <span>{movementById(u.movementId)?.name}</span>
              <strong>niveau {u.level + 1} débloqué</strong>
            </div>
          ))}
          {highlights.records.map((r) => (
            <div key={`${r.variantId}|${r.band ?? ''}`} class="row records__row">
              <span class="records__name">Record · {variantInfo(r.movementId, r.variantId).name}</span>
              <span>
                <strong class="num">{formatRecord(r)}</strong> <span class="muted">(avant {formatRecord({ ...r, value: r.previous })})</span>
              </span>
            </div>
          ))}
          {highlights.longestRun && (
            <div class="row records__row">
              <span>Plus longue course</span>
              <strong class="num">{highlights.longestRun} min</strong>
            </div>
          )}
          {newBadges.map((b) => (
            <div key={b.id} class="row records__row">
              <span>Nouveau badge</span>
              <strong>{b.label}</strong>
            </div>
          ))}
          {pieces > 0 && puzzle && (
            <div class="row records__row">
              <span>Puzzle de l’étape {formatKg(puzzle.goal)}</span>
              <strong>
                +{pieces} pièce{pieces > 1 ? 's' : ''} · {puzzle.earned}/{puzzle.thresholds.length}
              </strong>
            </div>
          )}
        </section>
      )}

      {s.trend !== null && (
        <a class="card card--link body-card" href="#/corps">
          <div class="body-card__text">
            <span class="card__label">Poids · tendance</span>
            <span class="body-card__value num">
              {formatKg(s.trend)}
              {s.rate !== null && <span class={`body-card__rate ${s.direction === 'down' ? 'trend-good' : 'muted'}`}> {formatSigned(s.rate)} kg/sem.</span>}
            </span>
            {puzzle && <span class="muted">Puzzle de l’étape : {puzzle.earned} pièce{puzzle.earned > 1 ? 's' : ''} sur {puzzle.thresholds.length}</span>}
          </div>
          <Sparkline values={trend.value.slice(-14).map((p) => p.trend)} />
        </a>
      )}

      {food.reviews > 0 && (
        <section class="card" aria-label="Assiette">
          <span class="card__label">Assiette</span>
          <div class="row records__row">
            <span>Bilans du soir</span>
            <strong class="num">{food.reviews} sur 7</strong>
          </div>
          <div class="row records__row">
            <span>Protéines au rendez-vous</span>
            <strong class="num">{food.proteinDays} jour{food.proteinDays > 1 ? 's' : ''}</strong>
          </div>
          <div class="row records__row">
            <span>Écarts</span>
            <span>{food.slips === 0 ? 'aucun' : `${food.slips}${food.bigSlips > 0 ? `, dont ${food.bigSlips} gros` : ''}`}</span>
          </div>
          {topTrigger && (
            <div class="review-trigger">
              <span class="muted">Déclencheur le plus fréquent : {TRIGGER_LABEL[topTrigger.trigger].toLowerCase()}</span>
              {plan && (
                <span>
                  Ton plan : « Si {plan.when}, alors {plan.then}. »
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {highlights.kneeMax !== null && (
        <section class="card" aria-label="Genou">
          <span class="card__label">Genou</span>
          <span>
            {highlights.kneeMax <= 2
              ? `Calme toute la semaine (${highlights.kneeMax} au plus).`
              : `Jusqu’à ${highlights.kneeMax} cette semaine : la séance s’est adaptée. Si ça dure, parles-en au kiné.`}
          </span>
        </section>
      )}

      <section class="card" aria-labelledby="next-goal">
        <span id="next-goal" class="card__label">
          La semaine prochaine
        </span>
        <div class="row">
          <span>Renfo</span>
          <Stepper label="Renfos la semaine prochaine" value={goal.strength} onChange={(v) => setGoal({ ...goal, strength: v })} step={1} min={0} max={WEEK_GOAL_MAX} />
        </div>
        <div class="row">
          <span>Cardio</span>
          <Stepper label="Cardio la semaine prochaine" value={goal.cardio} onChange={(v) => setGoal({ ...goal, cardio: v })} step={1} min={0} max={WEEK_GOAL_MAX} />
        </div>
        {preview.length > 0 && (
          <span class="muted">
            Pour commencer :{' '}
            {preview.map((d) => `${formatShortDate(dayToDate(d.day)).split(' ')[0]} ${planDayLabel(d, nextPlan).toLowerCase()}`).join(' · ')}
          </span>
        )}
      </section>

      <div class="bottom-zone">
        <button class="cta" type="button" onClick={() => void confirm()}>
          <span class="cta__title">
            {same ? 'Garder' : 'Valider'} {goal.strength} + {goal.cardio} · c’est parti
          </span>
        </button>
      </div>
    </main>
  );
}
