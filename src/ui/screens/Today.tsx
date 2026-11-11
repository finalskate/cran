/**
 * Écran « Aujourd'hui » (SPEC §4.1) : lieu et durée pré-remplis, gros bouton Démarrer en bas.
 * Une séance en cours se reprend d'ici. Carte Alimentation (J4) : total du jour et cible ;
 * invitation à la pesée le matin, sans insistance (une fois pesé, elle laisse place à un ✓).
 *
 * J2 : séance déjà faite aujourd'hui → récupération conseillée, une 2e séance reste possible
 * (bouton secondaire) ; « genou ce matin » après une journée qui a chargé les jambes ;
 * raccourci « Imposée » pour noter une séance de sport au travail.
 * J3 : carte « Poids » (tendance, rythme, projection, petite courbe) vers Carnet › Corps,
 * avec un rappel discret des photos du mois.
 * J4B : bilan du soir proposé dès 19 h, rattrapable le lendemain jusqu'à 11 h (« Et hier ? »),
 * une fois la calibration terminée (pendant la calibration, il reste accessible dans l'Assiette).
 * J5a : la semaine (7 pastilles + objectif renfo / cardio, vers le Carnet), la carte « Prochaine
 * sortie » (suggestion de course, ou de vélo sur un lieu équipé d'un vélo), raccourcis
 * « Course · vélo » et « Vélotaf ». Le raccourci « Lieux » est passé dans Réglages.
 * J5b : la phase en cours dans l'en-tête, l'annonce d'une phase qui commence (changement
 * programmé), le cardio proposé selon la phase et le lieu, et en mode cantine l'assiette type.
 * J6a : dans la carte de la semaine, le planning (points creux, « Aujourd'hui : … » ou le soir
 * « Demain : … ») et les semaines réussies ; en pause, une carte « En pause » et l'objectif
 * suspendu (pas de suggestion de cardio) ; un rappel de sauvegarde discret après 7 jours sans export.
 * J6b : le bilan du dimanche (dès 17 h, rattrapable lundi midi) et le test pompes du mois.
 * Retouche du 11/11 : le plan « si… alors… » du moment (après le vélo, le soir, ou un déclencheur
 * de la journée), AVANT la situation plutôt qu'au bilan ; « Vu » le fait taire pour la journée.
 */
import { useState } from 'preact/hooks';
import { clearActiveSession } from '../../data/repo';
import { DURATIONS, type Duration } from '../../domain/types';
import { CATALOG } from '../../data/catalog';
import { REST_DAY } from '../../data/messages';
import { dayKey, dayToDate } from '../../domain/days';
import { calibrationDay, foodDay, latestWeight, sumEntries } from '../../domain/nutrition';
import { reviewPrompt } from '../../domain/habits';
import { dailyMessage } from '../../domain/messages';
import { photoDue } from '../../domain/body';
import { askMorningKnee, sessionDoneToday } from '../../domain/recovery';
import { progress } from '../../domain/session';
import { Sparkline } from '../components/SmallCharts';
import { DayMeters, NutrientsLine } from '../food/common';
import { WeighSheet } from '../food/WeighSheet';
import { ImposedSheet } from '../journal/ImposedSheet';
import { CardioSheet } from '../journal/CardioSheet';
import { CommuteSheet } from '../journal/CommuteSheet';
import { CardioCard } from '../components/CardioCard';
import { CantinePlate } from '../food/CantinePlate';
import { PHASES } from '../../data/phases';
import { cardioChoice } from '../../domain/phase';
import { currentPhaseInfo, dismissPhaseNotice, phaseChanges, phaseNotice } from '../phaseState';
import { GoalLine, WeekStrip } from '../components/WeekStrip';
import { weekOf } from '../../domain/week';
import { track } from '../../data/usage';
import { openCalendar } from './Journal';
import { PlanLine, RegularityLine } from '../components/WeekPlanView';
import { lastTestText, PushupTestSheet } from '../components/PushupTestSheet';
import { pushupTestNow, snoozePushupTest, weekReviewNow } from '../prideState';
import { currentPause, currentWeekPlan, exportDue, nextWeekPlan, resume, runExport, snoozeExport, weekRegularity } from '../weekState';
import { ReviewSheet } from '../food/ReviewSheet';
import { calibrationStart, profile, targets, useDayEntries, weights } from '../foodState';
import { dismissPlanMoment, planMomentNow, reviewedDays } from '../habitsState';
import { TRIGGER_LABEL } from '../../data/habits';
import type { PlanMoment } from '../../domain/habits';
import { PlanText } from '../food/PlanForm';
import { PlansSheet } from '../food/PlansSheet';
import { photos, summary, trend } from '../bodyState';
import { formatApproxDate, formatKg, formatLongDate, formatShortDate, formatSigned } from '../format';
import type { WeekPlan } from '../../domain/weekPlan';
import { go } from '../router';
import { levels, locations, prefs, ready, session, setPref, updateSession } from '../state';
import { activities, answerMorningKnee, kneeLogs, renfoDays, workouts } from '../training';
import { RemarkButton } from '../components/RemarkSheet';

