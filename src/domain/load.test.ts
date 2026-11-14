/**
 * Tests de la charge du sac (exercices lestés). Données fictives.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import { findVariant } from './availability';
import { clampLoad, formatLoad, MAX_LOAD_KG, plannedLoad } from './load';

const use = { start: 4, step: 2 };

describe('charge du sac', () => {
  it('jamais faite (ou notée avant le 14/11) : la charge de départ', () => {
    expect(plannedLoad(use)).toEqual({ load: 4, reset: false });
    expect(plannedLoad(use, { validated: true })).toEqual({ load: 4, reset: false });
  });

  it('haut de la fourchette tenu : +2 kg et l’objectif repart du bas ; sinon, la même charge', () => {
    expect(plannedLoad(use, { load: 6, validated: true })).toEqual({ load: 8, reset: true });
    expect(plannedLoad(use, { load: 6, validated: false })).toEqual({ load: 6, reset: false });
  });

  it('plafond : pas au-delà de ce qu’un sac à dos supporte', () => {
    expect(plannedLoad(use, { load: MAX_LOAD_KG, validated: true })).toEqual({ load: MAX_LOAD_KG, reset: false });
    expect(clampLoad(-2)).toBe(0);
  });

  it('libellé à la française', () => {
    expect(formatLoad(6)).toBe('6 kg');
    expect(formatLoad(4.5)).toBe('4,5 kg');
  });

  it('les pompes déclinées lestées, dernier niveau des pompes, suivent la charge', () => {
    const pushH = CATALOG.find((m) => m.id === 'push-h')!;
    const last = pushH.levels.at(-1)!.variants[0]!;
    expect(last.id).toBe('pushup-decline-weighted');
    expect(findVariant(pushH, last.id)?.variant.load).toEqual({ start: 4, step: 2 });
  });
});
