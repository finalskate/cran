/**
 * Éléments partagés par les vues du Carnet : lignes « à la Lafay » d'une séance
 * (exercice, séries × répétitions, ressenti) et d'une activité (séance imposée, course, vélo,
 * vélotaf).
 */
import type { WorkoutEntry, WorkoutRecord } from '../../domain/history';
import type { Activity } from '../../domain/recovery';
import type { Variant } from '../../domain/types';
import {
  BIKE_KIND_LABEL,
  COMMUTE_LABEL,
  FEEL_LABEL,
  formatClock,
  formatKm,
  IMPOSED_KIND_LABEL,
  INTENSITY_LABEL,
  RUN_KIND_LABEL,
} from '../format';
import { movementById } from '../planner';
import { locations } from '../state';

/** Variante d'une entrée du carnet (y compris un substitut). */
export function variantOf(entry: WorkoutEntry): Variant | undefined {
  const m = movementById(entry.movementId);
  return m?.levels.flatMap((l) => l.variants).find((v) => v.id === entry.variantId) ?? m?.substitutes?.find((v) => v.id === entry.variantId);
}

/** Séries d'une entrée : « 12 · 11 · 10 dur », secondes pour un exercice en durée. */
export function SetsLine({ entry }: { entry: WorkoutEntry }) {
  const unit = variantOf(entry)?.target.kind === 'time' ? ' s' : '';
  return (
    <span class="sets-line num">
      {entry.sets.map((s, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {s.value}
          {unit}
          {s.feel === 'hard' && <span class="sets-line__hard"> dur</span>}
        </span>
      ))}
    </span>
  );
}

/** Une séance de renfo dans le carnet : lieu, durée, puis une ligne par exercice. */
export function WorkoutLines({ workout }: { workout: WorkoutRecord }) {
  const place = locations.value.find((l) => l.id === workout.locationId)?.name;
  const seconds = (new Date(workout.endedAt).getTime() - new Date(workout.startedAt).getTime()) / 1000;
  const entries = workout.entries.filter((e) => e.sets.length > 0);
  return (
    <div class="log-entry">
      <span class="muted log-entry__meta">
        Renfo{place ? ` · ${place}` : ''} · {formatClock(seconds)}
      </span>
      {entries.map((e, k) => (
        <div key={k} class="log-line">
          <span class="log-line__name">{variantOf(e)?.name ?? e.variantId}</span>
          <SetsLine entry={e} />
        </div>
      ))}
      {entries.length === 0 && <span class="muted">Aucune série notée.</span>}
    </div>
  );
}

/** Une activité hors renfo dans le carnet : séance imposée, course, vélo ou vélotaf. */
export function ActivityLine({ activity: a }: { activity: Activity }) {
  const [meta, name, detail] = describeActivity(a);
  return (
    <div class="log-entry">
      <span class="muted log-entry__meta">{meta}</span>
      <div class="log-line">
        <span class="log-line__name">{name}</span>
        <span class="muted">{detail}</span>
      </div>
    </div>
  );
}

/** Trois morceaux de texte : le genre, l'essentiel, les détails. */
function describeActivity(a: Activity): [string, string, string] {
  switch (a.type) {
    case 'imposed':
      return [
        'Séance imposée',
        `${IMPOSED_KIND_LABEL[a.kind]} · ${a.minutes} min`,
        `${INTENSITY_LABEL[a.intensity].toLowerCase()}${a.legs ? ' · jambes' : ''}`,
      ];
    case 'run':
      return [
        'Course',
        `${a.minutes} min${a.km !== undefined ? ` · ${formatKm(a.km)}` : ''}`,
        `${RUN_KIND_LABEL[a.kind].toLowerCase()} · ${FEEL_LABEL[a.feel].toLowerCase()} · genou ${a.kneeAfter}`,
      ];
    case 'bike':
      return ['Vélo', `${a.minutes} min`, `${BIKE_KIND_LABEL[a.kind].toLowerCase()} · ${FEEL_LABEL[a.feel].toLowerCase()}`];
    case 'commute':
      return ['Vélotaf', COMMUTE_LABEL[a.trips], ''];
  }
}
