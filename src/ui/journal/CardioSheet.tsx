/**
 * Saisie rapide d'une course ou d'une séance de vélo (J5a, SPEC §4.7) : moins de 15 secondes.
 * La durée est pré-remplie avec la suggestion du moment (src/domain/running.ts), la distance est
 * facultative, puis le ressenti et le genou après la course (0 pré-sélectionné). La montre garde
 * le détail : ici, juste de quoi suivre le plan, la charge sur les jambes et la semaine.
 *
 * S'ouvre sur le dernier type noté (course ou vélo), sauf si l'appelant impose le type.
 * Séance proposée par la montre (retour du 14/11) : type « Garmin », puis sa catégorie.
 */
import { useState } from 'preact/hooks';
import { addDays, dayKey, dayToDate } from '../../domain/days';
import type { Feel } from '../../domain/history';
import type { BikeKind, GarminWorkout, RunKind } from '../../domain/recovery';
import { bikePlan, runPlan } from '../../domain/running';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { NumberField } from '../food/common';
import { BIKE_KIND_LABEL, FEEL_LABEL, formatLongDate, GARMIN_LABEL, parseDecimal, RUN_KIND_LABEL } from '../format';
import { prefs, setPref } from '../state';
import { activities, kneeLogs, logBike, logRun } from '../training';

type CardioType = 'run' | 'bike';

interface Props {
  /** Jour imposé (depuis le calendrier) ; sinon, choix aujourd'hui / hier. */
  day?: string;
  /** Type imposé (carte « Prochaine sortie ») ; sinon, le dernier noté. */
  type?: CardioType;
  onClose: () => void;
}

const FEELS = Object.entries(FEEL_LABEL) as [Feel, string][];
const RUN_KINDS = Object.entries(RUN_KIND_LABEL) as [RunKind, string][];
const BIKE_KINDS = Object.entries(BIKE_KIND_LABEL) as [BikeKind, string][];
const GARMIN_WORKOUTS = Object.entries(GARMIN_LABEL) as [GarminWorkout, string][];

/** Valeurs de départ d'un type : celles de la suggestion du moment. */
function suggested(type: CardioType): { minutes: number; kind: RunKind | BikeKind } {
  const now = new Date();
  const next = type === 'run' ? runPlan(activities.value, kneeLogs.value, now).next : bikePlan(activities.value, kneeLogs.value, now).next;
  return next ?? { minutes: 30, kind: 'easy' };
}

export function CardioSheet({ day: fixedDay, type: fixedType, onClose }: Props) {
  const today = dayKey(new Date());
  const [day, setDay] = useState(fixedDay ?? today);
  const [type, setType] = useState<CardioType>(fixedType ?? prefs.value.lastCardio);
  const [minutes, setMinutes] = useState(() => suggested(type).minutes);
  const [kind, setKind] = useState<RunKind | BikeKind>(() => suggested(type).kind);
  const [garmin, setGarmin] = useState<GarminWorkout>('base');
  const [km, setKm] = useState('');
  const [feel, setFeel] = useState<Feel>('ok');
  const [knee, setKnee] = useState(0);
  const [busy, setBusy] = useState(false);

  function switchType(t: CardioType) {
    if (t === type) return;
    setType(t);
    const s = suggested(t);
    setMinutes(s.minutes);
    setKind(s.kind);
  }

  async function save() {
    setBusy(true);
    const at = new Date().toISOString();
    if (type === 'run') {
      const distance = parseDecimal(km);
      await logRun({
        type: 'run',
        day,
        at,
        minutes,
        kind: kind as RunKind,
        ...(kind === 'garmin' ? { garmin } : {}),
        feel,
        kneeAfter: knee,
        ...(distance !== undefined && distance > 0 ? { km: distance } : {}),
      });
    } else {
      await logBike({ type: 'bike', day, at, minutes, kind: kind as BikeKind, feel });
    }
    await setPref('lastCardio', type);
    onClose();
  }

  const kinds = type === 'run' ? RUN_KINDS : BIKE_KINDS;

  return (
    <Sheet
      open
      onClose={onClose}
      title={type === 'run' ? 'Course' : 'Vélo'}
      kicker={fixedDay ? formatLongDate(dayToDate(fixedDay)) : undefined}
      footer={
        <button type="button" class="cta cta--compact" disabled={busy} onClick={() => void save()}>
          <span class="cta__title">Noter</span>
        </button>
      }
    >
      <div class="segmented" role="radiogroup" aria-label="Activité">
        {(
          [
            ['run', 'Course'],
            ['bike', 'Vélo'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} type="button" class="btn" role="radio" aria-checked={type === t} onClick={() => switchType(t)}>
            {label}
          </button>
        ))}
      </div>

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

      <div class="row">
        <span>Durée</span>
        <Stepper label="Durée en minutes" value={minutes} onChange={setMinutes} step={1} min={5} max={240} format={(v) => `${v} min`} />
      </div>

      <div class="segmented segmented--tight" role="radiogroup" aria-label="Type de sortie">
        {kinds.map(([value, label]) => (
          <button key={value} type="button" class="btn btn--small" role="radio" aria-checked={kind === value} onClick={() => setKind(value)}>
            {label}
          </button>
        ))}
      </div>

      {type === 'run' && kind === 'garmin' && (
        <div class="segmented segmented--tight segmented--grid" role="radiogroup" aria-label="Séance Garmin">
          {GARMIN_WORKOUTS.map(([value, label]) => (
            <button key={value} type="button" class="btn btn--small" role="radio" aria-checked={garmin === value} onClick={() => setGarmin(value)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {type === 'run' && <NumberField id="run-km" label="Distance (facultative)" value={km} onInput={setKm} suffix="km" />}

      <div class="segmented segmented--tight" role="radiogroup" aria-label="Ressenti">
        {FEELS.map(([value, label]) => (
          <button key={value} type="button" class="btn btn--small" role="radio" aria-checked={feel === value} onClick={() => setFeel(value)}>
            {label}
          </button>
        ))}
      </div>

      {type === 'run' && (
        <div class="cardio-knee">
          <span id="run-knee-label" class="card__label">
            Genou après la course (0 à 10)
          </span>
          <div class="score-grid score-grid--compact" role="radiogroup" aria-labelledby="run-knee-label">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={knee === n}
                class={`score score--${n >= 5 ? 'high' : n >= 3 ? 'mid' : 'low'}`}
                onClick={() => setKnee(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
