/**
 * Records personnels (J6a, SPEC §4.10), en tête de Carnet › Séances : la régularité en semaines
 * réussies, la plus longue série de pompes, la plus longue course, puis le meilleur de chaque
 * exercice (replié : la liste s'allonge vite). Rien ne s'affiche tant qu'il n'y a rien à montrer.
 */
import { CATALOG } from '../../data/catalog';
import { dayKey } from '../../domain/days';
import { longestRun, PUSHUP_MAX_SET, variantRecords, type VariantRecord } from '../../domain/records';
import { bestTest } from '../../domain/pushupTest';
import { formatTinyDate } from '../format';
import { movementById } from '../planner';
import { activities, workouts } from '../training';
import { weekRegularity } from '../weekState';

/** Nom et unité d'une variante (répétitions, secondes, par côté). */
export function variantInfo(movementId: string, variantId: string) {
  const movement = movementById(movementId);
  const variant =
    movement?.levels.flatMap((l) => l.variants).find((v) => v.id === variantId) ?? movement?.substitutes?.find((v) => v.id === variantId);
  return { movement, name: variant?.name ?? variantId, unit: variant?.target.kind === 'time' ? ' s' : '', perSide: !!variant?.perSide };
}

/** « 12 / côté », « 45 s ». */
export function formatRecord(r: { movementId: string; variantId: string; value: number }): string {
  const { unit, perSide } = variantInfo(r.movementId, r.variantId);
  return `${r.value}${unit}${perSide ? ' / côté' : ''}`;
}

const dateOf = (iso: string) => formatTinyDate(dayKey(new Date(iso)));

export function RecordsCard() {
  const records = variantRecords(workouts.value);
  const pushups = records.find((r) => r.variantId === PUSHUP_MAX_SET && !r.band);
  const run = longestRun(activities.value);
  const regular = weekRegularity().summary;
  const tests = [bestTest(activities.value, 'home'), bestTest(activities.value, 'pro')].filter((t) => t !== null);
  if (records.length === 0 && !run && regular.total === 0 && tests.length === 0) return null;

  // Par mouvement, dans l'ordre du catalogue ; dans un mouvement, la variante la plus récente d'abord.
  const byMovement = CATALOG.map((m) => ({
    movement: m,
    items: records.filter((r) => r.movementId === m.id && r.variantId !== PUSHUP_MAX_SET).sort((a, b) => b.at.localeCompare(a.at)),
  })).filter((g) => g.items.length > 0);
  const count = byMovement.reduce((n, g) => n + g.items.length, 0);

  return (
    <section class="card records" aria-labelledby="records-title">
      <h2 id="records-title" class="card__title">
        Records
      </h2>
      {regular.total > 0 && (
        <div class="row records__row">
          <span>Régularité</span>
          <span class="num records__value">
            {regular.total} semaine{regular.total > 1 ? 's' : ''} réussie{regular.total > 1 ? 's' : ''}
          </span>
        </div>
      )}
      {tests.map((t) => (
        <div key={t.format} class="row records__row">
          <span>Test pompes · {t.format === 'pro' ? 'pro' : 'maison'}</span>
          <span>
            <span class="num records__value">{t.reps}</span> <span class="muted">· {formatTinyDate(t.day)}</span>
          </span>
        </div>
      ))}
      {pushups && (
        <div class="row records__row">
          <span>Série de pompes</span>
          <span>
            <span class="num records__value">{pushups.value}</span> <span class="muted">· {dateOf(pushups.at)}</span>
          </span>
        </div>
      )}
      {run && (
        <div class="row records__row">
          <span>Plus longue course</span>
          <span>
            <span class="num records__value">{run.minutes} min</span> <span class="muted">· {formatTinyDate(run.day)}</span>
          </span>
        </div>
      )}
      {count > 0 && (
        <details class="records__details">
          <summary class="history__summary">Par exercice ({count})</summary>
          {byMovement.map((g) => (
            <div key={g.movement.id} class="records__group">
              <span class="card__label">{g.movement.name}</span>
              {g.items.map((r) => (
                <RecordLine key={`${r.variantId}|${r.band ?? ''}`} record={r} />
              ))}
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function RecordLine({ record }: { record: VariantRecord }) {
  const { name } = variantInfo(record.movementId, record.variantId);
  return (
    <div class="row records__row">
      <span class="records__name">
        {name}
        {record.band && <span class="muted"> · élastique {record.band}</span>}
      </span>
      <span>
        <span class="num records__value">{formatRecord(record)}</span> <span class="muted">· {dateOf(record.at)}</span>
      </span>
    </div>
  );
}
