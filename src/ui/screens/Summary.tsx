/**
 * Bilan de la séance terminée : durée et séries faites, dans l'esprit du carnet (SPEC §4.5).
 * Les records et les déblocages de niveau arrivent avec la progression (J2).
 */
import { useEffect } from 'preact/hooks';
import { formatClock } from '../format';
import { movementById } from '../planner';
import { go } from '../router';
import { lastRecord } from '../summary';

export function Summary() {
  const last = lastRecord.value;

  useEffect(() => {
    if (!last) go('today', true);
  }, [last]);
  if (!last) return null;

  const { record } = last;
  const seconds = (new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime()) / 1000;
  const totalSets = record.entries.reduce((n, e) => n + e.sets.length, 0);

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
