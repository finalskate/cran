/**
 * Choix de la phase (J5b, SPEC §1.3), depuis Réglages : la phase, puis « à partir
 * d'aujourd'hui » ou d'un jour à venir (changement programmé, appliqué tout seul ce jour-là).
 * Sous chaque phase, ce qu'elle change : rien n'est verrouillé, tout reste modifiable ensuite.
 */
import { useState } from 'preact/hooks';
import { PHASES } from '../../data/phases';
import { addDays, dayKey } from '../../domain/days';
import { PHASE_IDS, type PhaseId } from '../../domain/phase';
import { currentPhase, phaseChanges, selectPhase } from '../phaseState';
import { Sheet } from './Sheet';

interface Props {
  onClose: () => void;
}

export function PhaseSheet({ onClose }: Props) {
  const today = dayKey(new Date());
  const current = currentPhase();
  const [id, setId] = useState<PhaseId>(current?.id ?? 'holidays');
  const [later, setLater] = useState(false);
  const [since, setSince] = useState(addDays(today, 1));
  const [busy, setBusy] = useState(false);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(since) && since > today;

  async function save() {
    setBusy(true);
    await selectPhase(id, later ? since : today);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Phase"
      footer={
        <button type="button" class="cta cta--compact" disabled={busy || (later && !validDate)} onClick={() => void save()}>
          <span class="cta__title">{later ? 'Programmer' : 'Choisir'}</span>
        </button>
      }
    >
      <div class="choice-list" role="radiogroup" aria-label="Phase">
        {PHASE_IDS.map((p) => (
          <button key={p} type="button" class="choice choice--stack" role="radio" aria-checked={id === p} onClick={() => setId(p)}>
            <span class="choice__title">
              {PHASES[p].label}
              {current?.id === p && <span class="muted"> · en cours</span>}
            </span>
            <span class="muted choice__hint">{PHASES[p].description}</span>
          </button>
        ))}
      </div>

      <ul class="phase-changes">
        {phaseChanges(id).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div class="segmented" role="radiogroup" aria-label="À partir de">
        <button type="button" class="btn" role="radio" aria-checked={!later} onClick={() => setLater(false)}>
          Dès aujourd’hui
        </button>
        <button type="button" class="btn" role="radio" aria-checked={later} onClick={() => setLater(true)}>
          Plus tard
        </button>
      </div>
      {later && (
        <div class="field">
          <label for="phase-since">Premier jour</label>
          <input id="phase-since" type="date" min={addDays(today, 1)} value={since} onInput={(e) => setSince(e.currentTarget.value)} />
          <span class="muted">Le changement se fera tout seul ce jour-là, à la première ouverture de l’appli.</span>
        </div>
      )}
    </Sheet>
  );
}
