/**
 * Tests de la suggestion de course et de vélo (SPEC §4.7). Données fictives.
 * Le critère du jalon J5 (« suggestion cohérente sur 3 semaines simulées ») est vérifié par
 * des simulations : on suit chaque suggestion, on note la course, et on regarde la suivante.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dayToDate } from './days';
import type { Activity, BikeActivity, ImposedActivity, KneeLog, RunActivity, RunKind } from './recovery';
import {
  bikeAdvice,
  bikePlan,
  currentKnee,
  LONG_RUN_MAX_MINUTES,
  LONG_SLOW_FROM_MINUTES,
  runAdvice,
  runPlan,
  runSlotLabel,
  type RunPlan,
} from './running';

/** Lundi 16 novembre 2026. */
const MONDAY = '2026-11-16';

/** Un jour à 18 h, heure locale (on court le soir). */
const at = (day: string, hour = 18) => {
  const d = dayToDate(day);
  d.setHours(hour);
  return d;
};

function run(day: string, minutes: number, kind: RunKind = 'easy', kneeAfter = 0): RunActivity {
  return { type: 'run', day, at: at(day).toISOString(), minutes, kind, feel: 'ok', kneeAfter };
}

const knee = (day: string, score: number, hour = 19): KneeLog => ({ date: at(day, hour).toISOString(), score, context: 'run' });

/**
 * Simulation : chaque jour de `days`, on lit la suggestion à 17 h, puis on court exactement ce
 * qui est proposé (genou après = `kneeAfter(jour)`). Renvoie les suggestions lues.
 */
function simulate(days: string[], kneeAfter: (day: string) => number = () => 0, start: Activity[] = [], logs: KneeLog[] = []) {
  const acts: Activity[] = [...start];
  const kneeLogs: KneeLog[] = [...logs];
  const seen: { day: string; plan: RunPlan }[] = [];
  for (const day of days) {
    const plan = runPlan(acts, kneeLogs, at(day, 17));
    seen.push({ day, plan });
    if (plan.next) {
      const k = kneeAfter(day);
      acts.push(run(day, plan.next.minutes, plan.next.kind, k));
      kneeLogs.push(knee(day, k));
    }
  }
  return seen;
}

/** Résumé lisible d'une suggestion : « 35 easy long », « 30 play », « 30 easy opt », « fait », « repos ». */
function short(p: RunPlan): string {
  if (!p.next) return p.status === 'rest' ? 'repos' : 'fait';
  return [p.next.minutes, p.next.kind, p.next.long && 'long', p.next.optional && 'opt', p.status === 'short' && 'court']
    .filter(Boolean)
    .join(' ');
}

/** Lundi, jeudi, samedi de la semaine n (0 = semaine du 16/11). */
const week = (n: number) => [0, 3, 5].map((d) => addDays(MONDAY, 7 * n + d));

