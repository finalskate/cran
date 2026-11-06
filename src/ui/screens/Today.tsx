/**
 * Écran « Aujourd'hui » (SPEC §4.1) : lieu et durée pré-remplis, gros bouton Démarrer en bas.
 * Une séance en cours se reprend d'ici. L'anneau de la semaine et la carte Alimentation arrivent
 * avec les jalons J4 et J6.
 */
import { clearActiveSession } from '../../data/repo';
import { DURATIONS, type Duration } from '../../domain/types';
import { CATALOG } from '../../data/catalog';
import { progress } from '../../domain/session';
import { formatLongDate } from '../format';
import { go } from '../router';
import { levels, locations, prefs, ready, session, setPref, updateSession } from '../state';

const DURATION_LABEL: Record<Duration, string> = { 10: '10 min', 20: '20 min', 30: '30 min', 40: '40 min et +' };

/** Mouvements dont le niveau se choisit (tout sauf les exercices tournants de prévention et l'échauffement). */
const LEVELED = CATALOG.filter((m) => m.levels.length > 1);

export function Today() {
  const p = prefs.value;
  const active = session.value;
  const levelsChosen = LEVELED.some((m) => levels.value[m.id] !== undefined);

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
          <span class="muted">Le test de placement automatique arrive au prochain jalon. →</span>
        </a>
      )}

      <section class="card" aria-label="Raccourcis">
        <div class="segmented">
          <a class="btn btn--link" href="#/niveaux">
            Niveaux
          </a>
          <a class="btn btn--link" href="#/lieux">
            Lieux
          </a>
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
        <button class="cta" type="button" disabled={!ready.value || locations.value.length === 0} onClick={() => go('knee')}>
          <span class="cta__title">Démarrer la séance</span>
          <span class="cta__sub">Prévention genou incluse</span>
        </button>
      </div>
    </main>
  );
}
