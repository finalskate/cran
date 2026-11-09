/**
 * Tests du planning de la semaine. Données fictives. La semaine du 16/11/2026 commence un lundi.
 */
import { describe, expect, it } from 'vitest';
import { addDays } from './days';
import type { RunPlan } from './running';
import { LATE_HOUR, nextPlanned, planWeek, runSlots, type DayDone, type WeekPlan, type WeekPlanInput } from './weekPlan';

const MONDAY = '2026-11-16';
const SATURDAY = addDays(MONDAY, 5);
const SUNDAY = addDays(MONDAY, 6);

const input = (over: Partial<WeekPlanInput> = {}): WeekPlanInput => ({
  monday: MONDAY,
  today: MONDAY,
  hour: 8,
  done: {},
  goal: { strength: 3, cardio: 2 },
  cardio: 'run',
  runSlots: [
    { kind: 'long', minutes: 40 },
    { kind: 'base', minutes: 30 },
    { kind: 'base', minutes: 30 },
  ],
  knee: 0,
  choices: {},
  focus: 'balanced',
  ...over,
});

const R: DayDone = { strength: true, cardio: false, run: false, legs: true };
const RUN: DayDone = { strength: false, cardio: true, run: true, legs: true };

/** Vérifie les règles dures sur la semaine (jours vécus + prévus), hors choix de l'utilisateur. */
function checkRules(plan: WeekPlan, done: Record<string, DayDone> = {}) {
  const cell = (day: string) => {
    const p = plan.days.find((d) => d.day === day);
    if (p?.status === 'planned') {
      return {
        strength: p.kind === 'strength',
        run: p.kind === 'cardio' && p.slot?.kind !== 'bike',
        legs: (p.kind === 'strength' && !p.noLegs) || (p.kind === 'cardio' && p.slot?.kind !== 'bike'),
        active: p.kind === 'strength' || p.kind === 'cardio',
      };
    }
    const d = done[day];
    return { strength: !!d?.strength, run: !!d?.run, legs: !!d?.legs, active: !!d && (d.strength || d.cardio) };
  };
  let rest = false;
  let streak = cell(addDays(plan.monday, -1)).active ? 1 : 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(plan.monday, i);
    const c = cell(day);
    const prev = cell(addDays(day, -1));
    if (!c.active) rest = true;
    streak = c.active ? streak + 1 : 0;
    const planned = plan.days[i]!.status === 'planned';
    if (planned && c.active) expect(streak, `plus de 3 jours actifs d'affilée le ${day}`).toBeLessThanOrEqual(3);
    if (planned && c.strength) expect(prev.strength, `deux renfos de suite le ${day}`).toBe(false);
    if (planned && c.run) expect(prev.legs || prev.run, `course après des jambes le ${day}`).toBe(false);
  }
  expect(rest, 'au moins un jour de repos').toBe(true);
}

const kinds = (plan: WeekPlan) => plan.days.map((d) => (d.status === 'planned' ? d.kind : d.status));

