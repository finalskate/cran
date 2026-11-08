/**
 * Vélotaf (J5a, SPEC §4.7) : un geste. Toucher « Aller », « Retour » ou « Aller et retour »
 * enregistre et ferme. Le vélotaf apparaît dans la semaine (petit trait) mais ne compte ni dans
 * l'objectif ni dans la charge sur les jambes (trajets courts, décision du 08/11).
 */
import { useState } from 'preact/hooks';
import { addDays, dayKey, dayToDate } from '../../domain/days';
import { Sheet } from '../components/Sheet';
import { formatLongDate } from '../format';
import { activities, logCommute } from '../training';

interface Props {
  /** Jour imposé (depuis le calendrier) ; sinon, choix aujourd'hui / hier. */
  day?: string;
  onClose: () => void;
}

export function CommuteSheet({ day: fixedDay, onClose }: Props) {
  const today = dayKey(new Date());
  const [day, setDay] = useState(fixedDay ?? today);
  const [busy, setBusy] = useState(false);
  const already = activities.value.reduce((n, a) => n + (a.type === 'commute' && a.day === day ? a.trips : 0), 0);

  async function save(trips: 1 | 2) {
    setBusy(true);
    await logCommute({ type: 'commute', day, at: new Date().toISOString(), trips });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title="Vélotaf" kicker={fixedDay ? formatLongDate(dayToDate(fixedDay)) : undefined}>
      {!fixedDay && (
        <div class="segmented segmented--tight" role="radiogroup" aria-label="Jour">
          {[
            [today, 'Aujourd’hui'],
            [addDays(today, -1), 'Hier'],
          ].map(([d, label]) => (
            <button key={d} type="button" class="btn btn--small" role="radio" aria-checked={day === d} onClick={() => setDay(d!)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {already > 0 && (
        <p class="muted" style={{ margin: 0 }}>
          Déjà noté ce jour-là : {already === 1 ? 'un trajet' : `${already} trajets`}.
        </p>
      )}
      <div class="commute-choices">
        <button type="button" class="btn" disabled={busy} onClick={() => void save(1)}>
          Aller
        </button>
        <button type="button" class="btn" disabled={busy} onClick={() => void save(1)}>
          Retour
        </button>
        <button type="button" class="btn btn--accent commute-choices__both" disabled={busy} onClick={() => void save(2)}>
          Aller et retour
        </button>
      </div>
    </Sheet>
  );
}
