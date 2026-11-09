/**
 * Phases de vie (J5b, SPEC §1.3) : Vacances, Travail, Éloigné, Base équipée. La phase se
 * change À LA MAIN (un réglage), jamais d'après des dates codées : on peut seulement programmer
 * soi-même le prochain changement (« Vacances à partir du … »), saisi dans l'appli.
 *
 * Une phase ne verrouille rien : elle change des choix par défaut, que l'on peut toujours
 * modifier (lieu proposé, objectif de la semaine, cardio proposé, mode cantine).
 *
 * Fonctions pures, testées dans phase.test.ts. Les libellés et valeurs par défaut de chaque
 * phase sont une DONNÉE (src/data/phases.ts).
 *
 * Historique : la liste des phases est gardée (`PhaseEntry[]`, triée par date de début) ; une
 * entrée datée dans le futur est un changement programmé. L'historique sert à savoir quels jours
 * étaient « en éloignement » (l'ajustement de la cible les écarte, cf. adaptivePause).
 */
import type { EquipmentTag } from './types';
import type { Treadmill } from './running';
import type { WeekGoal } from './week';

export type PhaseId = 'holidays' | 'work' | 'away' | 'equipped';

export const PHASE_IDS: readonly PhaseId[] = ['holidays', 'work', 'away', 'equipped'];

/** Une phase et son premier jour (« 2026-11-14 »). */
export interface PhaseEntry {
  id: PhaseId;
  since: string;
}

/** Ce qu'une phase change par défaut (valeurs dans src/data/phases.ts). */
export interface PhaseInfo {
  label: string;
  /** Une phrase : le contexte de la phase. */
  description: string;
  /** Lieu proposé en entrant dans la phase (s'il existe encore). */
  locationId: string;
  /** Objectif de la semaine de départ (modifiable dans Réglages, gardé par phase). */
  weekGoal: WeekGoal;
  /** Cardio proposé en premier sur l'accueil. */
  cardio: 'run' | 'bike';
  /** Pas d'accès au dehors : la course n'est possible que sur un tapis de course. */
  indoorOnly: boolean;
  /** Mode cantine : on ne compte plus, l'assiette type et le bilan du soir guident. */
  cantine: boolean;
}

/** Clé d'une entrée : sert à savoir si ses réglages ont été appliqués et son annonce vue. */
export function phaseKey(entry: PhaseEntry): string {
  return `${entry.since}:${entry.id}`;
}

/** Phase en cours le jour `day` (null : aucune phase choisie, l'appli se comporte comme avant). */
export function phaseAt(entries: readonly PhaseEntry[], day: string): PhaseEntry | null {
  let current: PhaseEntry | null = null;
  for (const e of entries) if (e.since <= day) current = e;
  return current;
}

/** Changement programmé après aujourd'hui (le premier), ou null. */
export function scheduledPhase(entries: readonly PhaseEntry[], today: string): PhaseEntry | null {
  return entries.find((e) => e.since > today) ?? null;
}

/**
 * Nouvelle liste après le choix de la phase `id` à partir de `since` :
 *  - à partir d'aujourd'hui (ou d'un jour passé) : l'entrée remplace celle du même jour, et un
 *    changement programmé plus tard reste en place ;
 *  - à partir d'un jour futur : c'est LE changement programmé (il remplace le précédent).
 */
export function choosePhase(entries: readonly PhaseEntry[], id: PhaseId, since: string, today: string): PhaseEntry[] {
  const kept = entries.filter((e) => e.since !== since && (since <= today || e.since <= today));
  return [...kept, { id, since }].sort((a, b) => a.since.localeCompare(b.since));
}

/** Retire le changement programmé. */
export function cancelScheduled(entries: readonly PhaseEntry[], today: string): PhaseEntry[] {
  return entries.filter((e) => e.since <= today);
}

/**
 * Ajustement de la cible et éloignement (mode cantine) : les estimations de cantine fausseraient
 * la dépense mesurée. Pendant une phase « cantine », pas d'ajustement (`paused`) ; après, le
 * prochain ajustement attend 14 jours de vraies notes : la période ne commence pas avant
 * `resumedAt`, le 1er jour après la dernière phase cantine.
 */
export function adaptivePause(
  entries: readonly PhaseEntry[],
  today: string,
  info: Readonly<Record<PhaseId, Pick<PhaseInfo, 'cantine'>>>,
): { paused: boolean; resumedAt?: string } {
  const current = phaseAt(entries, today);
  if (current && info[current.id].cantine) return { paused: true };
  let resumedAt: string | undefined;
  entries.forEach((e, i) => {
    const next = entries[i + 1];
    if (info[e.id].cantine && next && next.since <= today) resumedAt = next.since;
  });
  return resumedAt ? { paused: false, resumedAt } : { paused: false };
}

/** Le jour `day` tombe-t-il dans une phase cantine ? */
export function cantineOn(
  entries: readonly PhaseEntry[],
  day: string,
  info: Readonly<Record<PhaseId, Pick<PhaseInfo, 'cantine'>>>,
): boolean {
  const p = phaseAt(entries, day);
  return !!p && info[p.id].cantine;
}

/** Le cardio de l'accueil : celui proposé en premier, l'autre s'il est possible sur ce lieu. */
export interface CardioChoice {
  primary: 'run' | 'bike';
  alternative: 'run' | 'bike' | null;
  /** Tapis de course sur le lieu : rappel périostite dans la suggestion de course. */
  treadmill?: Treadmill;
}

/**
 * Sans phase : la course, et le vélo en second si le lieu en a un. En phase « dedans » (Éloigné) :
 * le vélo d'abord ; la course seulement s'il y a un tapis de course.
 */
export function cardioChoice(phase: Pick<PhaseInfo, 'cardio' | 'indoorOnly'> | null, equipment: readonly EquipmentTag[]): CardioChoice {
  const treadmill = equipment.includes('treadmill');
  const bike = equipment.includes('bike');
  if (phase?.indoorOnly) {
    const primary = phase.cardio === 'run' && treadmill ? 'run' : 'bike';
    const alternative = primary === 'bike' ? (treadmill ? 'run' : null) : 'bike';
    return { primary, alternative, ...(treadmill ? { treadmill: 'only' as const } : {}) };
  }
  const primary = phase?.cardio === 'bike' && bike ? 'bike' : 'run';
  const alternative = primary === 'run' ? (bike ? 'bike' : null) : 'run';
  return { primary, alternative, ...(treadmill ? { treadmill: 'maybe' as const } : {}) };
}
