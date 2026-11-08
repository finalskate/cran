/**
 * Test de placement d'un mouvement (SPEC §4.5), facultatif, lancé depuis Niveaux.
 *
 * Une série max, propre, au niveau testé : au-dessus de la fourchette on peut tester le niveau
 * au-dessus, en dessous celui d'en dessous, dedans c'est le bon niveau. L'appli propose alors de
 * le choisir ; rien ne change sans ce dernier geste.
 *
 * Retouche du 08/11 (retour : « le bilan n'est pas clair ») :
 *  - une seule variante affichée : celle qu'on fera vraiment sur le lieu habituel (la préférée,
 *    ou la première faisable), avec SA fourchette ;
 *  - compteur vide au départ : « Valider » sans avoir noté de série est impossible (avant, la
 *    valeur pré-remplie plaçait au niveau testé sans l'avoir fait) ;
 *  - après une série hors fourchette, un écran intermédiaire : ce qui vient de se passer, puis
 *    « Tester le niveau N » ou « M'arrêter là » (une 2e série max après la 1re est faussée par
 *    la fatigue : on peut préférer laisser la progression faire le reste) ;
 *  - un résultat qui récapitule les séries et dit ce qui change à la prochaine séance.
 */
import { useState } from 'preact/hooks';
import { track } from '../../data/usage';
import { bandLabels, startRank } from '../../domain/bands';
import { placementStep, type PlacementStep } from '../../domain/progression';
import type { Movement, Target, Variant } from '../../domain/types';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { formatTarget } from '../format';
import { levelVariant } from '../planner';
import { chooseLevel, levels, prefs } from '../state';

interface Props {
  movement: Movement;
  onClose: () => void;
}

/** Une série du test, telle qu'elle est rappelée dans le récapitulatif. */
interface Tried {
  level: number;
  variant: Variant;
  value: number;
  verdict: PlacementStep['kind'];
}

type Phase =
  | { kind: 'input' }
  /** Série hors fourchette : on propose le niveau voisin, ou de s'arrêter. */
  | { kind: 'between'; next: number; stopAt: number }
  | { kind: 'result'; level: number; wristStop: boolean };

const unitOf = (t: Target, perSide?: boolean) => `${t.kind === 'time' ? 's' : 'rép.'}${perSide ? ' par côté' : ''}`;

/** « 12 rép. par côté, au-dessus de la fourchette (5–10) ». */
function triedLine(t: Tried): string {
  const range = `${t.variant.target.min}–${t.variant.target.max}`;
  const where = t.verdict === 'up' ? `au-dessus de la fourchette (${range})` : t.verdict === 'down' ? `sous la fourchette (${range})` : `dans la fourchette (${range})`;
  return `${t.value} ${unitOf(t.variant.target, t.variant.perSide)}, ${where}`;
}

