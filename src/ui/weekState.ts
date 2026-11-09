/**
 * La semaine côté interface (J6a) : semaines réussies, mode pause, planning de la semaine et
 * rappel de sauvegarde. Relie les fonctions pures (src/domain/regularity.ts, weekPlan.ts,
 * reminders.ts) aux données de l'appli. Tout est recalculé à la lecture : les signaux lus
 * (préférences, séances, activités, genou) suffisent à rafraîchir les écrans.
 */
import { CATALOG } from '../data/catalog';
import { track } from '../data/usage';
import { mondayOf } from '../domain/calendar';
import { addDays, dayKey, dayToDate } from '../domain/days';
import { cardioChoice } from '../domain/phase';
import { activePause, endPause, regularity, regularityStart, startPause, weekResults, type PauseEntry } from '../domain/regularity';
import { legsLoadedOn, MORNING_WORSE_SCORE, morningWorseToday } from '../domain/recovery';
import { EXPORT_SNOOZE_DAYS, exportReminder } from '../domain/reminders';
import { currentKnee, runPlan } from '../domain/running';
import { activityGoal } from '../domain/week';
import { planWeek, runSlots, type DayChoice, type DayDone, type WeekPlan } from '../domain/weekPlan';
import { exportData, type ExportOutcome } from './device/exportFile';
import { currentPhaseInfo } from './phaseState';
import { locations, prefs, setPref } from './state';
import { activities, kneeLogs, renfoDays, workouts } from './training';

// ─── Pause ───

/** Pause en cours aujourd'hui, ou null. */
export function currentPause(now = new Date()): PauseEntry | null {
  return activePause(prefs.value.pauses, dayKey(now));
}

/** Met en pause dès aujourd'hui, jusqu'au jour `until` inclus (absent : jusqu'à nouvel ordre). */
export async function pauseFrom(until: string | undefined, now = new Date()): Promise<void> {
  await setPref('pauses', startPause(prefs.value.pauses, dayKey(now), until));
  track('pause', { action: 'start', dated: until !== undefined });
}

export async function resume(now = new Date()): Promise<void> {
  await setPref('pauses', endPause(prefs.value.pauses, dayKey(now)));
  track('pause', { action: 'resume' });
}

// ─── Semaines réussies ───

/** Verdict des semaines depuis le départ et résumé « N réussies · X sur les dernières ». */
export function weekRegularity(now = new Date()) {
  const results = weekResults({
    start: regularityStart(prefs.value.phases, renfoDays.value, activities.value),
    today: dayKey(now),
    renfoDays: renfoDays.value,
    activities: activities.value,
    goals: prefs.value.weekGoals,
    currentGoal: prefs.value.weekGoal,
    pauses: prefs.value.pauses,
  });
  return { results, summary: regularity(results) };
}

// ─── Planning ───

/** Ce qui s'est passé chaque jour, de la veille du lundi `monday` jusqu'à aujourd'hui. */
function doneDays(monday: string, today: string): Record<string, DayDone> {
  const out: Record<string, DayDone> = {};
  for (let d = addDays(monday, -1); d <= today && d <= addDays(monday, 6); d = addDays(d, 1)) {
    const acts = activities.value.filter((a) => a.day === d);
    out[d] = {
      strength: renfoDays.value.includes(d) || acts.some((a) => activityGoal(a) === 'strength'),
      cardio: acts.some((a) => activityGoal(a) === 'cardio'),
      run: acts.some((a) => a.type === 'run' || (a.type === 'imposed' && a.kind === 'run')),
      legs: legsLoadedOn(d, workouts.value, activities.value, CATALOG),
    };
  }
  return out;
}

/** Planning de la semaine qui commence au lundi `monday` (la semaine en cours, ou la suivante). */
export function weekPlanFor(monday: string, now = new Date()): WeekPlan {
  const today = dayKey(now);
  const location = locations.value.find((l) => l.id === prefs.value.lastLocationId);
  const cardio = cardioChoice(currentPhaseInfo(now), location?.equipment ?? []).primary;
  const run = runPlan(activities.value, kneeLogs.value, now);
  // Semaine suivante : la longue et la sortie jeu sont de nouveau à faire.
  const slots = runSlots(monday > today ? { ...run, longDone: false, playDone: false } : run);
  // Genou « plus mal » ce matin : compte comme un 3 (comme pour la séance).
  const knee = Math.max(currentKnee(kneeLogs.value, now), morningWorseToday(kneeLogs.value, now) ? MORNING_WORSE_SCORE : 0);
  return planWeek({
    monday,
    today,
    hour: now.getHours(),
    done: doneDays(monday, today),
    goal: prefs.value.weekGoal,
    cardio,
    runSlots: slots,
    knee,
    choices: prefs.value.planChoices,
    focus: prefs.value.focus,
  });
}

/** Planning de la semaine en cours. */
export function currentWeekPlan(now = new Date()): WeekPlan {
  return weekPlanFor(mondayOf(dayKey(now)), now);
}

/** Le dimanche, le planning de la semaine suivante (pour « Demain : … »). */
export function nextWeekPlan(now = new Date()): WeekPlan | undefined {
  const today = dayKey(now);
  return dayToDate(today).getDay() === 0 ? weekPlanFor(addDays(today, 1), now) : undefined;
}

/** Règle un jour du planning (`null` : laisser l'appli choisir). Les choix des semaines passées sont oubliés. */
export async function setDayChoice(day: string, choice: DayChoice | null, now = new Date()): Promise<void> {
  const today = dayKey(now);
  const monday = mondayOf(today);
  const kept = Object.fromEntries(Object.entries(prefs.value.planChoices).filter(([d]) => d >= monday && d !== day));
  await setPref('planChoices', choice ? { ...kept, [day]: choice } : kept);
  track('plan-day', { choice: choice ?? 'auto', weekday: (dayToDate(day).getDay() + 6) % 7, ahead: Math.round((dayToDate(day).getTime() - dayToDate(today).getTime()) / 86_400_000) });
}

/**
 * Course prévue demain au planning (pas en vélo) : la séance d'aujourd'hui garde les jambes
 * fraîches (moteur, `runTomorrow`). Rien en pause.
 */
export function runPlannedTomorrow(now = new Date()): boolean {
  if (currentPause(now)) return false;
  const tomorrow = addDays(dayKey(now), 1);
  const days = [...currentWeekPlan(now).days, ...(nextWeekPlan(now)?.days ?? [])];
  const d = days.find((x) => x.day === tomorrow);
  return d?.status === 'planned' && d.kind === 'cardio' && d.slot?.kind !== 'bike';
}

// ─── Sauvegarde ───

/** Rappel de sauvegarde dû aujourd'hui (jours depuis le dernier export), ou null. */
export function exportDue(now = new Date()) {
  const p = prefs.value;
  return exportReminder(p.lastExportAt || undefined, p.installedAt || undefined, p.exportSnoozedUntil || undefined, dayKey(now));
}

export async function snoozeExport(now = new Date()): Promise<void> {
  await setPref('exportSnoozedUntil', addDays(dayKey(now), EXPORT_SNOOZE_DAYS));
  track('export-reminder', { action: 'later' });
}

/** Exporte (partage ou téléchargement) et note la date si l'export n'a pas été annulé. */
export async function runExport(includePhotos: boolean, from: 'settings' | 'reminder' | 'import'): Promise<ExportOutcome> {
  const outcome = await exportData({ includePhotos });
  track('export', { outcome, photos: includePhotos, from });
  if (outcome !== 'cancelled') await setPref('lastExportAt', new Date().toISOString());
  return outcome;
}
