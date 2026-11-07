/**
 * Éléments partagés par les vues du Carnet : lignes « à la Lafay » d'une séance
 * (exercice, séries × répétitions, ressenti) et d'une séance imposée.
 */
import type { WorkoutEntry, WorkoutRecord } from '../../domain/history';
import type { Activity } from '../../domain/recovery';
import type { Variant } from '../../domain/types';
import { formatClock, IMPOSED_KIND_LABEL, INTENSITY_LABEL } from '../format';
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

/** Une séance imposée dans le carnet. */
export function ActivityLine({ activity }: { activity: Activity }) {
  return (
    <div class="log-entry">
      <span class="muted log-entry__meta">Séance imposée</span>
      <div class="log-line">
        <span class="log-line__name">
          {IMPOSED_KIND_LABEL[activity.kind]} · {activity.minutes} min
        </span>
        <span class="muted">
          {INTENSITY_LABEL[activity.intensity].toLowerCase()}
          {activity.legs ? ' · jambes' : ''}
        </span>
      </div>
    </div>
  );
}
