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
 */
import { useState } from 'preact/hooks';
import { clearActiveSession } from '../../data/repo';
import { DURATIONS, type Duration } from '../../domain/types';
import { CATALOG } from '../../data/catalog';
import { REST_DAY } from '../../data/messages';
import { dayKey } from '../../domain/days';
import { calibrationDay, foodDay, latestWeight, sumEntries } from '../../domain/nutrition';
import { reviewPrompt } from '../../domain/habits';
import { dailyMessage } from '../../domain/messages';
import { photoDue } from '../../domain/body';
import { askMorningKnee, sessionDoneToday } from '../../domain/recovery';
import { progress } from '../../domain/session';
import { Sparkline } from '../components/SmallCharts';
import { DayMeters } from '../food/common';
import { WeighSheet } from '../food/WeighSheet';
import { ImposedSheet } from '../journal/ImposedSheet';
import { CardioSheet } from '../journal/CardioSheet';
import { CommuteSheet } from '../journal/CommuteSheet';
import { CardioCard } from '../components/CardioCard';
import { GoalLine, WeekStrip } from '../components/WeekStrip';
import { weekOf } from '../../domain/week';
import { track } from '../../data/usage';
import { openCalendar } from './Journal';
import { ReviewSheet } from '../food/ReviewSheet';
import { calibrationStart, profile, targets, useDayEntries, weights } from '../foodState';
import { reviewedDays } from '../habitsState';
import { photos, summary, trend } from '../bodyState';
import { formatApproxDate, formatKg, formatLongDate, formatSigned } from '../format';
import { go } from '../router';
import { levels, locations, prefs, ready, session, setPref, updateSession } from '../state';
import { activities, answerMorningKnee, kneeLogs, renfoDays, workouts } from '../training';

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
  const hasBike = location?.equipment.includes('bike') ?? false;
  const week = weekOf(dayKey(now), renfoDays.value, activities.value);

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
        <span class="screen-header__kicker">{formatLongDate(new Date())}</span>
        <h1 class="screen-header__title">Aujourd'hui</h1>
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

      {ready.value && (
        <button type="button" class="card card--link card--button card--quiet week-card" onClick={() => openCalendar()}>
          <div class="row" style={{ minHeight: 0 }}>
            <span class="card__label">Cette semaine</span>
            <GoalLine week={week} goal={p.weekGoal} />
          </div>
          <WeekStrip week={week} today={dayKey(now)} />
        </button>
      )}

      {ready.value && <CardioCard bike={hasBike} onLog={(type) => openCardio(type, 'card')} />}

      <a class="card card--link card--quiet" href="#/assiette">
        <div class="row" style={{ minHeight: 0 }}>
          <span class="card__label">Alimentation</span>
          <span class="muted">{profile.value ? 'Noter →' : 'Calculer ma cible →'}</span>
        </div>
        <DayMeters totals={sumEntries(entries ?? [])} targets={targets.value} />
      </a>

      {last && <BodyCard />}

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
      {reviewing && <ReviewSheet day={reviewing.day} via={reviewing.via} onClose={() => setReviewing(null)} />}
    </main>
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
