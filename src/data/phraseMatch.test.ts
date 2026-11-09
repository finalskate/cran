/**
 * Saisie en une phrase (J5b) : lecture des quantités et correspondance avec la vraie table Ciqual.
 * Données fictives pour « mes aliments ».
 */
import { describe, expect, it } from 'vitest';
import { choosePortion, looksLikePhrase, parsePiece, queryVariants, splitPhrase } from '../domain/phrase';
import { portionNutrients, type Food } from '../domain/nutrition';
import { buildIndex, type CiqualRow } from './ciqual';
import table from './ciqual.json';
import { matchPhrase } from './phraseMatch';
import { PHRASE_VOCABULARY as V } from './phraseWords';

const index = buildIndex(table.foods as unknown as CiqualRow[]);
const NOW = '2026-11-20T12:00:00.000Z';

describe('découpage de la phrase', () => {
  it('sépare sur +, virgule, point-virgule, « et », mais pas dans « 1,5 »', () => {
    expect(splitPhrase('wrap poulet + petite frite, coca zéro et une pomme', V)).toEqual(['wrap poulet', 'petite frite', 'coca zéro', 'une pomme']);
    expect(splitPhrase('1,5 kg de patates', V)).toEqual(['1,5 kg de patates']);
    expect(looksLikePhrase('wrap poulet + frite', V)).toBe(true);
    expect(looksLikePhrase('wrap poulet', V)).toBe(false);
    // Un « + » en fin de frappe n'est pas encore une phrase.
    expect(looksLikePhrase('wrap poulet +', V)).toBe(false);
  });
});

describe('lecture d’un aliment', () => {
  it('nombres, tailles, contenants, quantités', () => {
    expect(parsePiece('2 tranches de jambon', V)).toMatchObject({ query: 'jambon', count: 2, portionWord: 'tranche' });
    expect(parsePiece('une petite frite', V)).toMatchObject({ query: 'frite', count: 1, size: 'small' });
    expect(parsePiece('frite moyenne', V)).toMatchObject({ query: 'frite', size: 'medium' });
    expect(parsePiece('une demi baguette', V)).toMatchObject({ query: 'baguette', count: 0.5 });
    expect(parsePiece('½ pizza', V)).toMatchObject({ query: 'pizza', count: 0.5 });
    expect(parsePiece('150 g de riz', V)).toMatchObject({ query: 'riz', amount: 150, counted: false });
    expect(parsePiece('33 cl de coca', V)).toMatchObject({ query: 'cola sucre', amount: 330 });
    expect(parsePiece('yaourt x2', V)).toMatchObject({ query: 'yaourt', count: 2 });
    expect(parsePiece('deux oeufs', V)).toMatchObject({ query: 'oeufs', count: 2 });
    // « une pizza » reste une pizza (pas de « de » derrière), « pain au chocolat » garde son « au ».
    expect(parsePiece('une pizza', V)).toMatchObject({ query: 'pizza', count: 1 });
    expect(parsePiece('pain au chocolat', V).query).toBe('pain au chocolat');
    // Un mot seul n'est jamais retiré : « petit » reste cherché.
    expect(parsePiece('gros', V).query).toBe('gros');
  });

  it('recherches élargies : sans le dernier mot d’abord', () => {
    expect(queryVariants('wrap poulet bacon')).toEqual(['wrap poulet bacon', 'wrap poulet', 'wrap bacon', 'poulet bacon']);
    expect(queryVariants('riz')).toEqual(['riz']);
  });
});

