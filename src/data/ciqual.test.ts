/**
 * Tests de la table Ciqual embarquée : recherche, portions types, et cohérence du fichier.
 */
import { describe, expect, it } from 'vitest';
import { portionNutrients } from '../domain/nutrition';
import { buildIndex, ciqualPortions, ciqualToFood, searchCiqual, type CiqualRow } from './ciqual';
import table from './ciqual.json';

const rows = table.foods as unknown as CiqualRow[];
const index = buildIndex(rows);
const names = (query: string, limit = 5) => searchCiqual(index, query, limit).map((r) => r[1]);

describe('fichier ciqual.json', () => {
  it('contient la table complète avec des valeurs plausibles', () => {
    expect(rows.length).toBeGreaterThan(3000);
    for (const [code, name, group, kcal, protein] of rows) {
      expect(Number.isInteger(code)).toBe(true);
      expect(name.length).toBeGreaterThan(0);
      expect(group).toMatch(/^\d{4}$/);
      expect(kcal).toBeGreaterThanOrEqual(0);
      expect(kcal).toBeLessThanOrEqual(900);
      expect(protein).toBeGreaterThanOrEqual(0);
      expect(protein).toBeLessThanOrEqual(100);
    }
  });

  it('n’a pas de code en double', () => {
    expect(new Set(rows.map((r) => r[0])).size).toBe(rows.length);
  });
});

describe('recherche', () => {
  it('trouve les produits de restauration rapide', () => {
    expect(names('wrap poulet')[0]).toBe('Wrap poulet crudités');
    expect(names('cheeseburger')).toContain('Cheeseburger, de restauration rapide');
  });

  it('ignore accents, majuscules et pluriels', () => {
    expect(names('FRITES', 30).some((n) => n.startsWith('Frites de pommes de terre'))).toBe(true);
    expect(names('pates cuites', 30).some((n) => n.startsWith('Pâtes'))).toBe(true);
    expect(names('oeufs', 30).some((n) => /^Œuf|^Oeuf/i.test(n))).toBe(true);
  });

  it('préfère un mot entier au début à un morceau de mot', () => {
    // « riz » : du riz avant du chorizo.
    expect(names('riz')[0]).toMatch(/^Riz/);
  });

  it('ne renvoie rien pour une recherche vide', () => {
    expect(searchCiqual(index, '  ')).toEqual([]);
  });
});

describe('portions types', () => {
  it('propose des portions de la catégorie, puis 100 g', () => {
    const wrap = ciqualPortions('Wrap poulet crudités', '0105');
    expect(wrap[0]).toEqual({ label: '1 wrap (180 g)', amount: 180 });
    expect(wrap.at(-1)).toEqual({ label: '100 g', amount: 100 });
  });

  it('applique les mots-clés avant le sous-groupe', () => {
    expect(ciqualPortions('Pizza (aliment moyen)', '0104')[0]!.label).toBe('1 part (120 g)');
    expect(ciqualPortions('Frites de pommes de terre, surgelées, cuites en friteuse', '0202')[1]!.label).toBe(
      'Frite moyenne (115 g)',
    );
  });

  it('mesure les boissons en ml', () => {
    const cola = ciqualPortions('Cola, sucré', '0602');
    expect(cola[0]!.label).toBe('1 verre (200 ml)');
    expect(cola.at(-1)!.label).toBe('100 ml');
  });

  it('se contente de 100 g pour une catégorie sans repère', () => {
    expect(ciqualPortions('Farine de blé', '0304')).toEqual([{ label: '100 g', amount: 100 }]);
  });

  it('chaque aliment de la table a au moins une portion calculable', () => {
    for (const row of rows) {
      const food = ciqualToFood(row, '');
      expect(food.portions.length).toBeGreaterThan(0);
      expect(portionNutrients(food, food.portions.at(-1)!).kcal).toBe(row[3]);
    }
  });
});

describe('conversion en aliment local', () => {
  it('donne un identifiant stable et les valeurs pour 100 g', () => {
    const food = ciqualToFood([25647, 'Wrap poulet crudités', '0105', 222, 9.6], '2026-11-14T12:00:00.000Z');
    expect(food).toMatchObject({ id: 'ciqual:25647', source: 'ciqual', per100: { kcal: 222, protein: 9.6 }, unit: 'g' });
    expect(portionNutrients(food, food.portions[0]!)).toEqual({ kcal: 399.6, protein: 17.3 });
  });
});
