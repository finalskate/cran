/**
 * Fierté (J6b) : cartes affichées en tête de Carnet › Séances.
 *  - `BadgesCard` : les badges en médaillons, gagnés en couleur, les autres en pointillés avec
 *    où on en est (« 4/12 ») ;
 *  - `PuzzleCard` : le puzzle de l'étape de poids suivante, sur une photo du mont Fuji (domaine
 *    public, CC0) ; une pièce tous les 2 kg de tendance ;
 *  - `WeekSetsCard` : séries de la semaine par famille, avec le repère 10–20 par muscle.
 */
import { CATALOG } from '../../data/catalog';
import type { BadgeKind, BadgeState } from '../../domain/badges';
import { mondayOf } from '../../domain/calendar';
import { addDays, dayKey } from '../../domain/days';
import { SET_FAMILIES, setsByFamily } from '../../domain/history';
import { puzzleGrid, type Puzzle } from '../../domain/puzzle';
import { CATEGORY_LABEL, formatKg } from '../format';
import { badgeList, dayOfIso, puzzleNow } from '../prideState';
import { prefs } from '../state';
import { workouts } from '../training';

/** Couleur du médaillon selon le genre de badge (vert = régularité, rose = course). */
const KIND_CLASS: Record<BadgeKind, string> = {
  level: 'medal--accent',
  weeks: 'medal--ok',
  sessions: 'medal--accent',
  pushups: 'medal--accent',
  run: 'medal--pink',
  weight: 'medal--ok',
};

/** « 4/12 », « 42 », « 45 min » : où on en est d'un badge pas encore gagné. */
function progressText(s: BadgeState): string {
  switch (s.def.kind) {
    case 'run':
      return s.value > 0 ? `${s.value} min` : '';
    case 'pushups':
      return s.value > 0 ? `${s.value}` : '';
    case 'weight':
      return '';
    default:
      return `${Math.min(s.value, s.def.threshold)}/${s.def.threshold}`;
  }
}

export function Medal({ state, earned }: { state: BadgeState; earned: boolean }) {
  return <span class={`medal ${earned ? KIND_CLASS[state.def.kind] : 'medal--todo'}`}>{state.def.medal}</span>;
}

export function BadgesCard() {
  const kept = prefs.value.badges;
  const list = badgeList();
  const earned = list.filter((s) => kept[s.def.id] || s.reachedOn).length;
  return (
    <section class="card" aria-labelledby="badges-title">
      <div class="row" style={{ minHeight: 0 }}>
        <h2 id="badges-title" class="card__title">
          Badges
        </h2>
        <span class="muted num">
          {earned} sur {list.length}
        </span>
      </div>
      <div class="badges">
        {list.map((s) => {
          const got = !!(kept[s.def.id] || s.reachedOn);
          const progress = got ? '' : progressText(s);
          return (
            <div key={s.def.id} class={`badge${got ? '' : ' badge--todo'}`}>
              <Medal state={s} earned={got} />
              <span class="badge__label">
                {s.def.label}
                {progress && <span class="muted"> · {progress}</span>}
              </span>
            </div>
          );
        })}
      </div>
      <span class="muted card__hint">Un badge gagné reste gagné, quoi qu’il arrive ensuite.</span>
    </section>
  );
}

/** Image du puzzle : mont Fuji au coucher du soleil (Wikimedia Commons, CC0), dans public/. */
const PUZZLE_IMAGE = `${import.meta.env.BASE_URL}puzzle/fuji.jpg`;

/** Le puzzle en image : chaque case montre son morceau de photo, ou un emplacement vide. */
export function PuzzleBoard({ puzzle }: { puzzle: Puzzle }) {
  const total = puzzle.thresholds.length;
  const { cols, rows } = puzzleGrid(total);
  const cells = cols * rows;
  return (
    <div
      class="puzzle"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, aspectRatio: '3 / 2' }}
      role="img"
      aria-label={`Puzzle : ${puzzle.earned} pièce${puzzle.earned > 1 ? 's' : ''} sur ${total}`}
    >
      {Array.from({ length: cells }, (_, c) => {
        // Moins de pièces que de cases : une pièce couvre plusieurs cases voisines.
        const piece = Math.floor((c * total) / cells);
        const first = c === 0 || Math.floor(((c - 1) * total) / cells) !== piece;
        const col = c % cols;
        const row = Math.floor(c / cols);
        const placed = piece < puzzle.earned;
        return (
          <span
            key={c}
            class={`puzzle__cell${placed ? ' puzzle__cell--placed' : ''}`}
            style={
              placed
                ? {
                    backgroundImage: `url(${PUZZLE_IMAGE})`,
                    backgroundSize: `${cols * 100}% ${rows * 100}%`,
                    backgroundPosition: `${cols > 1 ? (col / (cols - 1)) * 100 : 0}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%`,
                  }
                : undefined
            }
          >
            {!placed && first && <span class="puzzle__at num">{formatKg(puzzle.thresholds[piece]!)}</span>}
          </span>
        );
      })}
    </div>
  );
}

export function PuzzleCard() {
  const puzzle = puzzleNow();
  if (!puzzle) return null;
  const total = puzzle.thresholds.length;
  const next = puzzle.thresholds[puzzle.earned];
  return (
    <section class="card" aria-labelledby="puzzle-title">
      <div class="row" style={{ minHeight: 0 }}>
        <h2 id="puzzle-title" class="card__title">
          Étape {formatKg(puzzle.goal)}
        </h2>
        <span class="muted num">
          {puzzle.earned} pièce{puzzle.earned > 1 ? 's' : ''} sur {total}
        </span>
      </div>
      <PuzzleBoard puzzle={puzzle} />
      {next !== undefined && (
        <span>
          Prochaine pièce quand la <strong>tendance</strong> passe sous <span class="num">{formatKg(next)}</span>.
        </span>
      )}
      <span class="muted card__hint">
        Une pièce tous les 2 kg, sur la tendance (jamais la pesée du jour) : une pièce gagnée ne se reprend pas. Puzzle complet =
        badge de l’étape.
      </span>
    </section>
  );
}

/** Repères d'hypertrophie : séries par muscle et par semaine. */
const SETS_LOW = 10;
const SETS_HIGH = 20;

export function WeekSetsCard() {
  const today = dayKey(new Date());
  const monday = mondayOf(today);
  const sets = setsByFamily(workouts.value, CATALOG, monday, addDays(monday, 6), dayOfIso);
  const families = SET_FAMILIES.filter((f) => (sets[f] ?? 0) > 0);
  if (families.length === 0) return null;
  return (
    <section class="card" aria-labelledby="sets-title">
      <h2 id="sets-title" class="card__title">
        Séries cette semaine
      </h2>
      {families.map((f) => {
        const n = sets[f]!;
        return (
          <div key={f} class="sets-row">
            <span>{CATEGORY_LABEL[f]}</span>
            <span class="sets-row__bar" aria-hidden="true">
              <span class="sets-row__zone" />
              <span class={`sets-row__fill${n >= SETS_LOW ? ' sets-row__fill--ok' : ''}`} style={{ width: `${Math.min(100, (n / SETS_HIGH) * 100)}%` }} />
            </span>
            <span class="num sets-row__n">{n}</span>
          </div>
        );
      })}
      <span class="muted card__hint">
        Repère : {SETS_LOW} à {SETS_HIGH} séries par muscle et par semaine (zone claire) font grossir un muscle. Moins, ça entretient
        quand même.
      </span>
    </section>
  );
}