describe('planning de la semaine', () => {
  it('lundi matin : tout l’objectif, la longue le week-end', () => {
    const plan = planWeek(input());
    expect(plan.reachable).toBe(true);
    expect(plan.planned).toEqual({ strength: 3, cardio: 2 });
    checkRules(plan);
    const long = plan.days.find((d) => d.slot?.kind === 'long');
    expect([SATURDAY, SUNDAY]).toContain(long?.day);
    // Rien le lendemain de la longue quand c'est possible.
    const after = plan.days.find((d) => d.day === addDays(long!.day, 1));
    if (after) expect(after.kind).toBe('rest');
  });

  it('départ en milieu de semaine : pas cinq jours d’affilée pour tenir l’objectif', () => {
    const plan = planWeek(input({ today: addDays(MONDAY, 2) }));
    expect(plan.reachable).toBe(false);
    expect(plan.planned.strength + plan.planned.cardio).toBe(4);
    checkRules(plan);
  });

  it('respecte les règles quel que soit le jour et ce qui est déjà fait', () => {
    const histories: Record<string, DayDone>[] = [
      {},
      { [addDays(MONDAY, -1)]: RUN },
      { [MONDAY]: R },
      { [MONDAY]: RUN, [addDays(MONDAY, 1)]: R },
    ];
    for (const done of histories) {
      for (let i = 0; i < 7; i++) {
        for (const hour of [8, 19, 22]) {
          const plan = planWeek(input({ today: addDays(MONDAY, i), hour, done }));
          checkRules(plan, done);
        }
      }
    }
  });

  it('ne place jamais de course le lendemain d’une journée qui a chargé les jambes', () => {
    const plan = planWeek(input({ today: addDays(MONDAY, 1), done: { [MONDAY]: R } }));
    expect(plan.days[1]!.kind).not.toBe('cardio');
  });

  it('un renfo la veille d’une course se fait sans jambes', () => {
    // Samedi matin, rien de fait : 1 renfo + 1 course ne tiennent qu'en renfo samedi, course dimanche… ou l'inverse.
    const plan = planWeek(input({ today: SATURDAY, goal: { strength: 1, cardio: 1 }, choices: { [SATURDAY]: 'strength', [SUNDAY]: 'cardio' } }));
    expect(plan.days[5]).toMatchObject({ kind: 'strength', noLegs: true, chosen: true });
    expect(plan.days[6]).toMatchObject({ kind: 'cardio', chosen: true });
  });

  it('objectif hors de portée : une version réduite, sans doubler une journée', () => {
    // Vendredi soir tard, rien de fait : il reste samedi et dimanche.
    const plan = planWeek(input({ today: addDays(MONDAY, 4), hour: LATE_HOUR + 1 }));
    expect(plan.reachable).toBe(false);
    expect(plan.days[4]!.status).toBe('past');
    expect(plan.planned.strength + plan.planned.cardio).toBe(2);
    expect(plan.planned.strength).toBeLessThanOrEqual(1);
  });

  it('genou ≥ 3 : aujourd’hui repos ou mobilité', () => {
    const plan = planWeek(input({ knee: 4 }));
    expect(plan.days[0]).toMatchObject({ status: 'planned', kind: 'rest', kneeRest: true });
    expect(plan.planned).toEqual({ strength: 3, cardio: 2 });
  });

  it('un jour « pas dispo » est respecté et le reste se réarrange', () => {
    const plan = planWeek(input({ choices: { [addDays(MONDAY, 2)]: 'off', [addDays(MONDAY, 3)]: 'strength' } }));
    expect(plan.days[2]).toMatchObject({ kind: 'off', chosen: true });
    expect(plan.days[3]).toMatchObject({ kind: 'strength', chosen: true });
    expect(plan.planned).toEqual({ strength: 3, cardio: 2 });
    checkRules(plan);
  });

  it('un jour sauté se redistribue sans rattrapage en double', () => {
    // Mardi : renfo fait lundi, rien mardi (on est le soir tard).
    const plan = planWeek(input({ today: addDays(MONDAY, 1), hour: 23, done: { [MONDAY]: R } }));
    expect(plan.remaining).toEqual({ strength: 2, cardio: 2 });
    expect(plan.reachable).toBe(true);
    expect(plan.days.filter((d) => d.status === 'planned' && d.kind !== 'rest').length).toBe(4);
    checkRules(plan, { [MONDAY]: R });
  });

  it('objectif atteint : le reste de la semaine est libre', () => {
    const done = { [MONDAY]: R, [addDays(MONDAY, 1)]: RUN, [addDays(MONDAY, 2)]: R, [addDays(MONDAY, 3)]: RUN, [addDays(MONDAY, 4)]: R };
    const plan = planWeek(input({ today: addDays(MONDAY, 4), hour: 20, done }));
    expect(plan.remaining).toEqual({ strength: 0, cardio: 0 });
    expect(kinds(plan).slice(5)).toEqual(['rest', 'rest']);
  });

  it('en vélo : pas de longue, et le vélo ne charge pas les jambes', () => {
    const plan = planWeek(input({ cardio: 'bike', goal: { strength: 2, cardio: 2 }, today: addDays(MONDAY, 1), done: { [MONDAY]: R } }));
    expect(plan.days.filter((d) => d.kind === 'cardio').every((d) => d.slot?.kind === 'bike')).toBe(true);
    expect(plan.days.some((d) => d.noLegs)).toBe(false);
  });

  it('accueil : aujourd’hui, puis demain le soir', () => {
    const plan = planWeek(input());
    expect(nextPlanned(plan, MONDAY, 9)?.when).toBe('today');
    const restDay = plan.days.find((d) => d.kind === 'rest')!.day;
    expect(nextPlanned(plan, restDay, 9)).toMatchObject({ when: 'today', day: { kind: 'rest' } });
    expect(nextPlanned(plan, restDay, 19)?.when).toBe('tomorrow');
  });
});

describe('sorties à planifier', () => {
  const plan = (over: Partial<RunPlan>): RunPlan =>
    ({ week: 3, longMinutes: 40, longDone: false, playDone: false, ...over }) as RunPlan;

  it('la longue, puis la sortie jeu, puis la base', () => {
    expect(runSlots(plan({})).slice(0, 3).map((s) => s.kind)).toEqual(['long', 'play', 'base']);
    expect(runSlots(plan({ longDone: true })).slice(0, 2).map((s) => s.kind)).toEqual(['play', 'base']);
    // Semaines 1–2 : pas de longue (30 min), pas de jeu.
    expect(runSlots(plan({ week: 1, longMinutes: 30 })).slice(0, 2).map((s) => s.kind)).toEqual(['base', 'base']);
  });
});
