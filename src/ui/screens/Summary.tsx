/**
 * Bilan de la séance terminée : durée et séries faites, dans l'esprit du carnet (SPEC §4.5),
 * puis le ressenti global de la séance, facultatif (« trop facile / bien dosée / trop dure »).
 * Ce ressenti est rappelé dans l'aperçu de la séance suivante ; il pourra moduler le volume au J2.
 * Les records et les déblocages de niveau arrivent avec la progression (J2).
 */
import { useEffect, useState } from 'preact/hooks';
import { setWorkoutFeel } from '../../data/repo';
import { track } from '../../data/usage';
import type { SessionFeel } from '../../domain/history';
import { formatClock, SESSION_FEEL_LABEL } from '../format';
import { movementById } from '../planner';
import { go } from '../router';
import { lastRecord } from '../summary';

const FEELS = Object.entries(SESSION_FEEL_LABEL) as [SessionFeel, string][];

export function Summary() {
  const last = lastRecord.value;
  const [feel, setFeel] = useState<SessionFeel | undefined>(last?.record.sessionFeel);

  useEffect(() => {
    if (!last) go('today', true);
  }, [last]);
  if (!last) return null;

  const { record } = last;
  const seconds = (new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()) / 1000;
  const totalSets = record.entries.reduce((n, e) => n + e.sets.length, 0);

  function pick(f: SessionFeel) {
    setFeel(f);
    track('session-feel', { feel: f });
    if (record.id !== undefined) void setWorkoutFeel(record.id, f);
  }

  return (
    <main class="screen screen--calm screen--focus">
      <header class="screen-header">
        <span class="screen-header__kicker">Séance terminée</span>
        <h1 class="screen-header__title">Bien joué.</h1>
      </header>

      <section class="card">
        <div class="row">
          <span>Durée</span>
          <span class="num" style={{ fontWeight: 700 }}>{formatClock(seconds)}</span>
        </div>
        <div class="row">
          <span>Séries</span>
          <span class="num" style={{ fontWeight: 700 }}>{totalSets}</span>
        </div>
      </section>

      <section class="card" aria-label="Carnet de la séance">
        <span class="card__label">Carnet</span>
        {record.entries.map((e, k) => {
          const movement = movementById(e.movementId);
          const variant =
            movement?.levels.flatMap((l) => l.variants).find((v) => v.id === e.variantId) ??
            movement?.substitutes?.find((v) => v.id === e.variantId);
          const unit = variant?.target.kind === 'time' ? ' s' : '';
          return (
            <div key={k} class="plan-item">
              <div class="plan-item__main">
                <span class="plan-item__name">{variant?.name ?? e.variantId}</span>
                <span class="muted plan-item__meta">{e.sets.map((s) => `${s.value}${unit}`).join(' · ')}</span>
              </div>
            </div>
          );
        })}
        {record.entries.length === 0 && <p class="muted">Aucune série notée.</p>}
      </section>

      <section class="card" aria-labelledby="feel-title">
        <div class="row" style={{ minHeight: 0 }}>
          <span id="feel-title" class="card__label">
            La séance, globalement
          </span>
          <span class="muted" style={{ fontSize: '13px' }}>
            facultatif
          </span>
        </div>
        <div class="segmented" role="radiogroup" aria-labelledby="feel-title">
          {FEELS.map(([value, label]) => (
            <button key={value} type="button" class="btn" role="radio" aria-checked={feel === value} onClick={() => pick(value)}>
              {label}
            </button>
          ))}
        </div>
        {feel && (
          <span class="muted" style={{ fontSize: '14px' }}>
            Noté : je te le rappellerai avant la prochaine séance.
          </span>
        )}
      </section>

      <div class="bottom-zone">
        <button
          class="cta"
          type="button"
          onClick={() => {
            lastRecord.value = null;
            go('today', true);
          }}
        >
          <span class="cta__title">Terminer</span>
        </button>
      </div>
    </main>
  );
}