describe('suggestion de course : 3 semaines simulées', () => {
  it('genou calme : 2 + 1 facultative, puis +5 sur la longue et une sortie jeu dès la semaine 3', () => {
    const seen = simulate([...week(0), ...week(1), ...week(2)]);
    expect(seen.map((s) => short(s.plan))).toEqual([
      // Semaine 1 : 30 min, 30 min, 3e facultative (genou resté calme).
      '30 easy',
      '30 easy',
      '30 easy opt',
      // Semaine 2 : pareil (pas encore de progression).
      '30 easy',
      '30 easy',
      '30 easy opt',
      // Semaine 3 : la longue passe à 35, une sortie jeu, une 3e facultative.
      '35 easy long',
      '30 play',
      '30 easy opt',
    ]);
    expect(seen.map((s) => s.plan.week)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    // Après 3 sorties, la semaine est faite.
    const after = runPlan(
      seen.map((s) => run(s.day, s.plan.next!.minutes, s.plan.next!.kind)),
      [],
      at(addDays(MONDAY, 20), 17),
    );
    expect(after.status).toBe('week-done');
  });

  it('genou à 3 après une sortie : pas de 3e sortie, pas de progression la semaine suivante', () => {
    // Genou à 3 après la 1re sortie de la semaine 2 (jeudi 26/11 : lendemain à 3 aussi, cf. ci-dessous).
    const sensitive = addDays(MONDAY, 7);
    const seen = simulate([...week(0), ...week(1), ...week(2)], (d) => (d === sensitive ? 3 : 0));
    expect(seen.map((s) => short(s.plan))).toEqual([
      '30 easy',
      '30 easy',
      '30 easy opt',
      '30 easy',
      '30 easy', // jeudi : le score de lundi (3) date de plus de 24 h
      'fait', // samedi : 2 sorties, genou pas resté calme → pas de 3e
      '30 easy', // semaine 3 : la longue reste à 30 (genou à 3 la semaine d'avant)
      '30 play',
      '30 easy opt',
    ]);
  });

  it('genou à 3 ou 4 dans les 24 h : sortie courte et facile ; à 5 : pas de course', () => {
    const acts = [run(MONDAY, 30)];
    expect(short(runPlan(acts, [knee(addDays(MONDAY, 2), 4, 8)], at(addDays(MONDAY, 2), 17)))).toBe('20 easy court');
    const rest = runPlan(acts, [knee(addDays(MONDAY, 2), 5, 8)], at(addDays(MONDAY, 2), 17));
    expect(rest.status).toBe('rest');
    expect(runAdvice(rest).title).toBe('Pas de course aujourd’hui');
  });

  it('pause de 12 jours : la longue garde sa durée ; pause de 21 jours : retour en semaine 1', () => {
    const seen = simulate([...week(0), ...week(1), ...week(2), ...week(3)]);
    const history = seen.map((s) => run(s.day, s.plan.next!.minutes, s.plan.next!.kind));
    // Semaine 4 : la longue était à 40.
    expect(seen[9]!.plan.next!.minutes).toBe(40);
    // Dernière sortie le samedi 12/12 (longue de 40 courue). Pause de 12 jours → jeudi 24/12 :
    // semaine 6, longue à 40 (ni le 45 prévu pour la semaine sautée, ni un +5).
    const afterPause = runPlan(history, [], at('2026-12-24', 17));
    expect(afterPause.week).toBe(6);
    expect(afterPause.next).toMatchObject({ minutes: 40, long: true });
    // Pause de 21 jours → samedi 02/01 : on repart sur 30 min, semaine 1.
    const reset = runPlan(history, [], at('2027-01-02', 17));
    expect(reset).toMatchObject({ week: 1, restart: true, started: false });
    expect(reset.next).toMatchObject({ minutes: 30, kind: 'easy' });
    expect(runAdvice(reset).lines.join(' ')).toContain('Reprise');
  });

  it('total de la semaine : une seule sortie courue → pas de +5 la semaine suivante (≈ 10 %)', () => {
    const acts = [run(MONDAY, 30), run(addDays(MONDAY, 3), 30), run(addDays(MONDAY, 7), 30)];
    expect(runPlan(acts, [], at(addDays(MONDAY, 14), 17)).next).toMatchObject({ minutes: 30 });
  });

  it('sans réponse « genou ce matin », la sortie longue s’arrête à 60 min', () => {
    const days = Array.from({ length: 12 }, (_, n) => week(n)).flat();
    const seen = simulate(days);
    const longs = seen.filter((s) => s.plan.next?.long).map((s) => s.plan.next!.minutes);
    expect(Math.max(...longs)).toBe(LONG_SLOW_FROM_MINUTES);
    expect(longs.slice(0, 6)).toEqual([35, 40, 45, 50, 55, 60]);
  });

  it('au-delà de 60 min : +5 toutes les 2 semaines si le genou du lendemain dit « pareil », plafond 90', () => {
    // Chaque lendemain de course, réponse « pareil » à 8 h.
    const pareil = (day: string): KneeLog => ({ date: at(addDays(day, 1), 8).toISOString(), score: 0, context: 'morning', worse: false });
    const days = Array.from({ length: 22 }, (_, n) => week(n)).flat();
    const seen = simulate(days, () => 0, [], days.map(pareil));
    const longs = seen.filter((s) => s.plan.next?.long).map((s) => s.plan.next!.minutes);
    expect(longs).toEqual([35, 40, 45, 50, 55, 60, 60, 65, 65, 70, 70, 75, 75, 80, 80, 85, 85, 90, 90, 90]);
    expect(Math.max(...longs)).toBe(LONG_RUN_MAX_MINUTES);
  });

  it('au-delà de 60 min : « plus mal » le lendemain de la longue bloque le +5', () => {
    const days = Array.from({ length: 10 }, (_, n) => week(n)).flat();
    const logs = days.map((day): KneeLog => {
      // Le lendemain de la longue de la semaine 9 (2e semaine à 60), « plus mal ».
      const worse = day === week(8)[0];
      return { date: at(addDays(day, 1), 8).toISOString(), score: worse ? 3 : 0, context: 'morning', worse };
    });
    const longs = simulate(days, () => 0, [], logs).filter((s) => s.plan.next?.long).map((s) => s.plan.next!.minutes);
    // Semaines 8 et 9 à 60 : sans le « plus mal », la semaine 10 passerait à 65.
    expect(longs.slice(5)).toEqual([60, 60, 60]);
  });

  it('suggestion au-delà de 60 min : rappel du genou du lendemain ; tapis : rappel périostite', () => {
    const plan: RunPlan = {
      week: 9, restart: false, started: true, status: 'go', done: 0, target: 2, longMinutes: 65,
      kneeOkThisWeek: true, knee: 0, ranToday: false, noDownhillUntil: null,
      next: { minutes: 65, kind: 'easy', long: true, optional: false },
    };
    expect(runAdvice(plan).lines.join(' ')).toContain('genou ce matin');
    expect(runAdvice(plan).lines.join(' ')).not.toContain('périostite');
    const onTreadmill = runAdvice(plan, 'only').lines.join(' ');
    expect(onTreadmill).toContain('Sur tapis');
    expect(onTreadmill).not.toContain('Terrain plat');
    expect(runAdvice(plan, 'maybe').lines.join(' ')).toContain('Si tu cours sur tapis');
  });

  it('une course imposée compte dans la semaine mais ne démarre pas le plan', () => {
    const imposed: ImposedActivity = { type: 'imposed', day: MONDAY, at: at(MONDAY).toISOString(), minutes: 40, kind: 'run', legs: true, intensity: 'medium' };
    const p = runPlan([imposed], [], at(addDays(MONDAY, 2), 17));
    expect(p).toMatchObject({ done: 1, started: false, week: 1 });
    expect(runSlotLabel(p)).toBe('Sortie 2 sur 2 · semaine 1');
  });

  it('rappel des descentes : 6 semaines à partir de la 1re course', () => {
    expect(runPlan([run(MONDAY, 30)], [], at(MONDAY, 20)).noDownhillUntil).toBe(addDays(MONDAY, 41));
    const regular = [0, 14, 28].map((d) => run(addDays(MONDAY, d), 30));
    expect(runPlan(regular, [], at(addDays(MONDAY, 42), 17)).noDownhillUntil).toBeNull();
    // Après une pause de 21 jours, le plan repart : le rappel aussi.
    expect(runPlan([run(MONDAY, 30), run(addDays(MONDAY, 40), 30)], [], at(addDays(MONDAY, 42), 17)).noDownhillUntil).toBe(addDays(MONDAY, 81));
  });

  it('textes : jeu, longue, premières semaines', () => {
    const first = runPlan([], [], at(MONDAY, 17));
    expect(runAdvice(first)).toMatchObject({ title: '30 min en aisance' });
    expect(runAdvice(first).lines.join(' ')).toContain('Jusqu’à 35 min');
    expect(runSlotLabel(first)).toBe('Sortie 1 sur 2 · semaine 1');
    const seen = simulate([...week(0), ...week(1), ...week(2)]);
    expect(runAdvice(seen[6]!.plan).lines.join(' ')).toContain('sortie longue');
    expect(runAdvice(seen[7]!.plan).title).toBe('30 min · sortie jeu');
    expect(runSlotLabel(seen[8]!.plan)).toBe('3e sortie · facultative');
  });

  it('genou du moment : le plus haut score des 24 dernières heures', () => {
    const now = at(MONDAY, 17);
    expect(currentKnee([knee(addDays(MONDAY, -2), 6), knee(MONDAY, 2, 8), knee(MONDAY, 1, 9)], now)).toBe(2);
    expect(currentKnee([], now)).toBe(0);
  });
});

describe('suggestion de vélo', () => {
  const bike = (day: string, kind: BikeActivity['kind'] = 'easy'): BikeActivity => ({
    type: 'bike',
    day,
    at: at(day).toISOString(),
    minutes: 30,
    kind,
    feel: 'ok',
  });

  it('aisance d’abord, puis un fractionné, un seul par semaine', () => {
    expect(bikePlan([], [], at(MONDAY)).next).toEqual({ minutes: 30, kind: 'easy' });
    expect(bikePlan([bike(MONDAY)], [], at(addDays(MONDAY, 1))).next.kind).toBe('intervals');
    expect(bikePlan([bike(MONDAY), bike(addDays(MONDAY, 1), 'intervals')], [], at(addDays(MONDAY, 3))).next.kind).toBe('easy');
    // Nouvelle semaine : on recommence.
    expect(bikePlan([bike(MONDAY), bike(addDays(MONDAY, 1), 'intervals')], [], at(addDays(MONDAY, 7))).done).toBe(0);
  });

  it('genou sensible : aisance seulement, résistance légère', () => {
    const p = bikePlan([bike(MONDAY)], [knee(addDays(MONDAY, 1), 3, 8)], at(addDays(MONDAY, 1)));
    expect(p.next.kind).toBe('easy');
    expect(bikeAdvice(p).lines.join(' ')).toContain('sans forcer');
  });
});
