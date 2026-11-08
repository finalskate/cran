/**
 * Bilan de la séance terminée : durée et séries faites, dans l'esprit du carnet (SPEC §4.5),
 * puis le ressenti global de la séance, facultatif (« trop facile / bien dosée / trop dure »).
 * Ce ressenti est rappelé dans l'aperçu de la séance suivante et règle son volume (±1 série).
 *
 * Double progression (J2) : un niveau débloqué est célébré (il est déjà choisi pour la prochaine
 * fois, « Rester encore à ce niveau » annule) ; deux séances sous la fourchette proposent de
 * revenir un cran en arrière, sans parler d'échec.
 *
 * Titre et ouvertures des cartes sont tirés des messages d'encouragement (src/data/messages.ts),
 * numérotés par séance : deux séances qui se suivent n'ont jamais le même.
 */
import { useEffect, useState } from 'preact/hooks';
import { LEVEL_UP, SESSION_DONE, STEP_BACK } from '../../data/messages';
import { setWorkoutFeel } from '../../data/repo';
import { track } from '../../data/usage';
import type { SessionFeel } from '../../domain/history';
import { nthMessage } from '../../domain/messages';
import type { LevelChange } from '../../domain/progression';
import { formatClock, SESSION_FEEL_LABEL } from '../format';
import { levelVariant, movementById } from '../planner';
import { go } from '../router';
import { chooseLevel } from '../state';
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
        <h1 class="screen-header__title">{nthMessage(SESSION_DONE, record.id ?? 0, 'session-done')}</h1>
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

      {last.unlocks.map((c) => (
        <LevelUpCard key={c.movementId} change={c} n={record.id ?? 0} />
      ))}
      {last.stepBacks.map((c) => (
        <StepBackCard key={c.movementId} change={c} n={record.id ?? 0} />
      ))}

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

/** Nom d'un niveau : ses variantes équivalentes. */
function levelName(movementId: string, level: number): string {
  const movement = movementById(movementId);
  return movement?.levels[level] ? levelVariant(movement, level).name : '';
}

/** Niveau débloqué : célébré, déjà appliqué, annulable. */
function LevelUpCard({ change, n }: { change: LevelChange; n: number }) {
  const [stayed, setStayed] = useState(false);
  const movement = movementById(change.movementId);

  async function stay() {
    await chooseLevel(change.movementId, change.from);
    track('level-stay', { movementId: change.movementId, level: change.from });
    setStayed(true);
  }

  return (
    <section class="card level-up" aria-label="Niveau débloqué">
      <span class="card__label">Niveau débloqué</span>
      <h2 class="card__title">
        {movement?.name} · niveau {change.to + 1}
      </h2>
      {stayed ? (
        <p class="muted" style={{ margin: 0 }}>
          Tu restes au niveau {change.from + 1}. Il se débloquera de nouveau après deux séances au haut de la fourchette.
        </p>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            {nthMessage(LEVEL_UP, n, `level-up-${change.movementId}`)} Deux séances au haut de la fourchette : place à <strong>{levelName(change.movementId, change.to)}</strong> dès la
            prochaine séance.
          </p>
          <button type="button" class="btn btn--small btn--quiet" onClick={() => void stay()}>
            Rester encore à ce niveau
          </button>
        </>
      )}
    </section>
  );
}

/** Deux séances sous la fourchette : proposer de consolider un cran plus bas. */
function StepBackCard({ change, n }: { change: LevelChange; n: number }) {
  const [done, setDone] = useState(false);
  const movement = movementById(change.movementId);

  async function stepBack() {
    await chooseLevel(change.movementId, change.to);
    track('step-back', { movementId: change.movementId, from: change.from, to: change.to });
    setDone(true);
  }

  return (
    <section class="card" aria-label="Consolider">
      <span class="card__label">{movement?.name}</span>
      {done ? (
        <p class="muted" style={{ margin: 0 }}>
          C’est noté : niveau {change.to + 1} la prochaine fois. La force construite là servira pour remonter.
        </p>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            {nthMessage(STEP_BACK, n, `step-back-${change.movementId}`)} Consolider un moment avec <strong>{levelName(change.movementId, change.to)}</strong> fait
            souvent progresser plus vite.
          </p>
          <button type="button" class="btn btn--small" onClick={() => void stepBack()}>
            Passer au niveau {change.to + 1} pour l’instant
          </button>
        </>
      )}
    </section>
  );
}
