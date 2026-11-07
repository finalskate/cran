/**
 * Écran « Aujourd'hui » (SPEC §4.1) : lieu et durée pré-remplis, gros bouton Démarrer en bas.
 * Une séance en cours se reprend d'ici. Carte Alimentation (J4) : total du jour et cible ;
 * invitation à la pesée le matin, sans insistance (une fois pesé, elle laisse place à un ✓).
 *
 * J2 : séance déjà faite aujourd'hui → récupération conseillée, une 2e séance reste possible
 * (bouton secondaire) ; « genou ce matin » après une journée qui a chargé les jambes ;
 * raccourci « Imposée » pour noter une séance de sport au travail.
 * L'anneau de la semaine arrive avec le J6.
 */
import { useState } from 'preact/hooks';
import { clearActiveSession } from '../../data/repo';
import { DURATIONS, type Duration } from '../../domain/types';
import { CATALOG } from '../../data/catalog';
import { REST_DAY } from '../../data/messages';
import { dayKey } from '../../domain/days';
import { foodDay, latestWeight, sumEntries } from '../../domain/nutrition';
import { dailyMessage } from '../../domain/messages';
import { askMorningKnee, sessionDoneToday } from '../../domain/recovery';
import { progress } from '../../domain/session';
import { DayMeters } from '../food/common';
import { WeighSheet } from '../food/WeighSheet';
import { ImposedSheet } from '../journal/ImposedSheet';
import { profile, targets, useDayEntries, weights } from '../foodState';
import { formatKg, formatLongDate } from '../format';
import { go } from '../router';
import { levels, locations, prefs, ready, session, setPref, updateSession } from '../state';
import { activities, answerMorningKnee, kneeLogs, workouts } from '../training';

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

      <a class="card card--link card--quiet" href="#/assiette">
        <div class="row" style={{ minHeight: 0 }}>
          <span class="card__label">Alimentation</span>
          <span class="muted">{profile.value ? 'Noter →' : 'Calculer ma cible →'}</span>
        </div>
        <DayMeters totals={sumEntries(entries ?? [])} targets={targets.value} />
      </a>

      <section class="card" aria-label="Raccourcis">
        <div class="segmented shortcuts">
          <a class="btn btn--link" href="#/lieux">
            Lieux
          </a>
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
    </main>
  );
}
