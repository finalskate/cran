/**
 * Records personnels (J6a, SPEC §4.10 : « la fierté est un moteur »). Fonctions pures, testées
 * dans records.test.ts.
 *
 *  - Par variante : la meilleure série (répétitions, ou secondes pour un exercice en durée). Un
 *    exercice à l'élastique a un record par élastique : 15 avec le 10 kg ne se compare pas à 15
 *    avec le 30 kg. De même, un exercice lesté a un record par charge du sac (14/11).
 *    La date retenue est celle où le record a été établi (la 1re fois).
 *  - La plus longue série de pompes : le record de la série longue hebdomadaire (pushup-max-set).
 *  - La plus longue course (les miennes et les imposées « course »).
 *  - Un NOUVEAU record se fête au bilan de la séance seulement s'il bat un record existant : la
 *    toute première fois sur une variante n'est pas un record, c'est un point de départ.
 * L'échauffement et le retour au calme (guidés, sans compte) n'ont pas de record.
 * Le test pompes mensuel (format professionnel) arrive au J6b.
 */
import type { WorkoutRecord } from './history';
import type { Activity } from './recovery';

/** Mouvements sans record : guidés, sans séries comptées. */
const NO_RECORD = new Set(['warmup', 'cooldown']);

/** Variante de la série longue de pompes (catalogue, bloc « Volume pompes »). */
export const PUSHUP_MAX_SET = 'pushup-max-set';

/** Meilleure série sur une variante (et un élastique). */
export interface VariantRecord {
  movementId: string;
  variantId: string;
  /** Élastique utilisé (« 20 kg », « moyen »), pour les exercices à l'élastique. */
  band?: string;
  /** Charge du sac en kg, pour les exercices lestés. */
  load?: number;
  value: number;
  /** Séance où le record a été établi (début, ISO). */
  at: string;
}

const keyOf = (variantId: string, band?: string, load?: number) => [variantId, band ?? '', load ?? ''].join('|');

/** Élastique et charge d'une série, tels qu'ils distinguent les records. */
const setupOf = (e: { band?: { label: string }; load?: number }) => ({
  ...(e.band ? { band: e.band.label } : {}),
  ...(e.load !== undefined ? { load: e.load } : {}),
});

/** Même variante, même élastique, même charge. */
const sameSetup = (r: { variantId: string; band?: string; load?: number }, variantId: string, setup: { band?: string; load?: number }) =>
  r.variantId === variantId && r.band === setup.band && r.load === setup.load;

/** Meilleure série par variante (et élastique), de toutes les séances passées. */
export function variantRecords(workouts: readonly WorkoutRecord[]): VariantRecord[] {
  const best = new Map<string, VariantRecord>();
  const sorted = [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const w of sorted) {
    for (const e of w.entries) {
      if (NO_RECORD.has(e.movementId) || e.sets.length === 0) continue;
      const value = Math.max(...e.sets.map((s) => s.value));
      if (value <= 0) continue;
      const setup = setupOf(e);
      const key = keyOf(e.variantId, setup.band, setup.load);
      const prev = best.get(key);
      // À égalité, on garde la date de la 1re fois.
      if (!prev || value > prev.value) {
        best.set(key, { movementId: e.movementId, variantId: e.variantId, ...setup, value, at: w.startedAt });
      }
    }
  }
  return [...best.values()];
}

/** Record battu pendant une séance. */
export interface NewRecord {
  movementId: string;
  variantId: string;
  band?: string;
  load?: number;
  value: number;
  previous: number;
}

/**
 * Records battus par la séance `record`, comparés aux séances d'AVANT elle (l'historique peut la
 * contenir déjà : elle est écartée par sa date de début).
 */
export function newRecords(record: WorkoutRecord, history: readonly WorkoutRecord[]): NewRecord[] {
  const before = variantRecords(history.filter((w) => w.startedAt < record.startedAt));
  const out: NewRecord[] = [];
  for (const e of record.entries) {
    if (NO_RECORD.has(e.movementId) || e.sets.length === 0) continue;
    const setup = setupOf(e);
    const prev = before.find((r) => sameSetup(r, e.variantId, setup));
    const value = Math.max(...e.sets.map((s) => s.value));
    // Une variante faite deux fois dans la séance : une seule carte, avec la meilleure série.
    const already = out.find((r) => sameSetup(r, e.variantId, setup));
    if (!prev || value <= prev.value) continue;
    if (already) already.value = Math.max(already.value, value);
    else out.push({ movementId: e.movementId, variantId: e.variantId, ...setup, value, previous: prev.value });
  }
  return out;
}

/** Plus longue course : durée et jour (les miennes et les imposées « course »). */
export function longestRun(activities: readonly Activity[]): { minutes: number; day: string } | null {
  let best: { minutes: number; day: string } | null = null;
  for (const a of activities) {
    const isRun = a.type === 'run' || (a.type === 'imposed' && a.kind === 'run');
    if (isRun && 'minutes' in a && (!best || a.minutes > best.minutes)) best = { minutes: a.minutes, day: a.day };
  }
  return best;
}
