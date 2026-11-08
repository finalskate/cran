/**
 * Garde-fous sur la DONNÉE des idées de protéines : chaque code doit exister dans la table
 * Ciqual embarquée, et chaque idée doit vraiment être riche en protéines.
 */
import { describe, expect, it } from 'vitest';
import ciqual from './ciqual.json';
import { PROTEIN_IDEAS } from './proteinIdeas';

const rows = new Map((ciqual.foods as unknown as [number, string, string, number, number][]).map((r) => [r[0], r]));

describe('idées de protéines', () => {
  it('ne référencent que des aliments présents dans Ciqual, sans doublon', () => {
    for (const idea of PROTEIN_IDEAS) expect(rows.has(idea.code), String(idea.code)).toBe(true);
    expect(new Set(PROTEIN_IDEAS.map((i) => i.code)).size).toBe(PROTEIN_IDEAS.length);
  });

  it('apportent au moins 7 g de protéines par portion et 5 g pour 100 kcal', () => {
    for (const idea of PROTEIN_IDEAS) {
      const [, name, , kcal, protein] = rows.get(idea.code)!;
      const perPortion = (protein * idea.portion.amount) / 100;
      expect(perPortion, name).toBeGreaterThanOrEqual(7);
      expect((protein / kcal) * 100, name).toBeGreaterThanOrEqual(5);
    }
  });
});