describe('choix de la portion', () => {
  const food = (portions: Food['portions'], per100 = true): Food => ({
    id: 'perso:test',
    source: 'custom',
    name: 'Test',
    ...(per100 ? { per100: { kcal: 200, protein: 10 }, unit: 'g' as const } : {}),
    portions,
    uses: 0,
    createdAt: NOW,
  });
  const frites = food([
    { label: 'Petite frite (80 g)', amount: 80 },
    { label: 'Frite moyenne (115 g)', amount: 115 },
    { label: 'Grande frite (150 g)', amount: 150 },
  ]);

  it('taille, quantité, nombre qui ouvre une portion, demi', () => {
    expect(choosePortion(frites, parsePiece('grande frite', V), V)).toMatchObject({ portion: { amount: 150 }, count: 1 });
    expect(choosePortion(frites, parsePiece('frites', V), V)).toMatchObject({ portion: { amount: 80 }, count: 1 });
    expect(choosePortion(frites, parsePiece('200 g de frites', V), V)).toMatchObject({ portion: { amount: 200, label: '200 g' }, count: 1 });
    const nuggets = food([
      { label: '4 pièces (70 g)', amount: 70 },
      { label: '6 pièces (100 g)', amount: 100 },
    ]);
    expect(choosePortion(nuggets, parsePiece('6 nuggets', V), V)).toMatchObject({ portion: { amount: 100 }, count: 1 });
    const baguette = food([
      { label: '1 morceau (40 g)', amount: 40 },
      { label: '½ baguette (125 g)', amount: 125 },
    ]);
    expect(choosePortion(baguette, parsePiece('une demi baguette', V), V)).toMatchObject({ portion: { amount: 125 }, count: 1 });
    expect(choosePortion(baguette, parsePiece('3 morceaux de baguette', V), V)).toMatchObject({ portion: { amount: 40 }, count: 3 });
    // Un nombre trop fin est arrondi au ½.
    expect(choosePortion(baguette, parsePiece('un quart de baguette', V), V)?.count).toBe(0.5);
  });
});

describe('correspondance avec la table Ciqual', () => {
  const first = (text: string, mine: Food[] = []) => matchPhrase(text, mine, index, NOW).map((m) => m.candidates[0]?.name ?? '—');

  it('un menu de restauration rapide', () => {
    const [wrap, frite, cola] = matchPhrase('wrap poulet + petite frite + coca zéro', [], index, NOW);
    expect(wrap!.candidates[0]!.name).toBe('Wrap poulet crudités');
    expect(frite!.candidates[0]!.name).toMatch(/^Frites/);
    expect(choosePortion(frite!.candidates[0]!, frite!.piece, V)?.portion.label).toMatch(/Petite frite/);
    expect(cola!.candidates[0]!.name).toMatch(/^Cola, sans sucres ajoutés/);
  });

  it('la version cuite passe devant, sauf si la phrase dit « cru »', () => {
    const [riz, pates, steak] = first('riz + pâtes + steak');
    expect(riz).toMatch(/cuit/);
    expect(pates).toMatch(/cuites/);
    expect(steak).toMatch(/cuit/);
    expect(first('jambon cru')[0]).toMatch(/^Jambon cru/);
  });

  it('mes aliments passent devant la table', () => {
    const mine: Food = {
      id: 'perso:wrap',
      source: 'custom',
      name: 'Wrap poulet bacon (enseigne)',
      portions: [{ label: '1 wrap', kcal: 520, protein: 28 }],
      uses: 3,
      createdAt: NOW,
    };
    const [m] = matchPhrase('wrap poulet + frite', [mine], index, NOW);
    expect(m!.candidates[0]!.id).toBe('perso:wrap');
    expect(m!.candidates.length).toBeGreaterThan(1);
  });

  it('recherche élargie si la phrase est trop précise ; rien si rien ne correspond', () => {
    const [m] = matchPhrase('wrap poulet zorglub + pomme', [], index, NOW);
    expect(m!.loose).toBe(true);
    expect(m!.candidates[0]!.name).toBe('Wrap poulet crudités');
    const [none] = matchPhrase('zorglub + pomme', [], index, NOW);
    expect(none!.candidates).toEqual([]);
  });

  it('les valeurs suivent la portion choisie', () => {
    const [m] = matchPhrase('2 oeufs + pain', [], index, NOW);
    const egg = m!.candidates[0]!;
    const pick = choosePortion(egg, m!.piece, V)!;
    expect(egg.name).toMatch(/^Oeuf/);
    expect(portionNutrients(egg, pick.portion).kcal * pick.count).toBeGreaterThan(100);
  });
});
