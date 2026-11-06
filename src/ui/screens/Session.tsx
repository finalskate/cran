/**
 * Écran de séance (SPEC §4.4 « Pendant la séance ») — fond noir pur, sans halo ni flou.
 *
 *  - Travail : un exercice à l'écran, consignes repliables, répétitions en + / − (pré-remplies),
 *    ressenti Facile / OK / Dur ; pour un exercice en durée, un minuteur.
 *  - Repos : décompte basé sur l'heure de fin, ±15 s, « Passer », aperçu de la suite.
 *    À la fin : vibration, bip, voix et notification (montre) selon les réglages.
 *  - L'écran reste allumé ; quitter ne perd rien (la séance est enregistrée à chaque série).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { finishWorkout } from '../../data/repo';
import type { Feel } from '../../domain/history';
import {
  adjustRest,
  completeStep,
  currentStep,
  endRest,
  itemOf,
  previousResults,
  progress,
  replaceItem,
  restRemaining,
  skipBlock,
  toRecord,
  type SessionState,
  type Step,
} from '../../domain/session';
import { DemoLink } from '../components/DemoLink';
import { SwapPicker } from '../components/SwapPicker';
import { beep, notify, speak, vibrate } from '../device/feedback';
import { useWakeLock } from '../device/wakeLock';
import { formatClock, formatTarget, HAND_LABEL } from '../format';
import { contextFor, describeItem } from '../planner';
import { go } from '../router';
import { lastRecord } from '../summary';
import { locations, prefs, session, updateSession } from '../state';

/** Horloge partagée de l'écran : rafraîchie 4 fois par seconde. */
function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** « Pompes archer, série 2 sur 3 » : texte d'une étape, pour la voix et les notifications. */
function stepLabel(state: SessionState, step: Step): string {
  const { variant } = describeItem(itemOf(state, step));
  return step.sets > 1 ? `${variant.name}, série ${step.set} sur ${step.sets}` : variant.name;
}

/** Retours de fin de minuteur (repos ou exercice en durée), selon les réglages. */
function signalEnd(message?: string, title = 'Repos terminé') {
  const p = prefs.value;
  if (p.vibration) vibrate();
  if (p.beep) beep(2);
  if (p.voice && message) speak(`${title}. ${message}.`);
  if (p.watchNotify) void notify(title, message ?? '');
}

