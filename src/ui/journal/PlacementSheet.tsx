/**
 * Test de placement d'un mouvement (SPEC §4.5), facultatif, lancé depuis Niveaux.
 *
 * Une série max, propre, au niveau testé : au-dessus de la fourchette on monte d'un niveau
 * (après un repos), en dessous on descend, dedans c'est le bon niveau. L'appli propose alors
 * de le choisir ; rien ne change sans ce dernier geste.
 */
import { useState } from 'preact/hooks';
import { track } from '../../data/usage';
import { placementStep, type PlacementStep } from '../../domain/progression';
import type { Movement } from '../../domain/types';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { chooseLevel, levels, prefs } from '../state';

interface Props {
  movement: Movement;
  onClose: () => void;
}

/** Nom d'un niveau : ses variantes équivalentes (selon le matériel). */
const levelName = (m: Movement, i: number) => m.levels[i]!.variants.map((v) => v.name).join(' · ');

export function PlacementSheet({ movement, onClose }: Props) {
  const current = levels.value[movement.id] ?? 0;
  const [level, setLevel] = useState(current);
  const [cameFrom, setCameFrom] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<PlacementStep | null>(null);
  const [wristStop, setWristStop] = useState(false);

  const target = movement.levels[level]!.variants[0]!.target;
  const unit = target.kind === 'time' ? 's' : 'rép.';
  const [value, setValue] = useState(target.min);

  function submit() {
    let step = placementStep(level, value, target, movement.levels.length, cameFrom);
    // Règle poignet : on ne monte pas tout seul vers un niveau qui charge le poignet.
    if (step.kind === 'up' && prefs.value.wristRule && movement.levels[step.level]!.variants.some((v) => v.wristHeavy)) {
      step = { kind: 'placed', level };
      setWristStop(true);
    }
    track('placement', { movementId: movement.id, level, value, next: step.kind });
    if (step.kind === 'placed') {
      setResult(step);
      return;
    }
    setCameFrom(level);
    setLevel(step.level);
    setResult(step);
    setValue(movement.levels[step.level]!.variants[0]!.target.min);
  }

  async function choose(l: number) {
    track('level', { movementId: movement.id, from: current, to: l, via: 'placement' });
    await chooseLevel(movement.id, l);
    onClose();
  }

  const placed = result?.kind === 'placed' ? result.level : null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={placed === null ? 'Tester mon niveau' : 'Ton niveau'}
      kicker={movement.name}
      footer={
        placed === null ? (
          <button type="button" class="cta cta--compact" onClick={submit}>
            <span class="cta__title">Valider</span>
          </button>
        ) : placed === current ? (
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
      {placed === null ? (
        <>
          {result && (
            <p class="notice-line">
              {result.kind === 'up' ? 'Trop facile : on monte d’un niveau.' : 'Un peu dur : on descend d’un niveau.'} Récupère
              deux minutes avant la série suivante.
            </p>
          )}
          <p class="muted sheet__lead">
            Échauffe-toi, puis fais <strong>une série au maximum</strong>, en arrêtant dès que la technique se dégrade.
          </p>
          <div class="placement">
            <span class="card__label">
              Niveau {level + 1} / {movement.levels.length}
            </span>
            <strong class="placement__name">{levelName(movement, level)}</strong>
            <span class="muted">
              Fourchette : {target.min}–{target.max} {unit}
            </span>
          </div>
          <div class="row">
            <span>{target.kind === 'time' ? 'Tenu' : 'Répétitions'}</span>
            <Stepper
              label={target.kind === 'time' ? 'Secondes tenues' : 'Répétitions faites'}
              value={value}
              onChange={setValue}
              step={target.kind === 'time' ? 5 : 1}
              min={0}
              max={target.kind === 'time' ? 300 : 100}
              format={(v) => `${v}${target.kind === 'time' ? ' s' : ''}`}
            />
          </div>
        </>
      ) : (
        <div class="placement">
          <span class="card__label">
            Niveau {placed + 1} / {movement.levels.length}
          </span>
          <strong class="placement__name">{levelName(movement, placed)}</strong>
          <p class="muted" style={{ margin: 0 }}>
            {placed === current
              ? 'C’est déjà ton niveau : tu es au bon endroit.'
              : 'Tes objectifs partiront du bas de la fourchette, puis monteront séance après séance.'}
          </p>
          {wristStop && (
            <p class="muted" style={{ margin: 0 }}>
              Le niveau suivant charge beaucoup le poignet : à choisir à la main, seulement si ton poignet est indolore.
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}
