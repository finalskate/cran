/**
 * Écran de séance (SPEC §4.4 « Pendant la séance ») — fond noir pur, sans halo ni flou.
 *
 *  - Travail : l'exercice en grand (famille, niveau, nom), la consigne principale (la fiche
 *    complète s'ouvre d'un geste), les séries en cases (faites, en cours, à venir), le rappel de
 *    la dernière séance, puis la saisie : répétitions en + / −, ou chrono pour un exercice en durée.
 *    Les actions rares (remplacer, sauter, passer le bloc) sont rangées dans le menu « ⋯ ».
 *  - Chrono d'exercice : anneau « Effort » orange qui se REMPLIT, à graduations, pour ne pas le
 *    confondre avec le repos (anneau en dégradé qui se vide). 5 s de mise en place, vibration à
 *    l'objectif, et le temps tenu au-delà est compté (+0:05).
 *  - Repos : décompte basé sur l'heure de fin, ±15 s, « Passer », aperçu de la suite.
 *    À la fin : vibration, bip, voix et notification (montre) selon les réglages.
 *  - L'écran reste allumé ; quitter ne perd rien (la séance est enregistrée à chaque série).
 *    Seul un chrono d'exercice en cours est perdu si l'appli est fermée : on le relance.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { finishWorkout } from '../../data/repo';
import { REST_BREAK } from '../../data/messages';
import { track } from '../../data/usage';
import { compareWithLast, type Feel, type SetResult } from '../../domain/history';
import { nthMessage } from '../../domain/messages';
import {
  adjustRest,
  blockProgress,
  completeStep,
  currentStep,
  endRest,
  itemOf,
  previousResults,
  replaceItem,
  restRemaining,
  setsOfItem,
  skipBlock,
  toRecord,
  type SessionState,
  type Step,
} from '../../domain/session';
import type { Movement, PlanBlock, PlanItem, Variant } from '../../domain/types';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { Sheet } from '../components/Sheet';
import { SwapPicker } from '../components/SwapPicker';
import { beep, notify, speak, vibrate } from '../device/feedback';
import { useWakeLock } from '../device/wakeLock';
import { CATEGORY_LABEL, formatClock, formatTarget, HAND_LABEL } from '../format';
import { contextFor, describeItem } from '../planner';
import { go } from '../router';
import { lastRecord } from '../summary';
import { afterWorkout } from '../training';
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
  const [menuOpen, setMenuOpen] = useState(false);
  useWakeLock();

  // Fin du repos : une seule fois par étape, même si l'écran se rafraîchit plusieurs fois.
  const restFired = useRef<number | null>(null);
  useEffect(() => {
    if (!state || state.phase !== 'rest') return;
    if (restRemaining(state, now) > 0 || restFired.current === state.index) return;
    restFired.current = state.index;
    const next = state.steps[state.index + 1];
    track('rest-end', { planned: state.steps[state.index]!.restAfter, by: 'timer' });
    signalEnd(next ? stepLabel(state, next) : undefined);
    updateSession(endRest(state));
  }, [state, now]);

  // Séance terminée : enregistrement dans l'historique, puis écran de bilan.
  useEffect(() => {
    if (!state || state.phase !== 'done') return;
    const record = toRecord(state, Date.now());
    track('session-end', {
      ms: Date.now() - state.startedAt,
      sets: record.entries.reduce((n, e) => n + e.sets.length, 0),
      planned: state.steps.length,
    });
    void finishWorkout(record).then(async (id) => {
      // Double progression : déblocages appliqués tout de suite, affichés au bilan.
      const changes = await afterWorkout(record).catch(() => ({ unlocks: [], stepBacks: [] }));
      lastRecord.value = { record: { ...record, id }, plan: state.plan, ...changes };
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
  const blocks = blockProgress(state);
  const elapsed = (now - state.startedAt) / 1000;

  return (
    <main class="screen screen--session screen--focus session">
      <div class="session__top">
        <button
          type="button"
          class="icon-btn icon-btn--round"
          aria-label="Quitter (la séance reste reprenable)"
          onClick={() => {
            track('session-quit', { index: state.index });
            go('today');
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div class="session__progress">
          <div class="row muted" style={{ fontSize: '13px', minHeight: 0 }}>
            <span>
              Bloc {step.block + 1} sur {blocks.length} · {state.plan.blocks[step.block]!.title}
            </span>
            <span class="num">{formatClock(elapsed)}</span>
          </div>
          <div class="segbar" style={{ gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))` }} aria-hidden="true">
            {blocks.map((b, k) => (
              <div key={k} class="segbar__seg">
                <div class="segbar__fill" style={{ width: `${b.total ? (b.done / b.total) * 100 : 0}%` }} />
              </div>
            ))}
          </div>
        </div>
        {state.phase === 'work' ? (
          <button type="button" class="icon-btn icon-btn--round" aria-label="Plus d’options : remplacer, sauter" onClick={() => setMenuOpen(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
        ) : (
          <span class="icon-btn--spacer" aria-hidden="true" />
        )}
      </div>

      {state.phase === 'rest' ? (
        <RestView state={state} now={now} />
      ) : (
        <WorkView key={state.index} state={state} step={step} menuOpen={menuOpen} closeMenu={() => setMenuOpen(false)} />
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

  function adjust(delta: number) {
    track('rest-adjust', { delta });
    updateSession(adjustRest(state, delta, Date.now()));
  }

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
        {/* Une phrase par repos, la même pendant tout le décompte (graine : séance + numéro d'étape). */}
        <p class="muted rest__tip">{nthMessage(REST_BREAK, state.index, `rest-${state.startedAt}`)}</p>
        <div class="segmented" style={{ width: '100%' }}>
          <button type="button" class="btn btn--big" onClick={() => adjust(-15)}>
            −15 s
          </button>
          <button type="button" class="btn btn--big" onClick={() => adjust(15)}>
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
        <button
          type="button"
          class="cta"
          onClick={() => {
            track('rest-end', { planned: total, by: 'skip', remaining });
            updateSession(endRest(state));
          }}
        >
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

