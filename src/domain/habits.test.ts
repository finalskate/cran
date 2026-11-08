import { describe, expect, it } from 'vitest';
import {
  isCompletePlan,
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
