/**
 * Écran « Aujourd'hui » (SPEC §4.1), repensé le 21/11 (« l'accueil est souvent surchargé ») :
 *
 *  - « Maintenant » : au plus deux cartes d'action, choisies selon le moment (nuit et pesée le
 *    matin, genou du lendemain, course du jour, bilan du soir…). Balayer vers la gauche ou
 *    toucher « Plus tard » range une carte ; « Annuler » la ramène pendant quelques secondes ;
 *  - la ligne du plan « si… alors… » du moment, discrète ;
 *  - « Ta journée » : un bloc fixe (semaine, prévu, repas, poids, « Noter : … ») ;
 *  - « Plus tard · n » : le reste, replié (bilans, test pompes, prochaine sortie, sauvegarde…) ;
 *  - en bas, sur une ligne : lieu, durée, Démarrer. Une fois la séance du jour faite, la zone
 *    s'efface et la 2e séance passe dans « Plus tard ».
 *
 * Quelle carte va où : `homeFeed` (src/domain/home.ts, testé). Ici, on ne fait que dire quelles
 * cartes sont candidates et comment chacune s'affiche.
 *
 * Historique des cartes (toujours là, déplacées) : séance en cours (J1) ; récupération et 2e séance,
 * genou du lendemain, séance imposée (J2) ; poids (J3) ; pesée et alimentation (J4) ; bilan du
 * soir (J4B) ; semaine et prochaine sortie (J5a) ; phase et mode cantine (J5b) ; planning, pause,
 * sauvegarde (J6a) ; bilan du dimanche et test pompes (J6b) ; plan du moment (11/11).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { clearActiveSession } from '../../data/repo';
import { DURATIONS, type Duration } from '../../domain/types';
import { CATALOG } from '../../data/catalog';
import { REST_DAY } from '../../data/messages';
import { dayKey, dayToDate } from '../../domain/days';
import { calibrationDay, foodDay, latestWeight, type Meal } from '../../domain/nutrition';
import { reviewPrompt } from '../../domain/habits';
import { dailyMessage } from '../../domain/messages';
import { askMorningKnee, sessionDoneToday } from '../../domain/recovery';
import { progress } from '../../domain/session';
import { canDefer, deferKey, homeFeed, undeferKey, type HomeCandidate, type HomeCardId } from '../../domain/home';
import { nightAsked } from '../../domain/sleep';
import { phaseKey, cardioChoice } from '../../domain/phase';
import { weekOf } from '../../domain/week';
import type { WeekPlan } from '../../domain/weekPlan';
import { PHASES } from '../../data/phases';
import { track } from '../../data/usage';
import { ImposedSheet } from '../journal/ImposedSheet';
import { CardioSheet } from '../journal/CardioSheet';
import { CommuteSheet } from '../journal/CommuteSheet';
import { CardioCard } from '../components/CardioCard';
import { SwipeCard } from '../components/SwipeCard';
import { lastTestText, PushupTestSheet } from '../components/PushupTestSheet';
import { RemarkButton } from '../components/RemarkSheet';
import { ReviewSheet } from '../food/ReviewSheet';
import { WeighSheet } from '../food/WeighSheet';
import { QuickMealSheet } from '../food/QuickMealSheet';
import { SnackSheet } from '../food/SnackSheet';
import { PlansSheet } from '../food/PlansSheet';
import { DayCard } from '../home/DayCard';
import { MorningCard, WEIGH_FROM, WEIGH_UNTIL } from '../home/MorningCard';
import { PlanHint } from '../home/PlanHint';
import { useHint } from '../home/hints';
import { currentPhaseInfo, dismissPhaseNotice, phaseChanges, phaseNotice } from '../phaseState';
import { pushupTestNow, snoozePushupTest, weekReviewNow } from '../prideState';
import { currentPause, currentWeekPlan, exportDue, nextWeekPlan, resume, runExport, snoozeExport, weekRegularity } from '../weekState';
import { calibrationStart, profile, useDayEntries, weights } from '../foodState';
import { planMomentNow, reviewedDays } from '../habitsState';
import { nights } from '../sleepState';
import { formatLongDate, formatShortDate } from '../format';
import { go } from '../router';
import { levels, locations, prefs, ready, session, setPref, updateSession } from '../state';
import { activities, answerMorningKnee, kneeLogs, renfoDays, workouts } from '../training';

const DURATION_LABEL: Record<Duration, string> = { 10: '10 min', 20: '20 min', 30: '30 min', 40: '40 min et +' };

/** Mouvements dont le niveau se choisit (tout sauf les exercices tournants de prévention et l'échauffement). */
const LEVELED = CATALOG.filter((m) => m.levels.length > 1);

