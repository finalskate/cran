import { describe, expect, it } from 'vitest';
import {
  dayTrigger,
  isCompletePlan,
  planMoment,
  planMomentKey,
  plansFor,
  proteinFromEntries,
  reviewPrompt,
  weekSummary,
  type DailyReview,
  type IfThenPlan,
} from './habits';
import type { FoodEntry } from './nutrition';

/** Entrée fictive : seules comptent le repas, les protéines d'une portion et le nombre. */
const e = (meal: FoodEntry['meal'], protein: number, count = 1) => ({ meal, unit: { kcal: 100, protein }, count });

describe('protéines déduites des entrées', () => {
  it('rien de noté : il faut poser la question', () => {
    expect(proteinFromEntries([])).toBeNull();
  });

  it('chaque repas principal noté atteint 25 g : oui', () => {
    const c = proteinFromEntries([e('noon', 30), e('evening', 20), e('evening', 10)])!;
    expect(c.answer).toBe('yes');
    expect(c.meals.map((m) => [m.meal, m.protein, m.ok])).toEqual([
      ['noon', 30, true],
      ['evening', 30, true],
    ]);
  });

  it('la collation ne compte pas comme repas, mais compte dans le total', () => {
    const c = proteinFromEntries([e('noon', 30), e('snack', 15)])!;
    expect(c.meals).toHaveLength(1);
    expect(c.total).toBe(45);
    expect(c.answer).toBe('yes');
  });

  it('un repas sur deux : en partie ; aucun : non', () => {
    expect(proteinFromEntries([e('noon', 30), e('evening', 10)])!.answer).toBe('partly');
    expect(proteinFromEntries([e('noon', 10), e('evening', 10)])!.answer).toBe('no');
  });

  it('cible du jour atteinte : oui, quelle que soit la répartition', () => {
    expect(proteinFromEntries([e('noon', 10), e('evening', 20, 6)], 120)!.answer).toBe('yes');
  });
});

describe('moment du bilan', () => {
  const at = (h: number, day = 14) => new Date(2026, 10, day, h, 30);
  const none = new Set<string>();

  it('le soir dès 19 h : la journée en cours', () => {
    expect(reviewPrompt(at(18), none)).toBeNull();
    expect(reviewPrompt(at(19), none)).toEqual({ day: '2026-11-14', kind: 'today' });
  });

  it('après minuit, jusqu’à 4 h : encore la journée alimentaire de la veille', () => {
    expect(reviewPrompt(at(1, 15), none)).toEqual({ day: '2026-11-14', kind: 'today' });
  });

  it('le matin jusqu’à 11 h : rattrapage de la veille', () => {
    expect(reviewPrompt(at(7, 15), none)).toEqual({ day: '2026-11-14', kind: 'yesterday' });
    expect(reviewPrompt(at(11, 15), none)).toBeNull();
  });

  it('rien si le bilan est déjà fait', () => {
    expect(reviewPrompt(at(20), new Set(['2026-11-14']))).toBeNull();
    expect(reviewPrompt(at(8, 15), new Set(['2026-11-14']))).toBeNull();
  });
});

describe('plans si… alors…', () => {
  const plans: IfThenPlan[] = [
    { id: 'a', trigger: 'evening', when: 'le dîner est fini', then: 'cuisine fermée' },
    { id: 'b', trigger: 'boredom', when: 'je lis', then: 'tisane' },
    { id: 'c', trigger: 'evening', when: 'série le soir', then: 'pas de paquet sur le canapé' },
  ];

  it('retrouve les plans d’un déclencheur, dans l’ordre', () => {
    expect(plansFor(plans, 'evening').map((p) => p.id)).toEqual(['a', 'c']);
    expect(plansFor(plans, 'stress')).toEqual([]);
  });

  it('un plan doit avoir ses deux moitiés', () => {
    expect(isCompletePlan({ when: 'je lis', then: '  ' })).toBe(false);
    expect(isCompletePlan({ when: 'je lis', then: 'tisane' })).toBe(true);
  });
});

