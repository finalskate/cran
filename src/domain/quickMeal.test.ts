import { describe, expect, it } from 'vitest';
import { QUICK_TABLE } from '../data/quickMeals';
import type { FoodEntry } from './nutrition';
import {
  currentQuickMeal,
  habitualMeals,
  mealStatus,
  QUICK_PROTEIN_MIN,
  quickEstimate,
  replacedByQuick,
  shortFoodLabel,
  snackCount,
  snackEstimate,
  veggiesNoted,
} from './quickMeal';

let nextId = 1;
const entry = (day: string, meal: FoodEntry['meal'], label: string, kcal: number, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: nextId++,
  day,
  at: `${day}T12:00:00Z`,
  meal,
  label,
  portion: '1 portion',
  count: 1,
  unit: { kcal, protein: 20 },
  method: 'list',
  ...extra,
});

describe('quickEstimate', () => {
  it('un repas fait maison normal : le repère, avec une fourchette de ± 25 %', () => {
    expect(quickEstimate(QUICK_TABLE, 'home', 'normal', 'noon')).toEqual({ kcal: 650, protein: 30, low: 490, high: 810 });
  });

  it('copieux et léger font varier, le petit-déj pèse moins', () => {
    expect(quickEstimate(QUICK_TABLE, 'home', 'big', 'evening').kcal).toBe(910);
    expect(quickEstimate(QUICK_TABLE, 'home', 'light', 'evening').kcal).toBe(450);
    expect(quickEstimate(QUICK_TABLE, 'home', 'normal', 'morning').kcal).toBe(390);
  });

  it('protéines cochées : au moins une portion ; décochées : la moitié', () => {
    expect(quickEstimate(QUICK_TABLE, 'onthego', 'normal', 'noon', true).protein).toBe(QUICK_PROTEIN_MIN);
    expect(quickEstimate(QUICK_TABLE, 'home', 'normal', 'noon', true).protein).toBe(39);
    expect(quickEstimate(QUICK_TABLE, 'home', 'normal', 'noon', false).protein).toBe(15);
  });

  it('grignotage : selon la taille', () => {
    expect(snackEstimate(QUICK_TABLE, 'medium')).toMatchObject({ kcal: 300, low: 230, high: 380 });
  });
});

describe('état des repas du jour', () => {
  const day = '2026-11-21';

  it('rien, sauté, noté vite, noté en détail', () => {
    expect(mealStatus([], 'noon')).toEqual({ state: 'empty' });
    expect(mealStatus([entry(day, 'noon', 'Sauté', 0, { method: 'quick', quick: { type: 'skip' } })], 'noon')).toEqual({ state: 'skipped' });
    const quick = entry(day, 'noon', 'Fait maison', 650, { method: 'quick', quick: { type: 'meal', kind: 'home', size: 'big', veggies: true } });
    expect(mealStatus([quick], 'noon')).toEqual({ state: 'quick', size: 'big', veggies: true });
    expect(mealStatus([quick, entry(day, 'noon', 'Pâtes', 400)], 'noon')).toEqual({ state: 'detailed', kcal: 400 });
  });

  it('un grignotage noté à midi ne compte pas comme le repas', () => {
    const snack = entry(day, 'noon', 'Grignotage', 150, { method: 'quick', quick: { type: 'snack', size: 'small' } });
    expect(mealStatus([snack], 'noon')).toEqual({ state: 'empty' });
    expect(snackCount([snack, snack])).toBe(2);
  });

  it('une nouvelle saisie rapide remplace la précédente du même repas, jamais le détail ni les grignotages', () => {
    const old = entry(day, 'evening', 'Sauté', 0, { method: 'quick', quick: { type: 'skip' } });
    const detail = entry(day, 'evening', 'Soupe', 200);
    const snack = entry(day, 'evening', 'Grignotage', 150, { method: 'quick', quick: { type: 'snack', size: 'small' } });
    expect(replacedByQuick([old, detail, snack], 'evening')).toEqual([old]);
  });

  it('légumes cochés à un repas : le bilan du soir ne redemande pas', () => {
    expect(veggiesNoted([entry(day, 'noon', 'x', 1, { method: 'quick', quick: { type: 'meal', kind: 'home', size: 'normal', veggies: true } })])).toBe(true);
    expect(veggiesNoted([entry(day, 'noon', 'x', 1)])).toBe(false);
  });

  it('repas du moment selon l’heure (rien l’après-midi)', () => {
    expect([7, 12, 16, 20, 1].map(currentQuickMeal)).toEqual(['morning', 'noon', null, 'evening', 'evening']);
  });
});

describe('habitualMeals', () => {
  const today = '2026-11-21';

  it('les repas notés au moins deux fois au même repas, du plus fréquent au moins fréquent', () => {
    const list = [
      entry('2026-11-10', 'noon', 'Gnocchi a poêler Lustucru - 1K', 400),
      entry('2026-11-10', 'noon', 'Thon entier au nature', 150),
      entry('2026-11-13', 'noon', 'Thon entier au nature', 150),
      entry('2026-11-13', 'noon', 'Gnocchi a poêler Lustucru - 1K', 420),
      entry('2026-11-16', 'noon', 'Gnocchi a poêler Lustucru - 1K', 400),
      entry('2026-11-16', 'noon', 'Thon entier au nature', 150),
      entry('2026-11-12', 'noon', 'Sandwich jambon cru', 500),
      entry('2026-11-15', 'noon', 'Sandwich jambon cru', 500),
      entry('2026-11-14', 'noon', 'Frites', 600), // une seule fois : pas habituel
      entry('2026-11-11', 'evening', 'Sandwich jambon cru', 500), // autre repas
    ];
    const habits = habitualMeals(list, 'noon', today);
    expect(habits.map((h) => [h.label, h.times])).toEqual([
      ['Gnocchi a poêler… + Thon entier au…', 3],
      ['Sandwich jambon cru', 2],
    ]);
    // Recopié depuis la fois la plus récente (16/11), sans identifiant ni jour.
    expect(habits[0]!.total).toEqual({ kcal: 550, protein: 40 });
    expect(habits[0]!.entries[0]).not.toHaveProperty('id');
    expect(habits[0]!.entries[0]).not.toHaveProperty('day');
  });

  it('ignore les saisies rapides et ce qui sort des 4 semaines', () => {
    const list = [
      entry('2026-10-01', 'noon', 'Vieux plat', 500),
      entry('2026-10-02', 'noon', 'Vieux plat', 500),
      entry('2026-11-19', 'noon', 'Fait maison', 650, { method: 'quick' }),
      entry('2026-11-20', 'noon', 'Fait maison', 650, { method: 'quick' }),
    ];
    expect(habitualMeals(list, 'noon', today)).toEqual([]);
  });

  it('raccourcit les libellés', () => {
    expect(shortFoodLabel('Gnocchi a poêler Lustucru - 1K')).toBe('Gnocchi a poêler…');
    expect(shortFoodLabel('Lentilles - Daucy')).toBe('Lentilles');
    expect(shortFoodLabel('Herta le bon poulet sans nitrite')).toBe('Herta le bon…');
    expect(shortFoodLabel('Soupe maison')).toBe('Soupe maison');
  });
});