const DURATION_LABEL: Record<Duration, string> = { 10: '10 min', 20: '20 min', 30: '30 min', 40: '40 min et +' };

/** Mouvements dont le niveau se choisit (tout sauf les exercices tournants de prévention et l'échauffement). */
const LEVELED = CATALOG.filter((m) => m.levels.length > 1);

export function Today() {
  const p = prefs.value;
  const active = session.value;
  const levelsChosen = LEVELED.some((m) => levels.value[m.id] !== undefined);
  const now = new Date();
  const entries = useDayEntries(foodDay(now));
  const last = latestWeight(weights.value);
  const weighedToday = last?.day === dayKey(now);
  const [weighing, setWeighing] = useState(false);
  const [imposing, setImposing] = useState(false);
  const [cardio, setCardio] = useState<{ type?: 'run' | 'bike' } | null>(null);
  const [commuting, setCommuting] = useState(false);
  const location = locations.value.find((l) => l.id === p.lastLocationId);
  const phase = currentPhaseInfo(now);
  const notice = ready.value ? phaseNotice(now) : null;
  const cardioFor = cardioChoice(phase, location?.equipment ?? []);
  const week = weekOf(dayKey(now), renfoDays.value, activities.value);
  const pause = currentPause(now);
  const plan = ready.value && !pause ? currentWeekPlan(now) : null;
  const regular = weekRegularity(now).summary;
  const backup = ready.value ? exportDue(now) : null;
  const reviewWeek = ready.value ? weekReviewNow(now) : null;
  const pushupTest = ready.value && !pause ? pushupTestNow(now) : null;
  const [testing, setTesting] = useState(false);
  const moment = ready.value ? planMomentNow(now) : null;
  const [editingPlans, setEditingPlans] = useState(false);

  function openCardio(type: 'run' | 'bike' | undefined, from: 'shortcut' | 'card') {
    track('cardio-sheet', { from, type });
    setCardio(type ? { type } : {});
  }
  const [reviewing, setReviewing] = useState<{ day: string; via: 'evening' | 'catch-up' } | null>(null);
  // Bilan du soir : après la calibration seulement (elle demande déjà de tout noter).
  const calibrating = !!calibrationStart.value && calibrationDay(calibrationStart.value, foodDay(now)) !== null;
  const prompt = ready.value && profile.value && !calibrating ? reviewPrompt(now, reviewedDays.value) : null;
  const doneToday = sessionDoneToday(workouts.value, now);
  // Message de récupération : change chaque jour, reste le même toute la journée.
  const restMessage = dailyMessage(REST_DAY, dayKey(now), 'rest-day');
  const askKnee = ready.value && askMorningKnee(now, workouts.value, activities.value, kneeLogs.value, CATALOG);

  async function abandon() {
    if (!confirm('Abandonner la séance en cours ? Les séries faites ne seront pas enregistrées.')) return;
    updateSession(null);
    await clearActiveSession();
  }

  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">
          {formatLongDate(now)}
          {phase && ` · ${phase.label}`}
        </span>
        <h1 class="screen-header__title">Aujourd'hui</h1>
        <RemarkButton />
      </header>

      {active && active.phase !== 'done' && (
        <section class="card" aria-labelledby="resume-title">
          <span class="card__label">Séance en cours</span>
          <h2 id="resume-title" class="card__title">
            {progress(active).done} séries sur {progress(active).total}
          </h2>
          <div class="segmented">
            <button class="btn" type="button" onClick={() => void abandon()}>
              Abandonner
            </button>
            <button class="btn btn--accent" type="button" onClick={() => go('session')}>
              Reprendre
            </button>
          </div>
        </section>
      )}

      {pause && (
        <section class="card pause-card" aria-labelledby="pause-title">
          <span class="card__label">Mode pause</span>
          <span id="pause-title" class="card__title">
            {pause.until ? `En pause jusqu’au ${formatShortDate(dayToDate(pause.until))}` : 'En pause'}
          </span>
          <span class="muted">L’objectif de la semaine est suspendu, rien n’est perdu. Une séance reste possible quand tu veux.</span>
          <button type="button" class="btn btn--small" onClick={() => void resume()}>
            Reprendre
          </button>
        </section>
      )}

      {notice && (
        <section class="card" aria-labelledby="phase-notice">
          <span class="card__label">Nouvelle phase</span>
          <span id="phase-notice" class="card__title">
            {PHASES[notice.id].label} · c’est parti
          </span>
          <ul class="phase-changes">
            {phaseChanges(notice.id).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <span class="muted">Tout reste modifiable : lieu et durée en bas, objectif et phase dans Réglages.</span>
          <button type="button" class="btn btn--small" onClick={() => void dismissPhaseNotice(notice)}>
            Compris
          </button>
        </section>
      )}

      {reviewWeek && (
        <a class="card card--link review-card" href="#/bilan-semaine">
          <span class="card__label">Bilan de la semaine · 1 min</span>
          <span class="card__title">Ta semaine en un coup d’œil</span>
          <span class="muted">Ce que tu as fait, ce dont être fier, et l’objectif de la semaine prochaine. →</span>
        </a>
      )}

      {ready.value && !levelsChosen && (
        <a class="card card--link" href="#/niveaux">
          <span class="card__label">Première fois</span>
          <span class="card__title">Choisis ton niveau pour chaque mouvement</span>
          <span class="muted">À la main, ou avec « Tester mon niveau » : une série max suffit. →</span>
        </a>
      )}

      {doneToday && !active && (
        <section class="card done-today" aria-label="Séance faite">
          <span class="card__label">Séance faite aujourd’hui ✓</span>
          <span class="card__title">{restMessage.title}</span>
          <span class="muted">{restMessage.body}</span>
        </section>
      )}

      {askKnee && (
        <section class="card" aria-labelledby="morning-knee">
          <span class="card__label">Genou du lendemain</span>
          <span id="morning-knee" class="card__title">
            Ton genou ce matin ?
          </span>
          <span class="muted">Hier, tes jambes ont travaillé. C’est souvent le matin qu’on sent le mieux une tendinite.</span>
          <div class="segmented">
            <button type="button" class="btn" onClick={() => void answerMorningKnee(false)}>
              Pareil
            </button>
            <button type="button" class="btn" onClick={() => void answerMorningKnee(true)}>
              Plus mal
            </button>
          </div>
        </section>
      )}

      {/* Le matin, tant que la pesée du jour n'est pas faite : une invitation, pas un rappel. */}
      {ready.value && !weighedToday && now.getHours() >= 5 && now.getHours() < 11 && (
        <button type="button" class="card card--link card--button" onClick={() => setWeighing(true)}>
          <span class="card__label">Pesée du matin</span>
          <span class="card__title">20 secondes sur la balance ?</span>
          <span class="muted">Au réveil, avant de manger. C’est la tendance qui compte, pas le chiffre du jour.</span>
        </button>
      )}

      {prompt && (
        <button
          type="button"
          class="card card--link card--button"
          onClick={() => setReviewing({ day: prompt.day, via: prompt.kind === 'today' ? 'evening' : 'catch-up' })}
        >
          <span class="card__label">Bilan du soir · 30 s</span>
          <span class="card__title">{prompt.kind === 'today' ? 'Comment s’est passée ta journée ?' : 'Et hier, côté assiette ?'}</span>
          <span class="muted">Légumes, écart éventuel et ce qui l’a déclenché. Les protéines notées sont déjà comptées.</span>
        </button>
      )}

      {moment && <PlanMomentCard moment={moment} onEdit={() => setEditingPlans(true)} />}

      {ready.value && (
        <button type="button" class="card card--link card--button card--quiet week-card" onClick={() => openCalendar()}>
          <div class="row" style={{ minHeight: 0 }}>
            <span class="card__label">Cette semaine</span>
            {pause ? <span class="muted">Objectif suspendu</span> : <GoalLine week={week} goal={p.weekGoal} />}
          </div>
          <WeekStrip week={week} today={dayKey(now)} {...(plan ? { plan } : {})} />
          {plan && (
            <PlanLine plan={plan} {...nextWeekProp(now)} today={dayKey(now)} hour={now.getHours()} goal={p.weekGoal} />
          )}
          <RegularityLine summary={regular} />
        </button>
      )}

      {ready.value && !pause && <CardioCard choice={cardioFor} onLog={(type) => openCardio(type, 'card')} />}

      {phase?.cantine ? (
        // Mode cantine : on ne compte plus ; l'assiette type, et un simple total si on a noté (pas de cible).
        <a class="card card--link card--quiet" href="#/assiette">
          <div class="row" style={{ minHeight: 0 }}>
            <span class="card__label">Assiette · mode cantine</span>
            <span class="muted">Ouvrir →</span>
          </div>
          <CantinePlate />
          {entries && entries.length > 0 && <NutrientsLine value={sumEntries(entries)} />}
        </a>
      ) : (
        <a class="card card--link card--quiet" href="#/assiette">
          <div class="row" style={{ minHeight: 0 }}>
            <span class="card__label">Alimentation</span>
            <span class="muted">{profile.value ? 'Noter →' : 'Calculer ma cible →'}</span>
          </div>
          <DayMeters totals={sumEntries(entries ?? [])} targets={targets.value} />
        </a>
      )}

      {last && <BodyCard />}

      {pushupTest && !active && (
        <section class="card test-card" aria-labelledby="test-title">
          <span class="card__label">Test pompes du mois</span>
          <span id="test-title" class="card__title">
            Un essai, le plus possible
          </span>
          <span class="muted">{lastTestText(pushupTest.last)}</span>
          <div class="segmented">
            <button type="button" class="btn btn--quiet" onClick={() => void snoozePushupTest()}>
              Plus tard
            </button>
            <button type="button" class="btn btn--accent" onClick={() => setTesting(true)}>
              Faire le test
            </button>
          </div>
        </section>
      )}

      {backup && <BackupCard since={backup.since} />}

      <section class="card" aria-label="Raccourcis">
        <div class="shortcuts shortcuts--grid">
          <button type="button" class="btn" onClick={() => openCardio(undefined, 'shortcut')}>
            Course · vélo
          </button>
          <button type="button" class="btn" onClick={() => setCommuting(true)}>
            Vélotaf
          </button>
          <button type="button" class="btn" onClick={() => setImposing(true)}>
            Imposée
          </button>
          <button type="button" class="btn" onClick={() => setWeighing(true)}>
            {weighedToday && last ? `✓ ${formatKg(last.kg)}` : 'Se peser'}
          </button>
        </div>
      </section>

      <div class="bottom-zone">
        <div class="segmented">
          <label class="select-chip">
            <span class="visually-hidden">Lieu</span>
            <select value={p.lastLocationId} onChange={(e) => void setPref('lastLocationId', e.currentTarget.value)}>
              {locations.value.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label class="select-chip">
            <span class="visually-hidden">Durée</span>
            <select
              value={String(p.lastDuration)}
              onChange={(e) => void setPref('lastDuration', Number(e.currentTarget.value) as Duration)}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={String(d)}>
                  {DURATION_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {doneToday ? (
          // Déjà une séance aujourd'hui : la 2e reste possible, mais n'est plus le geste principal.
          <button class="btn btn--big" type="button" disabled={!ready.value || locations.value.length === 0} onClick={() => go('knee')}>
            Une 2e séance quand même
            <span class="muted btn__sub">Sans les mouvements des dernières 48 h</span>
          </button>
        ) : (
          <button class="cta" type="button" disabled={!ready.value || locations.value.length === 0} onClick={() => go('knee')}>
            <span class="cta__title">Démarrer la séance</span>
            <span class="cta__sub">Prévention genou incluse</span>
          </button>
        )}
      </div>

      {weighing && <WeighSheet onClose={() => setWeighing(false)} />}
      {imposing && <ImposedSheet onClose={() => setImposing(false)} />}
      {cardio && <CardioSheet {...(cardio.type ? { type: cardio.type } : {})} onClose={() => setCardio(null)} />}
      {commuting && <CommuteSheet onClose={() => setCommuting(false)} />}
      {testing && <PushupTestSheet onClose={() => setTesting(false)} />}
      {editingPlans && <PlansSheet onClose={() => setEditingPlans(false)} />}
      {reviewing && <ReviewSheet day={reviewing.day} via={reviewing.via} onClose={() => setReviewing(null)} />}
    </main>
  );
}

/** Titre de la carte selon le moment. */
function momentTitle(moment: PlanMoment): string {
  if (moment.slot === 'post-ride') return 'Après le vélo';
  if (moment.slot === 'evening') return 'Pour ce soir';
  return TRIGGER_LABEL[moment.plans[0]!.trigger];
}

/** Le plan « si… alors… » du moment : à relire avant la situation, pas après l'écart. */
function PlanMomentCard({ moment, onEdit }: { moment: PlanMoment; onEdit: () => void }) {
  return (
    <section class="card card--quiet" aria-labelledby="plan-moment-title">
      <span class="card__label">Ton plan</span>
      <span id="plan-moment-title" class="card__title">
        {momentTitle(moment)}
      </span>
      <div class="plan-box">
        {moment.plans.map((p) => (
          <PlanText key={p.id} when={p.when} then={p.then} />
        ))}
      </div>
      <div class="segmented">
        <button type="button" class="btn btn--small btn--quiet" onClick={onEdit}>
          Modifier
        </button>
        <button type="button" class="btn btn--small" onClick={() => void dismissPlanMoment(moment)}>
          Vu
        </button>
      </div>
    </section>
  );
}

/** Le dimanche, le planning de la semaine suivante sert à « Demain : … ». */
function nextWeekProp(now: Date): { next?: WeekPlan } {
  const next = nextWeekPlan(now);
  return next ? { next } : {};
}

/**
 * Rappel de sauvegarde (SPEC §4.11) : discret, un geste pour exporter, « Plus tard » le fait
 * taire 3 jours. Les photos ne partent pas d'ici (choix à faire dans Réglages).
 */
function BackupCard({ since }: { since: number | null }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await runExport(false, 'reminder');
    } catch (e) {
      alert(`L’export a échoué : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section class="card card--quiet" aria-labelledby="backup-title">
      <span class="card__label">Sauvegarde</span>
      <span id="backup-title" class="card__title">
        {since === null ? 'Pas encore de sauvegarde' : `Dernière sauvegarde il y a ${since} jours`}
      </span>
      <span class="muted">Un export vers OneDrive, et rien ne se perd si le téléphone lâche.</span>
      <div class="segmented">
        <button type="button" class="btn btn--quiet" onClick={() => void snoozeExport()}>
          Plus tard
        </button>
        <button type="button" class="btn btn--accent" disabled={busy} onClick={() => void save()}>
          {busy ? 'Préparation…' : 'Exporter'}
        </button>
      </div>
    </section>
  );
}

/** Nombre de pesées montrées dans la petite courbe de l'accueil. */
const SPARK_POINTS = 14;

/** Résumé du poids : la tendance (jamais la pesée du jour), le rythme et la projection. */
function BodyCard() {
  const s = summary.value;
  const today = dayKey(new Date());
  if (s.trend === null) return null;
  const line = s.projection
    ? `${formatKg(s.projection.goal)} vers ${formatApproxDate(s.projection.day, today)}`
    : s.missing && s.missing.weighIns > 0
      ? 'Le rythme se dessine au fil des pesées'
      : null;
  return (
    <a class="card card--link card--quiet body-card" href="#/corps">
      <div class="body-card__text">
        <span class="card__label">Poids · tendance</span>
        <span class="body-card__value num">
          {formatKg(s.trend)}
          {s.rate !== null && <span class={`body-card__rate ${s.direction === 'down' ? 'trend-good' : 'muted'}`}> {formatSigned(s.rate)} kg/sem.</span>}
        </span>
        {line && <span class="muted">{line}</span>}
        {/* Aussi avant la toute première série : le point de départ est la photo la plus précieuse. */}
        {photoDue(photos.value, today) && (
          <span class="notice-line">{photos.value.length > 0 ? 'Photos du mois à faire' : 'Photos de départ à faire'}</span>
        )}
      </div>
      <Sparkline values={trend.value.slice(-SPARK_POINTS).map((p) => p.trend)} />
    </a>
  );
}