/** Ce que chaque vue d'exercice reçoit. */
interface WorkProps {
  state: SessionState;
  step: Step;
  item: PlanItem;
  movement: Movement;
  variant: Variant;
  block: PlanBlock;
  /** Dernière série saisie de cet exercice pendant la séance (pré-remplissage). */
  lastInSession: SetResult | undefined;
  openFiche: () => void;
  validate: (result: SetResult | null) => void;
}

interface WorkViewProps {
  state: SessionState;
  step: Step;
  menuOpen: boolean;
  closeMenu: () => void;
}

/** Exercice en cours : choisit la vue (répétitions, chrono, guidé) et porte la fiche et le menu. */
function WorkView({ state, step, menuOpen, closeMenu }: WorkViewProps) {
  const item = itemOf(state, step);
  const { movement, variant } = describeItem(item);
  const block = state.plan.blocks[step.block]!;
  const previous = previousResults(state, step);
  const [fiche, setFiche] = useState(false);
  const [swapping, setSwapping] = useState(false);
  // Durée de la série (affichage de l'étape → validation), pour le journal d'usage.
  const shownAt = useRef(Date.now());

  const location = locations.value.find((l) => l.id === state.plan.locationId)!;
  const ctx = contextFor(location, state.plan.kneeScore);

  // Voix : annonce de l'exercice au début de chaque bloc (les fins de repos annoncent déjà la suite).
  useEffect(() => {
    const prev = state.steps[state.index - 1];
    if (prefs.value.voice && (!prev || prev.block !== step.block)) speak(stepLabel(state, step));
  }, []);

  function validate(result: SetResult | null) {
    if (!item.guided) {
      track(result ? 'set' : 'set-skip', {
        variantId: item.variantId,
        set: step.set,
        ...(result ? { value: result.value, feel: result.feel, prefill: item.prefill, min: item.target.min, max: item.target.max } : {}),
        ms: Date.now() - shownAt.current,
      });
    }
    updateSession(completeStep(state, result, Date.now()));
  }

  function closeAll() {
    setSwapping(false);
    closeMenu();
  }

  const props: WorkProps = {
    state,
    step,
    item,
    movement,
    variant,
    block,
    lastInSession: previous[previous.length - 1],
    openFiche: () => setFiche(true),
    validate,
  };

  return (
    <>
      {item.guided ? <GuidedWork {...props} /> : item.target.kind === 'time' ? <TimedWork {...props} /> : <RepsWork {...props} />}

      <ExerciseSheet
        open={fiche}
        from="session"
        onClose={() => setFiche(false)}
        variants={[variant]}
        kicker={CATEGORY_LABEL[movement.category]}
      />

      <Sheet open={menuOpen} onClose={closeAll} title={swapping ? 'Remplacer par…' : variant.name} kicker={swapping ? undefined : 'Options'}>
        {swapping ? (
          <SwapPicker
            item={item}
            plan={state.plan}
            ctx={ctx}
            onPick={(it) => {
              track('swap', { from: item.variantId, to: it.variantId, where: 'session' });
              updateSession(replaceItem(state, step.block, step.item, it));
              closeAll();
            }}
            onCancel={() => setSwapping(false)}
          />
        ) : (
          <div class="menu">
            {!item.guided && (
              <button type="button" class="btn btn--big" onClick={() => setSwapping(true)}>
                Remplacer l’exercice
              </button>
            )}
            {!item.guided && (
              <button
                type="button"
                class="btn btn--big"
                onClick={() => {
                  closeAll();
                  validate(null);
                }}
              >
                Sauter cette série
              </button>
            )}
            <button
              type="button"
              class="btn btn--big"
              onClick={() => {
                track('block-skip', { block: block.kind, index: state.index });
                closeAll();
                updateSession(skipBlock(state));
              }}
            >
              Passer le bloc « {block.title} »
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** En-tête de l'exercice : famille, niveau, nom, précisions, et la consigne principale. */
function WorkHead({ item, movement, variant, block, openFiche }: WorkProps) {
  const details = [
    item.handSupport ? HAND_LABEL[item.handSupport] : null,
    item.perSide ? 'par côté' : null,
    variant.substitute ? 'substitut' : null,
  ].filter(Boolean);

  return (
    <>
      <div class="work__head">
        <div class="work__kicker">
          <span class="card__label accent">{item.guided ? block.title : CATEGORY_LABEL[movement.category]}</span>
          {item.level >= 0 && movement.levels.length > 1 && (
            <span class="chip">
              Niveau {item.level + 1} / {movement.levels.length}
            </span>
          )}
        </div>
        <h1 class="work__name">{variant.name}</h1>
        {details.length > 0 && <span class="muted">{details.join(' · ')}</span>}
      </div>
      {variant.cues[0] && (
        <button type="button" class="cue-card" onClick={openFiche}>
          <span class="cue-card__text">{variant.cues[0]}</span>
          <span class="cue-card__more">Fiche</span>
        </button>
      )}
    </>
  );
}

/** Une valeur de série : « 9 » ou « 45 s ». */
function formatValue(value: number, isTime: boolean): string {
  return isTime ? `${value} s` : String(value);
}

/** Séries de l'exercice en cases, objectif du jour et rappel de la dernière séance. */
function SeriesCard({ state, step, item }: WorkProps) {
  const isTime = item.target.kind === 'time';
  const sets = setsOfItem(state, step);

  return (
    <section class="card series" aria-label="Séries">
      <div class="row" style={{ minHeight: 0 }}>
        <span style={{ fontWeight: 700 }}>
          Série {step.set} sur {step.sets}
        </span>
        <span class="muted" style={{ fontSize: '14px' }}>
          Objectif <b class="num series__goal">{formatTarget(item.target, item.perSide)}</b>
        </span>
      </div>
      {sets.length > 1 && (
        <div class="series__cells" style={{ gridTemplateColumns: `repeat(${sets.length}, minmax(0, 1fr))` }}>
          {sets.map((r, k) =>
            k + 1 === step.set ? (
              <span key={k} class="series__cell series__cell--current">
                en cours
              </span>
            ) : r ? (
              <span key={k} class="series__cell series__cell--done num">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
                {formatValue(r.value, isTime)}
              </span>
            ) : r === null ? (
              <span key={k} class="series__cell series__cell--next">
                sautée
              </span>
            ) : (
              <span key={k} class="series__cell series__cell--next">
                à venir
              </span>
            ),
          )}
        </div>
      )}
      {item.last && (
        <span class="muted series__last">
          Dernière séance : <span class="num series__last-values">{item.last.map((v) => formatValue(v, isTime)).join(' · ')}</span>
        </span>
      )}
    </section>
  );
}

function FeelPicker({ feel, onChange }: { feel: Feel; onChange: (f: Feel) => void }) {
  return (
    <div class="segmented" role="radiogroup" aria-label="Ressenti de la série">
      {FEELS.map((f) => (
        <button key={f.value} type="button" class="btn btn--big" role="radio" aria-checked={feel === f.value} onClick={() => onChange(f.value)}>
          {f.label}
        </button>
      ))}
    </div>
  );
}

/** Bouton principal « Valider la série », avec l'annonce du repos qui suit. */
function ValidateButton({ step, onClick }: { step: Step; onClick: () => void }) {
  return (
    <button type="button" class="cta" onClick={onClick}>
      <span class="cta__title">Valider la série</span>
      {step.restAfter > 0 && <span class="cta__sub">puis repos {formatClock(step.restAfter)}</span>}
    </button>
  );
}

// ─── Exercice en répétitions ───

function RepsWork(props: WorkProps) {
  const { item, step, lastInSession, validate } = props;
  // Valeur pré-remplie : la série précédente de cet exercice, sinon l'objectif du jour.
  const [value, setValue] = useState(lastInSession?.value ?? item.prefill);
  const [feel, setFeel] = useState<Feel>(lastInSession?.feel ?? 'ok');
  const cmp = compareWithLast(value, item.last, step.set);

  return (
    <>
      <WorkHead {...props} />
      <SeriesCard {...props} />

      <div class="counter">
        <button type="button" class="counter__btn" aria-label="Une répétition de moins" onClick={() => setValue(Math.max(0, value - 1))}>
          −
        </button>
        <div class="counter__value">
          <span class="num counter__number">{value}</span>
          {cmp?.kind === 'better' ? (
            <span class="counter__hint counter__hint--up">+{cmp.delta} par rapport à la dernière fois</span>
          ) : cmp?.kind === 'equal' ? (
            <span class="counter__hint">comme la dernière fois</span>
          ) : (
            <span class="counter__hint">répétitions{item.perSide ? ' par côté' : ''}</span>
          )}
        </div>
        <button type="button" class="counter__btn" aria-label="Une répétition de plus" onClick={() => setValue(value + 1)}>
          +
        </button>
      </div>

      <FeelPicker feel={feel} onChange={setFeel} />

      <div class="bottom-zone">
        <ValidateButton step={step} onClick={() => validate({ value, feel })} />
      </div>
    </>
  );
}

// ─── Exercice en durée (gainage, chaise contre le mur…) ───

/** Mise en place avant le départ du chrono (téléphone posé, il faut se mettre en position). */
const COUNTDOWN_S = 5;

/**
 * Anneau « Effort » : de la même famille que l'anneau de repos, mais orange uni, à graduations,
 * et il se REMPLIT. Rose quand l'objectif est dépassé.
 */
function EffortRing({
  ratio,
  over,
  label,
  adjust,
  children,
}: {
  ratio: number;
  over?: boolean;
  label: string;
  /** Boutons −5 s / +5 s de part et d'autre de l'anneau (avant le départ, et après l'arrêt). */
  adjust?: (delta: number) => void;
  children: ComponentChildren;
}) {
  const C = 2 * Math.PI * 94;
  return (
    <div class="effort">
      <span class={`effort__label ${over ? 'effort__label--over' : ''}`}>{label}</span>
      <div class="effort__row">
        {adjust && (
          <button type="button" class="counter__btn effort__adjust" aria-label="5 secondes de moins" onClick={() => adjust(-5)}>
            −5
          </button>
        )}
        <div class="effort__ring">
          <svg viewBox="0 0 240 240" aria-hidden="true">
            <circle cx="120" cy="120" r="112" fill="none" stroke="rgba(251,146,60,0.35)" stroke-width="8" stroke-dasharray="2 13.66" />
            <circle cx="120" cy="120" r="94" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14" />
            <circle
              cx="120"
              cy="120"
              r="94"
              fill="none"
              stroke={over ? 'var(--accent-2)' : 'var(--accent)'}
              stroke-width="14"
              stroke-dasharray={`${C * Math.min(Math.max(ratio, 0), 1)} ${C}`}
              transform="rotate(-90 120 120)"
            />
          </svg>
          <div class="effort__center">{children}</div>
        </div>
        {adjust && (
          <button type="button" class="counter__btn effort__adjust" aria-label="5 secondes de plus" onClick={() => adjust(5)}>
            +5
          </button>
        )}
      </div>
    </div>
  );
}

type TimedPhase = 'ready' | 'countdown' | 'running' | 'held';

function TimedWork(props: WorkProps) {
  const { item, variant, step, lastInSession, validate } = props;
  const [goal, setGoal] = useState(lastInSession?.value ?? item.prefill);
  const [phase, setPhase] = useState<TimedPhase>('ready');
  // Début de la phase en cours (mise en place ou effort), en ms : le temps se calcule par
  // différence avec l'horloge, il reste juste même si l'écran rafraîchit irrégulièrement.
  const [t0, setT0] = useState(0);
  const [held, setHeld] = useState(0);
  const [feel, setFeel] = useState<Feel>(lastInSession?.feel ?? 'ok');
  const reached = useRef(false);
  const now = useNow();
  const elapsed = Math.max(0, (now - t0) / 1000);

  useEffect(() => {
    if (phase === 'countdown' && elapsed >= COUNTDOWN_S) {
      if (prefs.value.beep) beep(1);
      if (prefs.value.vibration) vibrate(150);
      setT0(t0 + COUNTDOWN_S * 1000);
      setPhase('running');
    } else if (phase === 'running' && !reached.current && elapsed >= goal) {
      reached.current = true;
      signalEnd(undefined, 'Objectif atteint');
    }
  }, [now, phase]);

  function stop() {
    const s = Math.round((Date.now() - t0) / 1000);
    track('timer', { variantId: variant.id, goal, held: s, reachedGoal: s >= goal });
    setHeld(s);
    setPhase('held');
  }

  function restart() {
    reached.current = false;
    setPhase('ready');
  }

  return (
    <>
      <WorkHead {...props} />
      <SeriesCard {...props} />

      {phase === 'ready' && (
        <>
          <EffortRing ratio={0} label="Effort" adjust={(d) => setGoal(Math.max(5, goal + d))}>
            <span class="num effort__time">{formatClock(goal)}</span>
            <span class="effort__sub">à tenir</span>
          </EffortRing>
          <div class="bottom-zone">
            <button
              type="button"
              class="btn"
              onClick={() => {
                setHeld(goal);
                setPhase('held');
              }}
            >
              Noter sans chrono
            </button>
            <button
              type="button"
              class="cta"
              onClick={() => {
                setT0(Date.now());
                setPhase('countdown');
              }}
            >
              <span class="cta__title">Démarrer le chrono</span>
              <span class="cta__sub">{COUNTDOWN_S} s pour te mettre en place</span>
            </button>
          </div>
        </>
      )}

      {phase === 'countdown' && (
        <>
          <EffortRing ratio={0} label="Prépare-toi">
            <span class="num effort__time" role="timer">
              {Math.max(1, Math.ceil(COUNTDOWN_S - elapsed))}
            </span>
            <span class="effort__sub">mets-toi en place</span>
          </EffortRing>
          <div class="bottom-zone">
            <button type="button" class="cta cta--outline" onClick={restart}>
              <span class="cta__title">Annuler</span>
            </button>
          </div>
        </>
      )}

      {phase === 'running' && (
        <>
          {elapsed < goal ? (
            <EffortRing ratio={elapsed / goal} label="Effort · tiens bon">
              <span class="num effort__time" role="timer">
                {formatClock(Math.ceil(goal - elapsed))}
              </span>
              <span class="effort__sub">sur {formatClock(goal)}</span>
            </EffortRing>
          ) : (
            <EffortRing ratio={1} over label="Objectif atteint">
              <span class="num effort__time effort__time--over" role="timer">
                +{formatClock(elapsed - goal)}
              </span>
              <span class="effort__sub">continue si tu peux</span>
            </EffortRing>
          )}
          <div class="bottom-zone">
            <button type="button" class="cta cta--outline" onClick={stop}>
              <span class="cta__title">J’arrête</span>
              <span class="cta__sub">note {formatClock(elapsed)} tenues</span>
            </button>
          </div>
        </>
      )}

      {phase === 'held' && (
        <>
          <EffortRing
            ratio={held / goal}
            over={held > goal}
            label={held >= goal ? 'Objectif tenu' : 'Temps tenu'}
            adjust={(d) => setHeld(Math.max(0, held + d))}
          >
            <span class="num effort__time">{formatClock(held)}</span>
            <span class="effort__sub">tenues</span>
          </EffortRing>
          <button type="button" class="btn btn--small effort__restart" onClick={restart}>
            Recommencer le chrono
          </button>
          <FeelPicker feel={feel} onChange={setFeel} />
          <div class="bottom-zone">
            <ValidateButton step={step} onClick={() => validate({ value: held, feel })} />
          </div>
        </>
      )}
    </>
  );
}

// ─── Mouvement guidé (échauffement, retour au calme) : démarre seul, passe au suivant à la fin ───

function GuidedWork(props: WorkProps) {
  const { item, validate } = props;
  const seconds = item.target.min;
  const [startedAt] = useState(Date.now());
  const now = useNow();
  const elapsed = (now - startedAt) / 1000;
  const remaining = Math.max(0, seconds - elapsed);
  const fired = useRef(false);

  useEffect(() => {
    if (remaining === 0 && !fired.current) {
      fired.current = true;
      if (prefs.value.beep) beep(1);
      validate(null);
    }
  }, [remaining]);

  return (
    <>
      <WorkHead {...props} />
      <EffortRing ratio={elapsed / seconds} label="En douceur">
        <span class="num effort__time" role="timer">
          {formatClock(Math.ceil(remaining))}
        </span>
        <span class="effort__sub">puis on enchaîne</span>
      </EffortRing>
      <div class="bottom-zone">
        <button type="button" class="cta cta--outline" onClick={() => validate(null)}>
          <span class="cta__title">Suivant</span>
        </button>
      </div>
    </>
  );
}
