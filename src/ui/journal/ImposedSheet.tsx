/**
 * Saisie rapide d'une séance imposée (sport obligatoire au travail, SPEC §4.4), après coup :
 * type, durée, jambes sollicitées, intensité. Elle compte dans la charge sur les jambes (le
 * moteur ménage les jambes le lendemain), le genou du lendemain et le calendrier.
 */
import { useState } from 'preact/hooks';
import { addDays, dayKey, dayToDate } from '../../domain/days';
import type { ImposedKind, Intensity } from '../../domain/recovery';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { Toggle } from '../components/Toggle';
import { formatLongDate, IMPOSED_KIND_LABEL, INTENSITY_LABEL } from '../format';
import { logImposed } from '../training';

interface Props {
  /** Jour imposé (depuis le calendrier) ; sinon, choix aujourd'hui / hier. */
  day?: string;
  onClose: () => void;
}

const KINDS = Object.entries(IMPOSED_KIND_LABEL) as [ImposedKind, string][];
const INTENSITIES = Object.entries(INTENSITY_LABEL) as [Intensity, string][];

export function ImposedSheet({ day: fixedDay, onClose }: Props) {
  const today = dayKey(new Date());
  const [day, setDay] = useState(fixedDay ?? today);
  const [kind, setKind] = useState<ImposedKind>('circuit');
  const [minutes, setMinutes] = useState(45);
  const [legs, setLegs] = useState(true);
  const [intensity, setIntensity] = useState<Intensity>('medium');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await logImposed({ type: 'imposed', day, at: new Date().toISOString(), minutes, kind, legs, intensity });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Séance imposée"
      kicker={fixedDay ? formatLongDate(dayToDate(fixedDay)) : undefined}
      footer={
        <button type="button" class="cta cta--compact" disabled={busy} onClick={() => void save()}>
          <span class="cta__title">Noter</span>
        </button>
      }
    >
      {!fixedDay && (
        <div class="segmented" role="radiogroup" aria-label="Jour">
          {[
            [today, 'Aujourd’hui'],
            [addDays(today, -1), 'Hier'],
          ].map(([d, label]) => (
            <button key={d} type="button" class="btn" role="radio" aria-checked={day === d} onClick={() => setDay(d!)}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div class="segmented segmented--tight" role="radiogroup" aria-label="Type">
        {KINDS.map(([value, label]) => (
          <button key={value} type="button" class="btn btn--small" role="radio" aria-checked={kind === value} onClick={() => setKind(value)}>
            {label}
          </button>
        ))}
      </div>

      <div class="row">
        <span>Durée</span>
        <Stepper label="Durée en minutes" value={minutes} onChange={setMinutes} step={5} min={5} max={240} format={(v) => `${v} min`} />
      </div>

      <Toggle label="Jambes sollicitées" hint="Course, sauts, squats… L’appli ménagera tes jambes demain." checked={legs} onChange={setLegs} />

      <div class="segmented segmented--tight" role="radiogroup" aria-label="Intensité">
        {INTENSITIES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            class="btn btn--small"
            role="radio"
            aria-checked={intensity === value}
            onClick={() => setIntensity(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
