/**
 * Phase en cours (J5b, SPEC §1.3) : lecture, choix, changement programmé, et application des
 * choix par défaut de la phase (lieu proposé, objectif de la semaine, cardio proposé).
 *
 * Un changement programmé (« Vacances à partir du … ») s'applique tout seul au premier lancement
 * de ce jour-là (ou au retour sur l'appli) : l'accueil l'annonce une fois, avec ce qui a changé.
 * Un changement fait « à partir d'aujourd'hui » s'applique tout de suite, sans annonce (la
 * feuille vient de le montrer).
 */
import { PHASES } from '../data/phases';
import { track } from '../data/usage';
import { dayKey } from '../domain/days';
import {
  cancelScheduled,
  choosePhase,
  phaseAt,
  phaseKey,
  scheduledPhase,
  type PhaseEntry,
  type PhaseId,
  type PhaseInfo,
} from '../domain/phase';
import { recordGoalChange } from '../domain/regularity';
import type { Location } from '../domain/types';
import type { WeekGoal } from '../domain/week';
import { locations, prefs, setPref } from './state';

/** Phase du jour (null : aucune choisie). */
export function currentPhase(now = new Date()): PhaseEntry | null {
  return phaseAt(prefs.value.phases, dayKey(now));
}

export function currentPhaseInfo(now = new Date()): PhaseInfo | null {
  const p = currentPhase(now);
  return p ? PHASES[p.id] : null;
}

/** Changement programmé, s'il y en a un. */
export function nextPhase(now = new Date()): PhaseEntry | null {
  return scheduledPhase(prefs.value.phases, dayKey(now));
}

/** Objectif de la semaine d'une phase : celui réglé pendant la phase, sinon celui de la donnée. */
export function phaseGoal(id: PhaseId): WeekGoal {
  return prefs.value.phaseGoals[id] ?? PHASES[id].weekGoal;
}

/** Ce que la phase change, en clair (feuille de choix et annonce de l'accueil). */
export function phaseChanges(id: PhaseId, locs: readonly Location[] = locations.value): string[] {
  const info = PHASES[id];
  const place = locs.find((l) => l.id === info.locationId);
  const goal = phaseGoal(id);
  return [
    place ? `Lieu proposé : ${place.name}` : 'Lieu : ton dernier lieu',
    `Objectif : ${goal.strength} renfo${goal.strength > 1 ? 's' : ''} + ${goal.cardio} cardio par semaine`,
    info.indoorOnly
      ? 'Cardio : vélo d’appartement (la course seulement sur un tapis de course)'
      : info.cardio === 'bike'
        ? 'Cardio : vélo'
        : 'Cardio : course',
    ...(info.cantine ? ['Assiette : mode cantine, sans compter ; l’ajustement de la cible attend ton retour'] : []),
  ];
}

/** Applique les choix par défaut de la phase en cours, une seule fois par phase. */
export async function syncPhase(now = new Date()): Promise<void> {
  const current = currentPhase(now);
  if (!current || prefs.value.phaseApplied === phaseKey(current)) return;
  await applyDefaults(current);
}

async function applyDefaults(entry: PhaseEntry): Promise<void> {
  const info = PHASES[entry.id];
  if (locations.value.some((l) => l.id === info.locationId)) await setPref('lastLocationId', info.locationId);
  // L'objectif de la phase vaut à partir de son 1er jour (même si l'appli s'ouvre plus tard).
  await saveWeekGoal(phaseGoal(entry.id), entry.since);
  await setPref('lastCardio', info.cardio);
  await setPref('phaseApplied', phaseKey(entry));
  track('phase', { action: 'applied', phase: entry.id });
}

/** Choisit une phase, à partir d'aujourd'hui ou d'un jour à venir (`since`). */
export async function selectPhase(id: PhaseId, since: string, now = new Date()): Promise<void> {
  const today = dayKey(now);
  const start = since < today ? today : since;
  await setPref('phases', choosePhase(prefs.value.phases, id, start, today));
  track('phase', { action: start === today ? 'now' : 'scheduled', phase: id });
  if (start === today) {
    const entry = { id, since: start };
    await applyDefaults(entry);
    // Vu dans la feuille : pas d'annonce sur l'accueil.
    await setPref('phaseSeen', phaseKey(entry));
  }
}

export async function cancelPhaseChange(now = new Date()): Promise<void> {
  await setPref('phases', cancelScheduled(prefs.value.phases, dayKey(now)));
  track('phase', { action: 'cancel' });
}

/** L'annonce de l'accueil : la phase vient de commencer toute seule (changement programmé). */
export function phaseNotice(now = new Date()): PhaseEntry | null {
  const current = currentPhase(now);
  if (!current) return null;
  const key = phaseKey(current);
  return prefs.value.phaseApplied === key && prefs.value.phaseSeen !== key ? current : null;
}

export async function dismissPhaseNotice(entry: PhaseEntry): Promise<void> {
  await setPref('phaseSeen', phaseKey(entry));
}

/**
 * Enregistre l'objectif de la semaine et garde la trace du changement (J6a) : les semaines
 * passées restent jugées sur l'objectif qu'elles avaient.
 */
async function saveWeekGoal(goal: WeekGoal, day: string): Promise<void> {
  const before = prefs.value.weekGoal;
  if (before.strength === goal.strength && before.cardio === goal.cardio) return;
  await setPref('weekGoals', recordGoalChange(prefs.value.weekGoals, day, goal, before));
  await setPref('weekGoal', goal);
}

/** Objectif de la semaine changé dans Réglages : gardé aussi pour la phase en cours. */
export async function setWeekGoal(goal: WeekGoal, now = new Date()): Promise<void> {
  await saveWeekGoal(goal, dayKey(now));
  const current = currentPhase(now);
  if (current) await setPref('phaseGoals', { ...prefs.value.phaseGoals, [current.id]: goal });
  track('week-goal', { ...goal, phase: current?.id });
}