/** Ce qui s'affiche dans le résumé replié de « Plus tard ». */
const LATER_NAME: Record<HomeCardId, string> = {
  resume: 'séance en cours',
  'first-levels': 'tes niveaux',
  morning: 'nuit et pesée',
  knee: 'genou',
  run: 'course du jour',
  'evening-review': 'bilan du soir',
  'week-review': 'bilan de la semaine',
  phase: 'nouvelle phase',
  pause: 'pause',
  'pushup-test': 'test pompes',
  cardio: 'prochaine sortie',
  backup: 'sauvegarde',
  'second-session': '2e séance',
};

/** Durée (ms) pendant laquelle « Annuler » reste proposé après avoir rangé une carte. */
const UNDO_MS = 4000;

export function Today() {
  const p = prefs.value;
  const active = session.value;
  const now = new Date();
  const today = dayKey(now);
  const hour = now.getHours();
  const entries = useDayEntries(foodDay(now));
  const last = latestWeight(weights.value);
  const weighedToday = last?.day === today;
  const location = locations.value.find((l) => l.id === p.lastLocationId);
  const phase = currentPhaseInfo(now);
  const notice = ready.value ? phaseNotice(now) : null;
  const week = weekOf(today, renfoDays.value, activities.value);
  const pause = currentPause(now);
  const plan = ready.value && !pause ? currentWeekPlan(now) : null;
  const regular = weekRegularity(now).summary;
  const backup = ready.value ? exportDue(now) : null;
  const reviewWeek = ready.value ? weekReviewNow(now) : null;
  const pushupTest = ready.value && !pause ? pushupTestNow(now) : null;
  const moment = ready.value ? planMomentNow(now) : null;
  // Bilan du soir : après la calibration seulement (elle demande déjà de tout noter).
  const calibrating = !!calibrationStart.value && calibrationDay(calibrationStart.value, foodDay(now)) !== null;
  const prompt = ready.value && profile.value && !calibrating ? reviewPrompt(now, reviewedDays.value) : null;
  const doneToday = sessionDoneToday(workouts.value, now);
  const askKnee = ready.value && askMorningKnee(now, workouts.value, activities.value, kneeLogs.value, CATALOG);
  const askNight = ready.value && nightAsked(nights.value, today, hour);
  const askWeigh = ready.value && !weighedToday && hour >= WEIGH_FROM && hour < WEIGH_UNTIL;
  const todayPlan = plan?.days.find((d) => d.day === today);
  const cardioToday = todayPlan?.status === 'planned' && todayPlan.kind === 'cardio';

  const [testing, setTesting] = useState(false);
  const [weighing, setWeighing] = useState(false);
  const [quickMeal, setQuickMeal] = useState<Meal | null>(null);
  const [snacking, setSnacking] = useState(false);
  const [editingPlans, setEditingPlans] = useState(false);
  const [imposing, setImposing] = useState(false);
  const [cardio, setCardio] = useState<{ type?: 'run' | 'bike' } | null>(null);
  const [commuting, setCommuting] = useState(false);
  const [reviewing, setReviewing] = useState<{ day: string; via: 'evening' | 'catch-up' } | null>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const [undo, setUndo] = useState<{ id: HomeCardId; run: () => Promise<void> } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  function openCardio(type: 'run' | 'bike' | undefined, from: 'shortcut' | 'card') {
    track('cardio-sheet', { from, type });
    setCardio(type ? { type } : {});
  }

  async function abandon() {
    if (!confirm('Abandonner la séance en cours ? Les séries faites ne seront pas enregistrées.')) return;
    updateSession(null);
    await clearActiveSession();
  }

  // ─── Les cartes candidates (l'ordre ici n'a pas d'importance : homeFeed trie) ───
  const candidates: HomeCandidate[] = [];
  const add = (id: HomeCardId, key: string, when: unknown) => {
    if (when) candidates.push({ id, key });
  };
  add('resume', 'resume', active && active.phase !== 'done');
  add('first-levels', 'first-levels', ready.value && !LEVELED.some((m) => levels.value[m.id] !== undefined));
  add('morning', `morning:${today}`, askNight || askWeigh);
  add('knee', `knee:${today}`, askKnee);
  add('run', `run:${today}`, ready.value && cardioToday);
  add('evening-review', `review:${prompt?.day ?? ''}`, prompt);
  add('week-review', `week-review:${reviewWeek ?? ''}`, reviewWeek);
  add('phase', `phase:${notice ? phaseKey(notice) : ''}`, notice);
  add('pause', `pause:${today}`, pause);
  add('pushup-test', `pushup:${today}`, pushupTest && !active);
  add('cardio', `cardio:${today}`, ready.value && !pause && !cardioToday);
  add('backup', `backup:${today}`, backup);
  add('second-session', `second:${today}`, doneToday && !active);
  const feed = homeFeed(candidates, p.homeDeferred);

  /** Range une carte ; le test pompes garde son propre « Plus tard » (il revient dans quelques jours). */
  async function defer(c: HomeCandidate, gesture: 'swipe' | 'button') {
    let run: () => Promise<void>;
    if (c.id === 'pushup-test') {
      const before = prefs.value.pushupTestSnoozed;
      await snoozePushupTest();
      run = () => setPref('pushupTestSnoozed', before);
    } else {
      await setPref('homeDeferred', deferKey(prefs.value.homeDeferred, c.key));
      run = () => setPref('homeDeferred', undeferKey(prefs.value.homeDeferred, c.key));
    }
    track('home-defer', { card: c.id, gesture });
    clearTimeout(undoTimer.current);
    setUndo({ id: c.id, run });
    undoTimer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function cancelDefer() {
    if (!undo) return;
    clearTimeout(undoTimer.current);
    await undo.run();
    track('home-defer', { card: undo.id, undo: true });
    setUndo(null);
  }

  /** Le contenu d'une carte, où qu'elle soit affichée. */
  function card(id: HomeCardId): ComponentChildren {
    switch (id) {
      case 'resume':
        return active && <ResumeCard done={progress(active).done} total={progress(active).total} onAbandon={() => void abandon()} />;
      case 'first-levels':
        return (
          <a class="card card--link" href="#/niveaux">
            <span class="card__label">Première fois</span>
            <span class="card__title">Choisis ton niveau pour chaque mouvement</span>
            <span class="muted">À la main, ou avec « Tester mon niveau » : une série max suffit. →</span>
          </a>
        );
      case 'morning':
        return <MorningCard askNight={askNight} askWeigh={askWeigh} onWeigh={() => setWeighing(true)} />;
      case 'knee':
        return <KneeCard />;
      case 'run':
      case 'cardio':
        return <CardioCard choice={cardioChoice(phase, location?.equipment ?? [])} onLog={(type) => openCardio(type, 'card')} compact={id === 'run'} />;
      case 'evening-review':
        return prompt && <EveningReviewCard kind={prompt.kind} onOpen={() => setReviewing({ day: prompt.day, via: prompt.kind === 'today' ? 'evening' : 'catch-up' })} />;
      case 'week-review':
        return (
          <a class="card card--link review-card" href="#/bilan-semaine">
            <span class="card__label">Bilan de la semaine · 1 min</span>
            <span class="card__title">Ta semaine en un coup d’œil</span>
            <span class="muted">Ce que tu as fait, ce dont être fier, et l’objectif de la semaine prochaine. →</span>
          </a>
        );
      case 'phase':
        return notice && <PhaseCard id={notice.id} onDone={() => void dismissPhaseNotice(notice)} />;
      case 'pause':
        return (
          pause && (
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
          )
        );
      case 'pushup-test':
        return (
          pushupTest && (
            <section class="card test-card" aria-labelledby="test-title">
              <span class="card__label">Test pompes du mois</span>
              <span id="test-title" class="card__title">
                Un essai, le plus possible
              </span>
              <span class="muted">{lastTestText(pushupTest.last)}</span>
              <button type="button" class="btn btn--accent" onClick={() => setTesting(true)}>
                Faire le test
              </button>
            </section>
          )
        );
      case 'backup':
        return backup && <BackupCard since={backup.since} />;
      case 'second-session':
        return (
          <section class="card" aria-labelledby="second-title">
            <span class="card__label">Séance faite aujourd’hui ✓</span>
            <span id="second-title" class="card__title">
              Une 2e séance ?
            </span>
            <span class="muted">Sans les mouvements des dernières 48 h. Le repos fait aussi progresser.</span>
            <StartRow second />
          </section>
        );
    }
  }

  // Message de récupération : change chaque jour, reste le même toute la journée.
  const restTitle = doneToday && !active ? dailyMessage(REST_DAY, today, 'rest-day').title : null;

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

      {feed.now.length > 0 && (
        <>
          <h2 class="home-section">Maintenant</h2>
          {feed.now.map((c) =>
            canDefer(c.id) ? (
              <SwipeCard key={c.key} onDefer={(g) => void defer(c, g)}>
                {card(c.id)}
              </SwipeCard>
            ) : (
              <div key={c.key}>{card(c.id)}</div>
            ),
          )}
        </>
      )}

      {moment && <PlanHint moment={moment} onEdit={() => setEditingPlans(true)} />}

      <h2 class="home-section">Ta journée</h2>
      <DayCard
        now={now}
        week={week}
        plan={plan}
        {...nextWeekProp(now)}
        paused={!!pause}
        regular={regular}
        doneMessage={restTitle}
        entries={entries}
        cantine={!!phase?.cantine}
        onCardio={() => openCardio(undefined, 'shortcut')}
        onCommute={() => setCommuting(true)}
        onImposed={() => setImposing(true)}
        onWeigh={() => setWeighing(true)}
        onMeal={(meal) => setQuickMeal(meal)}
        onSnack={() => setSnacking(true)}
      />

      {feed.later.length > 0 && (
        <>
          <button
            type="button"
            class="later-toggle"
            aria-expanded={laterOpen}
            onClick={() => {
              if (!laterOpen) track('home-later', { count: feed.later.length });
              setLaterOpen(!laterOpen);
            }}
          >
            <span>
              <span class="later-toggle__count">Plus tard · {feed.later.length}</span>
              <span class="muted"> — {feed.later.map((c) => LATER_NAME[c.id]).join(', ')}</span>
            </span>
            <svg class="later-toggle__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {laterOpen && (
            <div class="later-list">
              {feed.later.map((c) => (
                <div key={c.key}>{card(c.id)}</div>
              ))}
            </div>
          )}
        </>
      )}

      {!(doneToday && !active) && (
        <div class="bottom-zone">
          <StartRow />
        </div>
      )}

      {undo && (
        <div class="undo-toast" role="status">
          <span>Rangé dans « Plus tard »</span>
          <button type="button" class="btn btn--small" onClick={() => void cancelDefer()}>
            Annuler
          </button>
        </div>
      )}

      {weighing && <WeighSheet onClose={() => setWeighing(false)} />}
      {quickMeal && <QuickMealSheet meal={quickMeal} onClose={() => setQuickMeal(null)} />}
      {snacking && <SnackSheet onClose={() => setSnacking(false)} />}
      {imposing && <ImposedSheet onClose={() => setImposing(false)} />}
      {cardio && <CardioSheet {...(cardio.type ? { type: cardio.type } : {})} onClose={() => setCardio(null)} />}
      {commuting && <CommuteSheet onClose={() => setCommuting(false)} />}
      {testing && <PushupTestSheet onClose={() => setTesting(false)} />}
      {editingPlans && <PlansSheet onClose={() => setEditingPlans(false)} />}
      {reviewing && <ReviewSheet day={reviewing.day} via={reviewing.via} onClose={() => setReviewing(null)} />}
    </main>
  );
}

