/**
 * Mode pause (J6a, SPEC §4.10) : maladie, blessure, semaine impossible. L'objectif de la semaine
 * est suspendu (la semaine ne compte ni pour ni contre), rien n'est perdu : niveaux, carnet et
 * semaines réussies restent. Jusqu'à nouvel ordre, ou jusqu'à une date (la reprise se fait seule).
 * L'éloignement n'est pas une pause : il a sa phase, avec son propre objectif.
 */
import { useState } from 'preact/hooks';
import { addDays, dayKey } from '../../domain/days';
import { currentPause, pauseFrom } from '../weekState';
import { Sheet } from './Sheet';

export function PauseSheet({ onClose }: { onClose: () => void }) {
  const today = dayKey(new Date());
  const current = currentPause();
  const [dated, setDated] = useState(current?.until !== undefined);
  const [until, setUntil] = useState(current?.until ?? addDays(today, 6));
  const [busy, setBusy] = useState(false);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(until) && until >= today;

  async function save() {
    setBusy(true);
    await pauseFrom(dated ? until : undefined);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={current ? 'Changer la fin de la pause' : 'Faire une pause'}
      footer={
        <button type="button" class="cta cta--compact" disabled={busy || (dated && !validDate)} onClick={() => void save()}>
          <span class="cta__title">{current ? 'Enregistrer' : 'Mettre en pause'}</span>
        </button>
      }
    >
      <p class="muted" style={{ margin: 0 }}>
        L’objectif de la semaine est suspendu : une semaine en pause ne compte ni pour ni contre. Tes niveaux, ton carnet et tes
        semaines réussies restent. Une séance reste possible quand tu veux.
      </p>
      <div class="segmented" role="radiogroup" aria-label="Jusqu’à quand">
        <button type="button" class="btn" role="radio" aria-checked={!dated} onClick={() => setDated(false)}>
          Jusqu’à nouvel ordre
        </button>
        <button type="button" class="btn" role="radio" aria-checked={dated} onClick={() => setDated(true)}>
          Jusqu’au…
        </button>
      </div>
      {dated && (
        <div class="field">
          <label for="pause-until">Dernier jour de pause</label>
          <input id="pause-until" type="date" min={today} value={until} onInput={(e) => setUntil(e.currentTarget.value)} />
          <span class="muted">La reprise se fera toute seule le lendemain.</span>
        </div>
      )}
    </Sheet>
  );
}