export function PlacementSheet({ movement, onClose }: Props) {
  const current = levels.value[movement.id] ?? 0;
  // Lieu habituel : la variante testée est celle qui y sera proposée.
  const variantAt = (l: number) => levelVariant(movement, l);

  const [level, setLevel] = useState(current);
  const [cameFrom, setCameFrom] = useState<number | undefined>(undefined);
  const [tried, setTried] = useState<Tried[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'input' });
  // null = rien de noté encore (le compteur affiche « — »).
  const [value, setValue] = useState<number | null>(null);

  const variant = variantAt(level);
  const target = variant.target;
  const others = movement.levels[level]!.variants.filter((v) => v.id !== variant.id);

  function submit() {
    if (value === null) return;
    let step = placementStep(level, value, target, movement.levels.length, cameFrom);
    // Règle poignet : on ne monte pas tout seul vers un niveau qui charge le poignet.
    let wristStop = false;
    if (step.kind === 'up' && prefs.value.wristRule && movement.levels[step.level]!.variants.some((v) => v.wristHeavy)) {
      step = { kind: 'placed', level };
      wristStop = true;
    }
    track('placement', { movementId: movement.id, level, variantId: variant.id, value, next: step.kind });
    setTried([...tried, { level, variant, value, verdict: wristStop ? 'placed' : step.kind }]);
    if (step.kind === 'placed') {
      setPhase({ kind: 'result', level: step.level, wristStop });
      return;
    }
    // S'arrêter là : après un « trop facile », on garde le niveau testé (la progression montera
    // vite) ; après un « trop dur », on part du niveau en dessous.
    setPhase({ kind: 'between', next: step.level, stopAt: step.kind === 'up' ? level : step.level });
  }

  function testNext(next: number) {
    setCameFrom(level);
    setLevel(next);
    setValue(null);
    setPhase({ kind: 'input' });
  }

  async function choose(l: number) {
    track('level', { movementId: movement.id, from: current, to: l, via: 'placement' });
    await chooseLevel(movement.id, l);
    onClose();
  }

  // ─── Résultat ───
  if (phase.kind === 'result') {
    const placed = phase.level;
    const v = variantAt(placed);
    const lastTry = tried[tried.length - 1];
    const aboveRange = lastTry && lastTry.level === placed && lastTry.verdict === 'up';
    const labels = bandLabels(prefs.value.bands);
    return (
      <Sheet
        open
        onClose={onClose}
        title="Ton niveau"
        kicker={movement.name}
        footer={
          placed === current ? (
            <button type="button" class="cta cta--compact" onClick={onClose}>
              <span class="cta__title">Parfait, je garde ce niveau</span>
            </button>
          ) : (
            <button type="button" class="cta cta--compact" onClick={() => void choose(placed)}>
              <span class="cta__title">Choisir le niveau {placed + 1}</span>
            </button>
          )
        }
      >
        <TriedList tried={tried} />
        <div class="placement">
          <span class="card__label">
            Niveau {placed + 1} / {movement.levels.length}
          </span>
          <strong class="placement__name">{v.name}</strong>
          <p class="muted placement__text">
            {placed === current ? 'C’est déjà ton niveau : rien ne change.' : `À ta prochaine séance : ${v.name}, ${formatTarget(v.target, v.perSide)} par série.`}{' '}
            {aboveRange
              ? 'Tu es déjà au-dessus de la fourchette : deux séances au haut suffiront pour débloquer la suite.'
              : 'L’objectif part du bas de la fourchette et monte d’un cran à chaque séance réussie.'}
          </p>
          {v.band && <p class="muted placement__text">Élastique de départ : {labels[startRank(v.band, labels.length)]}.</p>}
          {v.startHint && <p class="muted placement__text">{v.startHint}</p>}
          {phase.wristStop && (
            <p class="muted placement__text">
              Le niveau suivant charge beaucoup le poignet : à choisir à la main, seulement si ton poignet est indolore.
            </p>
          )}
        </div>
      </Sheet>
    );
  }

  // ─── Série hors fourchette : niveau voisin, ou s'arrêter ───
  if (phase.kind === 'between') {
    const last = tried[tried.length - 1]!;
    const up = last.verdict === 'up';
    const nextVariant = variantAt(phase.next);
    return (
      <Sheet
        open
        onClose={onClose}
        title={up ? 'Trop facile' : 'Un peu dur'}
        kicker={movement.name}
        footer={
          <div class="segmented">
            <button type="button" class="btn btn--big" onClick={() => setPhase({ kind: 'result', level: phase.stopAt, wristStop: false })}>
              M’arrêter là
            </button>
            <button type="button" class="cta cta--compact" onClick={() => testNext(phase.next)}>
              <span class="cta__title">Tester ce niveau</span>
            </button>
          </div>
        }
      >
        <TriedList tried={tried} />
        <p class="sheet__lead" style={{ margin: 0 }}>
          {up ? 'Niveau au-dessus' : 'Niveau en dessous'} : <strong>{nextVariant.name}</strong> ({formatTarget(nextVariant.target, nextVariant.perSide)}).
        </p>
        <p class="muted placement__text">
          {up
            ? 'Pour le tester, récupère deux à trois minutes puis fais une nouvelle série au maximum. Après une première série à fond, la seconde est souvent un peu sous-estimée.'
            : 'Récupère deux à trois minutes avant la série suivante.'}{' '}
          {up ? `« M’arrêter là » garde le niveau ${phase.stopAt + 1} : il se débloquera vite.` : `« M’arrêter là » te place au niveau ${phase.stopAt + 1} sans le tester.`}
        </p>
        {nextVariant.startHint && <p class="muted placement__text">{nextVariant.startHint}</p>}
      </Sheet>
    );
  }

  // ─── Saisie de la série ───
  const isTime = target.kind === 'time';
  return (
    <Sheet
      open
      onClose={onClose}
      title="Tester mon niveau"
      kicker={movement.name}
      footer={
        <button type="button" class="cta cta--compact" disabled={value === null} onClick={submit}>
          <span class="cta__title">{value === null ? 'Note ta série pour valider' : 'Valider'}</span>
        </button>
      }
    >
      {tried.length > 0 && <TriedList tried={tried} />}
      <p class="muted sheet__lead">
        Échauffe-toi, puis fais <strong>une série au maximum</strong>, en arrêtant dès que la technique se dégrade.
      </p>
      <div class="placement">
        <span class="card__label">
          Niveau {level + 1} / {movement.levels.length}
        </span>
        <strong class="placement__name">{variant.name}</strong>
        <span class="muted">Fourchette : {formatTarget(target, variant.perSide)}</span>
        {others.length > 0 && (
          <span class="muted placement__text">Même niveau, selon le matériel : {others.map((o) => o.name).join(', ')}.</span>
        )}
        {variant.startHint && <span class="muted placement__text">{variant.startHint}</span>}
      </div>
      <div class="row">
        <span>{isTime ? 'Tenu' : variant.perSide ? 'Répétitions par côté' : 'Répétitions'}</span>
        <Stepper
          label={isTime ? 'Secondes tenues' : 'Répétitions faites'}
          value={value ?? 0}
          // Premier appui sur « + » : on part du bas de la fourchette plutôt que de zéro.
          onChange={(v) => setValue(value === null ? Math.max(v, target.min) : v)}
          step={isTime ? 5 : 1}
          min={0}
          max={isTime ? 300 : 100}
          format={(v) => (value === null ? '—' : `${v}${isTime ? ' s' : ''}`)}
        />
      </div>
    </Sheet>
  );
}

/** Séries déjà faites pendant ce test. */
function TriedList({ tried }: { tried: Tried[] }) {
  return (
    <ul class="placement-tried" aria-label="Séries du test">
      {tried.map((t, k) => (
        <li key={k}>
          <span class="muted">Niveau {t.level + 1} · </span>
          {t.variant.name} : <span class="num">{triedLine(t)}</span>
        </li>
      ))}
    </ul>
  );
}
