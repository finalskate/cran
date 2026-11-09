/**
 * Badges (J6b, SPEC §4.10) : ce qui est gagné, quand, et où on en est pour les autres. Fonctions
 * pures, testées dans badges.test.ts. La liste est une donnée (src/data/badges.ts).
 *
 *  - Un badge gagné reste gagné : l'appli garde la date de chaque badge (réglage `badges`) et ne
 *    l'efface jamais, même si la donnée qui l'a fait gagner change (pesée supprimée, tendance qui
 *    remonte). `earnedBadges` ne fait qu'AJOUTER.
 *  - La date d'un badge est le jour où le seuil a été franchi (pas le jour où on l'a vu).
 */
import { addDays } from './days';
import type { TrendPoint } from './body';
import type { LevelHistoryEntry } from './progression';
import type { Activity } from './recovery';
import type { WeekResult } from './regularity';
import { pushupTests } from './pushupTest';
import { activityGoal } from './week';

export type BadgeKind = 'level' | 'weeks' | 'sessions' | 'pushups' | 'run' | 'weight';

export interface BadgeDef {
  id: string;
  kind: BadgeKind;
  /** Seuil : nombre (niveaux, semaines, séances), répétitions, minutes, ou kg (étape de poids). */
  threshold: number;
  label: string;
  /** Texte du médaillon (court). */
  medal: string;
}

export interface BadgeInput {
  /** Jours des séances de renfo terminées (une entrée par séance). */
  renfoDays: readonly string[];
  activities: readonly Activity[];
  levelHistory: readonly LevelHistoryEntry[];
  weeks: readonly WeekResult[];
  trend: readonly TrendPoint[];
  today: string;
  /** Jour local d'une date ISO (le fuseau de l'appareil). */
  dayOf: (iso: string) => string;
}

/** Badges des étapes de poids, d'après les étapes du Profil (la plus proche d'abord). */
export function weightBadges(goals: readonly number[]): BadgeDef[] {
  return [...goals]
    .sort((a, b) => b - a)
    .map((kg) => {
      const text = kg.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
      return { id: `weight-${kg}`, kind: 'weight' as const, threshold: kg, label: `Étape ${text} kg`, medal: text };
    });
}

/** Où on en est d'un badge : la valeur actuelle face au seuil, et le jour où il a été franchi. */
export interface BadgeState {
  def: BadgeDef;
  /** Jour du franchissement (absent : pas encore). */
  reachedOn?: string;
  /** Valeur actuelle (pour « 4/12 »), dans l'unité du seuil. */
  value: number;
}

/** Jour où la n-ième occurrence d'une liste triée de jours a eu lieu. */
const nth = (days: readonly string[], n: number) => (days.length >= n ? [...days].sort()[n - 1] : undefined);

export function badgeStates(defs: readonly BadgeDef[], input: BadgeInput): BadgeState[] {
  // Niveaux gagnés : un changement vers un niveau plus haut que le précédent du même mouvement.
  const ups: string[] = [];
  const last = new Map<string, number>();
  for (const h of [...input.levelHistory].sort((a, b) => a.at.localeCompare(b.at))) {
    const prev = last.get(h.movementId);
    if (prev !== undefined && h.level > prev) ups.push(input.dayOf(h.at));
    last.set(h.movementId, h.level);
  }
  // Semaines réussies : on date au dimanche (ou aujourd'hui pour la semaine en cours).
  const weeks = input.weeks
    .filter((w) => w.verdict === 'success')
    .map((w) => {
      const sunday = addDays(w.monday, 6);
      return sunday < input.today ? sunday : input.today;
    });
  // Séances : renfo, et activités qui comptent dans l'objectif (pas le vélotaf ni le test).
  const sessions = [...input.renfoDays, ...input.activities.filter((a) => activityGoal(a) !== null).map((a) => a.day)];
  const tests = pushupTests(input.activities);
  const runs = input.activities.filter((a) => a.type === 'run' || (a.type === 'imposed' && a.kind === 'run'));
  const minutesOf = (a: Activity) => ('minutes' in a ? a.minutes : 0);

  return defs.map((def): BadgeState => {
    switch (def.kind) {
      case 'level':
        return withDay(def, ups.length, nth(ups, def.threshold));
      case 'weeks':
        return withDay(def, weeks.length, nth(weeks, def.threshold));
      case 'sessions':
        return withDay(def, sessions.length, nth(sessions, def.threshold));
      case 'pushups': {
        const best = Math.max(0, ...tests.map((t) => t.reps));
        return withDay(def, best, tests.find((t) => t.reps >= def.threshold)?.day);
      }
      case 'run': {
        const sorted = [...runs].sort((a, b) => a.day.localeCompare(b.day));
        const best = Math.max(0, ...runs.map(minutesOf));
        return withDay(def, best, sorted.find((a) => minutesOf(a) >= def.threshold)?.day);
      }
      case 'weight': {
        const hit = input.trend.find((p) => p.trend <= def.threshold);
        const lowest = input.trend.length ? Math.min(...input.trend.map((p) => p.trend)) : 0;
        return withDay(def, lowest, hit?.day);
      }
    }
  });
}

function withDay(def: BadgeDef, value: number, reachedOn: string | undefined): BadgeState {
  return reachedOn ? { def, value, reachedOn } : { def, value };
}

/**
 * Badges gagnés : ceux déjà gardés (jamais retirés) plus ceux qui viennent d'être franchis.
 * Renvoie la nouvelle liste et les nouveaux (à fêter, et à enregistrer).
 */
export function earnedBadges(
  states: readonly BadgeState[],
  kept: Readonly<Record<string, string>>,
): { all: Record<string, string>; fresh: string[] } {
  const all: Record<string, string> = { ...kept };
  const fresh: string[] = [];
  for (const s of states) {
    if (s.reachedOn && !all[s.def.id]) {
      all[s.def.id] = s.reachedOn;
      fresh.push(s.def.id);
    }
  }
  return { all, fresh };
}