export function Session() {
  const state = session.value;
  const now = useNow();
  useWakeLock();

  // Fin du repos : une seule fois par étape, même si l'écran se rafraîchit plusieurs fois.
  const restFired = useRef<number | null>(null);
  useEffect(() => {
    if (!state || state.phase !== 'rest') return;
    if (restRemaining(state, now) > 0 || restFired.current === state.index) return;
    restFired.current = state.index;
    const next = state.steps[state.index + 1];
    signalEnd(next ? stepLabel(state, next) : undefined);
    updateSession(endRest(state));
  }, [state, now]);

  // Séance terminée : enregistrement dans l'historique, puis écran de bilan.
  useEffect(() => {
    if (!state || state.phase !== 'done') return;
    const record = toRecord(state, Date.now());
    lastRecord.value = { record, plan: state.plan };
    void finishWorkout(record).then(() => {
      session.value = null;
      go('summary', true);
    });
  }, [state?.phase]);

  // Pas de séance (URL ouverte directement) : retour à l'accueil.
  useEffect(() => {
    if (!state) go('today', true);
  }, [state]);

  if (!state || state.phase === 'done') return null;

  const step = currentStep(state)!;
  const { done, total } = progress(state);
  const elapsed = (now - state.startedAt) / 1000;

  return (
    <main class="screen screen--session screen--focus session">
      <div class="session__top">
        <button
          type="button"
          class="icon-btn"
          aria-label="Quitter (la séance reste reprenable)"
          onClick={() => go('today')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div class="session__progress">
          <div class="row muted" style={{ fontSize: '13px', minHeight: 0 }}>
            <span>
              Étape {Math.min(done + 1, total)} / {total}
            </span>
            <span class="num">{formatClock(elapsed)}</span>
          </div>
          <div class="bar">
            <div class="bar__fill" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
      </div>

      {state.phase === 'rest' ? (
        <RestView state={state} now={now} />
      ) : (
        <WorkView key={state.index} state={state} step={step} />
      )}
    </main>
  );
}

// ─── Repos ───

function RestView({ state, now }: { state: SessionState; now: number }) {
  const remaining = restRemaining(state, now);
  const total = state.steps[state.index]!.restAfter;
  const next = state.steps[state.index + 1];
  const nextItem = next ? describeItem(itemOf(state, next)) : null;
  // Anneau : circonférence d'un cercle de rayon 90.
  const C = 2 * Math.PI * 90;
  const ratio = total > 0 ? Math.min(remaining / total, 1) : 0;

  return (
    <>
      <div class="rest">
        <span class="card__label">Repos</span>
        <div class="rest__ring">
          <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12" />
            <circle
              cx="110"
              cy="110"
              r="90"
              fill="none"
              stroke="url(#rest-gradient)"
              stroke-width="12"
              stroke-linecap="round"
              stroke-dasharray={`${C * ratio} ${C}`}
              transform="rotate(-90 110 110)"
            />
            <defs>
              <linearGradient id="rest-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#fb923c" />
                <stop offset="1" stop-color="#f472b6" />
              </linearGradient>
            </defs>
          </svg>
          <span class="rest__time num" role="timer" aria-live="off">
            {formatClock(remaining)}
          </span>
        </div>
        <div class="segmented" style={{ width: '100%' }}>
          <button type="button" class="btn btn--big" onClick={() => updateSession(adjustRest(state, -15, Date.now()))}>
            −15 s
          </button>
          <button type="button" class="btn btn--big" onClick={() => updateSession(adjustRest(state, 15, Date.now()))}>
            +15 s
          </button>
        </div>
      </div>

      {next && nextItem && (
        <section class="card">
          <span class="card__label">Ensuite</span>
          <span class="card__title">{nextItem.variant.name}</span>
          <span class="muted">
            {next.sets > 1 ? `Série ${next.set} / ${next.sets}` : ''}
          </span>
        </section>
      )}

      <div class="bottom-zone">
        <button type="button" class="cta" onClick={() => updateSession(endRest(state))}>
          <span class="cta__title">Passer le repos</span>
        </button>
      </div>
    </>
  );
}

// ─── Travail ───

const FEELS: { value: Feel; label: string }[] = [
  { value: 'easy', label: 'Facile' },
  { value: 'ok', label: 'OK' },
  { value: 'hard', label: 'Dur' },
];

function WorkView({ state, step }: { state: SessionState; step: Step }) {
  const item = itemOf(state, step);
  const { movement, variant } = describeItem(item);
  const block = state.plan.blocks[step.block]!;
  const previous = previousResults(state, step);
  const last = previous[previous.length - 1];
  const isTime = item.target.kind === 'time';

  // Valeur pré-remplie : la série précédente de cet exercice, sinon l'objectif du jour.
  const [value, setValue] = useState(last?.value ?? item.prefill);
  const [feel, setFeel] = useState<Feel>(last?.feel ?? 'ok');
  const [swapping, setSwapping] = useState(false);

  const location = locations.value.find((l) => l.id === state.plan.locationId)!;
  const ctx = contextFor(location, state.plan.kneeScore);

  // Voix : annonce de l'exercice au début de chaque bloc (les fins de repos annoncent déjà la suite).
  useEffect(() => {
    const prev = state.steps[state.index - 1];
    if (prefs.value.voice && (!prev || prev.block !== step.block)) speak(stepLabel(state, step));
  }, []);

  function validate(result: { value: number; feel?: Feel } | null) {
    updateSession(completeStep(state, result, Date.now()));
  }

  return (
    <>
      <div class="work__head">
        <span class="card__label accent">
          {block.title}
          {item.level >= 0 && movement.levels.length > 1 ? ` · niveau ${item.level + 1} / ${movement.levels.length}` : ''}
        </span>
        <h1 class="work__name">{variant.name}</h1>
        <span class="muted">
          {item.guided ? `${item.target.min} s` : formatTarget(item.target, item.perSide)}
          {item.handSupport ? ` · ${HAND_LABEL[item.handSupport]}` : ''}
          {variant.substitute ? ' · substitut' : ''}
        </span>
        {!item.guided && <DemoLink variant={variant} />}
      </div>

      <details class="card cues">
        <summary>
          <b>Consignes</b> <span class="muted">· {variant.cues[0]}</span>
        </summary>
        <ul>
          {variant.cues.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        {variant.mistakes.length > 0 && (
          <>
            <span class="card__label">Erreurs courantes</span>
            <ul>
              {variant.mistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </>
        )}
      </details>

      {!item.guided && (
        <div class="row">
          <span style={{ fontWeight: 600 }}>
            Série {step.set} / {step.sets}
          </span>
          {last && (
            <span class="muted" style={{ fontSize: '14px' }}>
              Précédente : {last.value}
              {isTime ? ' s' : ''} · {FEELS.find((f) => f.value === last.feel)?.label ?? '—'}
            </span>
          )}
        </div>
      )}

      {item.guided ? (
        <GuidedTimer
          key={state.index}
          seconds={item.target.min}
          onDone={() => validate(null)}
        />
      ) : isTime ? (
        <TimedSet seconds={value} onChange={setValue} />
      ) : (
        <div class="counter">
          <button type="button" class="counter__btn" aria-label="Une répétition de moins" onClick={() => setValue(Math.max(0, value - 1))}>
            −
          </button>
          <div class="counter__value">
            <span class="num counter__number">{value}</span>
            <span class="muted" style={{ fontSize: '13px' }}>
              répétitions{item.perSide ? ' par côté' : ''}
            </span>
          </div>
          <button type="button" class="counter__btn" aria-label="Une répétition de plus" onClick={() => setValue(value + 1)}>
            +
          </button>
        </div>
      )}

      {!item.guided && (
        <div class="segmented" role="radiogroup" aria-label="Ressenti">
          {FEELS.map((f) => (
            <button key={f.value} type="button" class="btn btn--big" role="radio" aria-checked={feel === f.value} aria-pressed={feel === f.value} onClick={() => setFeel(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {swapping && (
        <section class="card">
          <SwapPicker
            item={item}
            plan={state.plan}
            ctx={ctx}
            onPick={(it) => {
              updateSession(replaceItem(state, step.block, step.item, it));
              setSwapping(false);
            }}
            onCancel={() => setSwapping(false)}
          />
        </section>
      )}

      <div class="bottom-zone">
        <div class="segmented">
          {!item.guided && !swapping && (
            <button type="button" class="btn" onClick={() => setSwapping(true)}>
              Remplacer
            </button>
          )}
          {(block.optional || item.guided) && (
            <button type="button" class="btn" onClick={() => updateSession(skipBlock(state))}>
              Passer ce bloc
            </button>
          )}
          {!item.guided && (
            <button type="button" class="btn" onClick={() => validate(null)}>
              Sauter la série
            </button>
          )}
        </div>
        {!item.guided && (
          <button type="button" class="cta" onClick={() => validate({ value, feel })}>
            <span class="cta__title">Valider la série</span>
            {step.restAfter > 0 && <span class="cta__sub">puis repos {formatClock(step.restAfter)}</span>}
          </button>
        )}
      </div>
    </>
  );
}

// ─── Minuteurs d'exercice ───

/** Série en durée (planche, chaise…) : décompte depuis l'objectif ; « Arrêter » note le temps tenu. */
function TimedSet({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  // Minuteur en cours : heure de départ et objectif figé au lancement.
  const [run, setRun] = useState<{ start: number; goal: number } | null>(null);
  const now = useNow();
  const elapsed = run ? (now - run.start) / 1000 : 0;
  const remaining = run ? Math.max(0, run.goal - elapsed) : 0;

  useEffect(() => {
    if (run && remaining === 0) {
      signalEnd(undefined, 'Temps écoulé');
      onChange(run.goal);
      setRun(null);
    }
  }, [remaining, run]);

  if (run) {
    return (
      <div class="timed">
        <span class="num counter__number">{formatClock(remaining)}</span>
        <button
          type="button"
          class="btn btn--big"
          onClick={() => {
            onChange(Math.round(elapsed));
            setRun(null);
          }}
        >
          Arrêter
        </button>
      </div>
    );
  }

  return (
    <div class="counter">
      <button type="button" class="counter__btn" aria-label="5 secondes de moins" onClick={() => onChange(Math.max(5, seconds - 5))}>
        −
      </button>
      <div class="counter__value">
        <span class="num counter__number">{seconds}</span>
        <button type="button" class="btn btn--small" onClick={() => setRun({ start: Date.now(), goal: seconds })}>
          Lancer le minuteur
        </button>
      </div>
      <button type="button" class="counter__btn" aria-label="5 secondes de plus" onClick={() => onChange(seconds + 5)}>
        +
      </button>
    </div>
  );
}

/** Mouvement guidé (échauffement, retour au calme) : démarre seul, passe au suivant à la fin. */
function GuidedTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [startedAt] = useState(Date.now());
  const now = useNow();
  const remaining = Math.max(0, seconds - (now - startedAt) / 1000);
  const fired = useRef(false);

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      if (prefs.value.beep) beep(1);
      onDone();
    }
  }, [remaining]);

  return (
    <div class="timed">
      <span class="num counter__number">{formatClock(remaining)}</span>
      <button type="button" class="btn btn--big" onClick={onDone}>
        Suivant
      </button>
    </div>
  );
}