/**
 * Lieu, durée et bouton de départ, sur une ligne (zone du bas). `second` : la 2e séance du jour,
 * proposée dans « Plus tard » une fois la première faite.
 */
function StartRow({ second = false }: { second?: boolean }) {
  const p = prefs.value;
  const disabled = !ready.value || locations.value.length === 0;
  const place = locations.value.find((l) => l.id === p.lastLocationId)?.name ?? 'Lieu';
  return (
    <div class={`start-row${second ? ' start-row--stack' : ''}`}>
      {/* La puce montre le choix ; la liste, invisible par-dessus, s'ouvre au toucher. Une liste
          visible prendrait la largeur de sa plus longue option et écraserait le bouton. */}
      <label class="fit-chip">
        <span class="fit-chip__value" aria-hidden="true">
          {place} ▾
        </span>
        <span class="visually-hidden">Lieu</span>
        <select value={p.lastLocationId} onChange={(e) => void setPref('lastLocationId', e.currentTarget.value)}>
          {locations.value.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label class="fit-chip">
        <span class="fit-chip__value" aria-hidden="true">
          {DURATION_LABEL[p.lastDuration]} ▾
        </span>
        <span class="visually-hidden">Durée</span>
        <select value={String(p.lastDuration)} onChange={(e) => void setPref('lastDuration', Number(e.currentTarget.value) as Duration)}>
          {DURATIONS.map((d) => (
            <option key={d} value={String(d)}>
              {DURATION_LABEL[d]}
            </option>
          ))}
        </select>
      </label>
      {second ? (
        <button class="btn start-row__go" type="button" disabled={disabled} onClick={() => go('knee')}>
          Une 2e séance quand même
        </button>
      ) : (
        <button class="cta start-row__go" type="button" aria-label="Démarrer la séance" disabled={disabled} onClick={() => go('knee')}>
          <span class="cta__title">Démarrer</span>
        </button>
      )}
    </div>
  );
}

function ResumeCard({ done, total, onAbandon }: { done: number; total: number; onAbandon: () => void }) {
  return (
    <section class="card" aria-labelledby="resume-title">
      <span class="card__label">Séance en cours</span>
      <h2 id="resume-title" class="card__title">
        {done} séries sur {total}
      </h2>
      <div class="segmented">
        <button class="btn" type="button" onClick={onAbandon}>
          Abandonner
        </button>
        <button class="btn btn--accent" type="button" onClick={() => go('session')}>
          Reprendre
        </button>
      </div>
    </section>
  );
}

function KneeCard() {
  const hint = useHint('knee-morning');
  return (
    <section class="card" aria-labelledby="morning-knee">
      <span class="card__label">Genou du lendemain</span>
      <span id="morning-knee" class="card__title">
        Ton genou ce matin ?
      </span>
      {hint && <span class="muted">Hier, tes jambes ont travaillé. C’est souvent le matin qu’on sent le mieux une tendinite.</span>}
      <div class="segmented">
        <button type="button" class="btn" onClick={() => void answerMorningKnee(false)}>
          Pareil
        </button>
        <button type="button" class="btn" onClick={() => void answerMorningKnee(true)}>
          Plus mal
        </button>
      </div>
    </section>
  );
}

function EveningReviewCard({ kind, onOpen }: { kind: 'today' | 'yesterday'; onOpen: () => void }) {
  const hint = useHint('evening-review');
  return (
    <button type="button" class="card card--link card--button" onClick={onOpen}>
      <span class="card__label">Bilan du soir · 30 s</span>
      <span class="card__title">{kind === 'today' ? 'Comment s’est passée ta journée ?' : 'Et hier, côté assiette ?'}</span>
      {hint && <span class="muted">Légumes, écart éventuel et ce qui l’a déclenché. Les protéines notées sont déjà comptées.</span>}
    </button>
  );
}

function PhaseCard({ id, onDone }: { id: keyof typeof PHASES; onDone: () => void }) {
  return (
    <section class="card" aria-labelledby="phase-notice">
      <span class="card__label">Nouvelle phase</span>
      <span id="phase-notice" class="card__title">
        {PHASES[id].label} · c’est parti
      </span>
      <ul class="phase-changes">
        {phaseChanges(id).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <span class="muted">Tout reste modifiable : lieu et durée en bas, objectif et phase dans Réglages.</span>
      <button type="button" class="btn btn--small" onClick={onDone}>
        Compris
      </button>
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