describe('résumé de la semaine', () => {
  const r = (day: string, over: Partial<DailyReview> = {}): DailyReview => ({
    day,
    at: `${day}T20:00:00Z`,
    protein: 'yes',
    proteinAuto: true,
    veggies: true,
    slip: 'none',
    ...over,
  });

  it('compte les 7 derniers jours seulement, déclencheurs du plus fréquent au moins fréquent', () => {
    const list = [
      r('2026-11-07', { slip: 'big', trigger: 'social' }), // hors fenêtre
      r('2026-11-08', { slip: 'small', trigger: 'stress' }),
      r('2026-11-10', { slip: 'small', trigger: 'evening', veggies: false }),
      r('2026-11-11'),
      r('2026-11-13', { slip: 'big', trigger: 'evening', protein: 'partly' }),
      r('2026-11-14'),
    ];
    const w = weekSummary(list, '2026-11-14');
    expect(w.reviews).toBe(5);
    expect(w.slips).toBe(3);
    expect(w.bigSlips).toBe(1);
    expect(w.veggieDays).toBe(4);
    expect(w.proteinDays).toBe(4);
    expect(w.triggers).toEqual([
      { trigger: 'evening', count: 2 },
      { trigger: 'stress', count: 1 },
    ]);
  });

  it('semaine vide', () => {
    expect(weekSummary([], '2026-11-14')).toMatchObject({ reviews: 0, slips: 0, triggers: [] });
  });
});

describe('le plan au bon moment', () => {
  const plan = (trigger: IfThenPlan['trigger'], when = 'situation', then = 'réponse'): IfThenPlan => ({ id: trigger, trigger, when, then });
  const all = [plan('boredom'), plan('stress'), plan('post-ride'), plan('evening'), plan('cooking')];
  const review = (day: string, trigger: DailyReview['trigger']): DailyReview => ({
    day,
    at: `${day}T21:00:00`,
    protein: 'yes',
    proteinAuto: true,
    veggies: true,
    slip: 'small',
    trigger,
  });
  const at = (iso: string) => new Date(iso);
  const none = new Set<string>();

  it('juste après un vélotaf : le plan « après le vélo », pendant 2 h', () => {
    const now = at('2026-11-12T17:30:00');
    const ride = at('2026-11-12T16:00:00').getTime();
    expect(planMoment(now, all, [], ride, none)).toMatchObject({ slot: 'post-ride', plans: [{ trigger: 'post-ride' }] });
    expect(planMoment(at('2026-11-12T18:30:00'), all, [], ride, none)?.slot).toBe('evening');
  });

  it('le soir dès 18 h : « en cuisinant » et « soirée » ensemble, jusqu’à 4 h', () => {
    const m = planMoment(at('2026-11-12T18:00:00'), all, [], null, none)!;
    expect(m.slot).toBe('evening');
    expect(m.plans.map((p) => p.trigger)).toEqual(['evening', 'cooking']);
    // À 1 h du matin, on est encore dans la soirée de la veille (journée alimentaire).
    expect(planMoment(at('2026-11-13T01:00:00'), all, [], null, none)?.key).toBe(planMomentKey('2026-11-12', 'evening'));
    expect(planMoment(at('2026-11-13T04:30:00'), all, [], null, none)).toBeNull();
  });

  it('un moment fermé ne revient pas le même jour', () => {
    const seen = new Set([planMomentKey('2026-11-12', 'evening')]);
    expect(planMoment(at('2026-11-12T21:00:00'), all, [], null, seen)).toBeNull();
    expect(planMoment(at('2026-11-13T21:00:00'), all, [], null, seen)?.slot).toBe('evening');
  });

  it('dans la journée : un déclencheur imprévisible, un par jour, à tour de rôle', () => {
    const a = planMoment(at('2026-11-12T10:00:00'), all, [], null, none)!;
    const b = planMoment(at('2026-11-13T10:00:00'), all, [], null, none)!;
    expect(a.slot).toBe('day');
    expect(a.plans).toHaveLength(1);
    expect(new Set([a.plans[0]!.trigger, b.plans[0]!.trigger])).toEqual(new Set(['boredom', 'stress']));
  });

  it('les déclencheurs cités dans les bilans récents passent en priorité', () => {
    const reviews = [review('2026-11-10', 'stress')];
    for (const day of ['2026-11-11', '2026-11-12', '2026-11-13']) expect(dayTrigger(all, reviews, day)).toBe('stress');
    // Au-delà de 28 jours, le bilan ne compte plus : retour à la rotation complète.
    const later = ['2026-12-20', '2026-12-21'].map((d) => dayTrigger(all, reviews, d));
    expect(new Set(later)).toEqual(new Set(['boredom', 'stress']));
  });

  it('sans plan complet pour le moment : rien', () => {
    expect(planMoment(at('2026-11-12T19:00:00'), [plan('boredom')], [], null, none)).toBeNull();
    expect(planMoment(at('2026-11-12T19:00:00'), [plan('evening', ' ', 'réponse')], [], null, none)).toBeNull();
    // Avant 5 h du matin passé 4 h : ni soir ni journée.
    expect(planMoment(at('2026-11-12T04:30:00'), all, [], null, none)).toBeNull();
  });
});
