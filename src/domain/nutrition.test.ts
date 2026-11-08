/**
 * Tests de l'alimentation (phase A). Profils fictifs : aucune donnée réelle (dépôt public).
 */
import { describe, expect, it } from 'vitest';
import { HAND_MEASURES } from '../data/portions';
import { addDays, dayKey, daysBetween } from './days';
import {
  amountPortion,
  basalMetabolism,
  calibrationDay,
  computeTargets,
  proteinPerKg,
  describeHands,
  entryNutrients,
  foodDay,
  formatCount,
  handEstimate,
  latestWeight,
  matchScore,
  mealForTime,
  portionNutrients,
  rankFoods,
  searchFoods,
  searchWords,
  stepCount,
  sumEntries,
  weighInsLastWeek,
  type Food,
  type Profile,
} from './nutrition';

const PROFILE: Profile = { sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 82, activity: 'active' };

function food(over: Partial<Food> = {}): Food {
  return {
    id: 'ean:1',
    source: 'off',
    name: 'Biscuits',
    per100: { kcal: 480, protein: 6 },
    unit: 'g',
    portions: [{ label: '1 paquet (150 g)', amount: 150 }],
    uses: 0,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...over,
  };
}

describe('jours locaux', () => {
  it('découpe en jour local, pas en UTC', () => {
    expect(dayKey(new Date(2026, 10, 14, 0, 30))).toBe('2026-11-14');
  });

  it('décale et compte les jours, changement d’heure compris', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    // Passage à l'heure d'hiver le 25/10/2026 : la journée fait 25 h, elle compte pour une.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('cible calorique', () => {
  it('applique Mifflin-St Jeor', () => {
    // 10 × 82 + 6,25 × 180 − 5 × 30 + 5 = 1 800
    expect(basalMetabolism(PROFILE, 82, 2026)).toBe(1800);
    expect(basalMetabolism({ ...PROFILE, sex: 'female' }, 82, 2026)).toBe(1634);
  });

  it('retire le déficit de la dépense estimée et arrondit à la dizaine', () => {
    const t = computeTargets(PROFILE, 82, 2026);
    expect(t.expenditure).toBe(2700); // 1 800 × 1,5
    expect(t.kcal).toBe(2250); // 2 700 − 450
    expect(t.floored).toBe(false);
  });

  it('ne descend jamais sous le plancher', () => {
    const small: Profile = { sex: 'male', birthYear: 1960, heightCm: 160, weightKg: 55, activity: 'sedentary' };
    const t = computeTargets(small, 55, 2026);
    expect(t.kcal).toBe(1700);
    expect(t.floored).toBe(true);
  });

  it('calcule les protéines sur le poids utilisé (1,7 g/kg)', () => {
    expect(computeTargets(PROFILE, 82, 2026).protein).toBe(139);
    expect(computeTargets(PROFILE, 78, 2026).protein).toBe(133);
  });

  it('vise 1,8 g/kg avec la priorité haut du corps (J3b)', () => {
    expect(proteinPerKg()).toBe(1.7);
    expect(proteinPerKg('upper')).toBe(1.8);
    const t = computeTargets(PROFILE, 80, 2026, undefined, proteinPerKg('upper'));
    expect(t.protein).toBe(144);
    expect(t.proteinPerKg).toBe(1.8);
  });
});

describe('calibration', () => {
  it('compte les jours de 1 à 14, puis s’arrête', () => {
    expect(calibrationDay('2026-11-14', '2026-11-14')).toBe(1);
    expect(calibrationDay('2026-11-14', '2026-11-27')).toBe(14);
    expect(calibrationDay('2026-11-14', '2026-11-28')).toBeNull();
    expect(calibrationDay('2026-11-14', '2026-11-13')).toBeNull();
  });
});

describe('journée alimentaire et repas', () => {
  it('rattache une collation de 1 h du matin à la veille', () => {
    expect(foodDay(new Date(2026, 10, 15, 1, 0))).toBe('2026-11-14');
    expect(foodDay(new Date(2026, 10, 15, 4, 0))).toBe('2026-11-15');
  });

  it('propose le repas selon l’heure', () => {
    expect(mealForTime(new Date(2026, 10, 14, 7, 30))).toBe('morning');
    expect(mealForTime(new Date(2026, 10, 14, 12, 15))).toBe('noon');
    expect(mealForTime(new Date(2026, 10, 14, 16, 45))).toBe('snack');
    expect(mealForTime(new Date(2026, 10, 14, 20, 0))).toBe('evening');
    expect(mealForTime(new Date(2026, 10, 15, 0, 30))).toBe('evening');
  });
});

describe('portions et entrées', () => {
  it('calcule une portion en grammes à partir des valeurs pour 100 g', () => {
    expect(portionNutrients(food(), { label: '½ paquet', amount: 75 })).toEqual({ kcal: 360, protein: 4.5 });
    expect(portionNutrients(food(), amountPortion(food(), 40))).toEqual({ kcal: 192, protein: 2.4 });
  });

  it('prend les valeurs directes d’une portion estimée', () => {
    const plat = food({ per100: undefined, portions: [{ label: '1 assiette', kcal: 650, protein: 30 }] });
    expect(portionNutrients(plat, plat.portions[0]!)).toEqual({ kcal: 650, protein: 30 });
  });

  it('multiplie par le nombre de portions et additionne la journée', () => {
    const a = { unit: { kcal: 213.4, protein: 2.6 }, count: 1.5 };
    const b = { unit: { kcal: 100, protein: 10 }, count: 2 };
    expect(entryNutrients(a)).toEqual({ kcal: 320, protein: 4 });
    expect(sumEntries([a, b])).toEqual({ kcal: 520, protein: 24 });
    expect(sumEntries([])).toEqual({ kcal: 0, protein: 0 });
  });

  it('avance par demi-portions sans descendre sous ½', () => {
    expect(stepCount(1, 1)).toBe(1.5);
    expect(stepCount(1, -1)).toBe(0.5);
    expect(stepCount(0.5, -1)).toBe(0.5);
    expect(formatCount(0.5)).toBe('½');
    expect(formatCount(2.5)).toBe('2 ½');
    expect(formatCount(3)).toBe('3');
  });
});

describe('estimation à la main', () => {
  it('additionne les repères de l’assiette', () => {
    const counts = { protein: 2, starch: 1, veg: 1, fat: 1 };
    expect(handEstimate(counts, HAND_MEASURES)).toEqual({ kcal: 630, protein: 59 });
    expect(describeHands(counts, HAND_MEASURES)).toBe('2 paumes · 1 poing · 1 main en coupe · 1 pouce');
  });

  it('ignore les repères à zéro', () => {
    expect(describeHands({ protein: 0, starch: 0.5 }, HAND_MEASURES)).toBe('½ poing');
  });
});

describe('récents et recherche', () => {
  const foods = [
    food({ id: 'a', name: 'Pâtes complètes', lastUsedAt: '2026-11-05T12:00:00Z' }),
    food({ id: 'b', name: 'Chips nature', brand: 'Marque', lastUsedAt: '2026-11-06T16:00:00Z' }),
    food({ id: 'c', name: 'Skyr', favorite: true, lastUsedAt: '2026-11-01T08:00:00Z' }),
  ];

  it('met les favoris d’abord, puis les plus récents', () => {
    expect(rankFoods(foods).map((f) => f.id)).toEqual(['c', 'b', 'a']);
  });

  it('cherche sans tenir compte des accents ni des majuscules, nom ou marque', () => {
    expect(searchFoods(foods, 'pates').map((f) => f.id)).toEqual(['a']);
    expect(searchFoods(foods, 'MARQUE chips').map((f) => f.id)).toEqual(['b']);
    expect(searchFoods(foods, '  ')).toHaveLength(3);
  });

  it('découpe la recherche en mots normalisés, sans s final', () => {
    expect(searchWords('Œufs brouillés, frites')).toEqual(['oeuf', 'brouille', 'frite']);
    expect(searchWords('riz')).toEqual(['riz']);
  });

  it('classe un mot trouvé en début de mot avant un morceau de mot', () => {
    const words = searchWords('riz');
    expect(matchScore('riz blanc, cuit', words)).toBeGreaterThan(matchScore('chorizo', words));
    expect(matchScore('chorizo', words)).toBeGreaterThan(0);
    expect(matchScore('pates', words)).toBe(0);
  });
});

describe('pesée', () => {
  const weights = [
    { day: '2026-11-10', at: '', kg: 80.4 },
    { day: '2026-11-14', at: '', kg: 80.1 },
    { day: '2026-11-12', at: '', kg: 80.6 },
  ];

  it('trouve la pesée la plus récente', () => {
    expect(latestWeight(weights)?.day).toBe('2026-11-14');
    expect(latestWeight([])).toBeUndefined();
  });

  it('compte les pesées des 7 derniers jours', () => {
    expect(weighInsLastWeek(weights, '2026-11-14')).toBe(3);
    expect(weighInsLastWeek(weights, '2026-11-17')).toBe(2);
  });
});
