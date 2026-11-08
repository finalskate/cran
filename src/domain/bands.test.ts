import { describe, expect, it } from 'vitest';
import { bandAt, bandLabels, harderBand, isHardestBand, parseBands, plannedBand, startRank } from './bands';
import type { BandUse } from './types';

const KG = bandLabels([30, 10, 20]);
const PULL: BandUse = { start: 1 };
const ASSIST: BandUse = { start: 2, assist: true };

describe('élastiques : saisie et libellés', () => {
  it('trie les forces et les écrit en kg', () => {
    expect(KG).toEqual(['10 kg', '20 kg', '30 kg']);
    expect(bandLabels([12.5])).toEqual(['12,5 kg']);
  });

  it('sans saisie : léger, moyen, fort', () => {
    expect(bandLabels([])).toEqual(['léger', 'moyen', 'fort']);
  });

  it('lit une saisie libre, sans doublon ni valeur absurde', () => {
    expect(parseBands('10, 20, 30')).toEqual([10, 20, 30]);
    expect(parseBands('30 kg 10kg 20 kg 10')).toEqual([10, 20, 30]);
    expect(parseBands('12,5 ; 0 ; 500')).toEqual([12.5]);
    expect(parseBands('')).toEqual([]);
  });
});

describe('élastiques : progression', () => {
  it('départ ramené au nombre d’élastiques', () => {
    expect(startRank({ start: 1 }, 3)).toBe(1);
    expect(startRank({ start: 2 }, 5)).toBe(4);
    expect(startRank({ start: 1 }, 1)).toBe(0);
    expect(startRank({ start: 1 }, 2)).toBe(1); // à mi-chemin : le plus fort des deux
  });

  it('première fois : l’élastique de départ, objectif inchangé', () => {
    expect(plannedBand(PULL, KG)).toEqual({ band: { rank: 1, of: 3, label: '20 kg' }, reset: false });
  });

  it('séance au haut de la fourchette : élastique suivant, objectif au bas', () => {
    const last = { band: bandAt(1, KG), validated: true };
    expect(plannedBand(PULL, KG, last)).toEqual({ band: bandAt(2, KG), reset: true });
  });

  it('pas encore au haut : même élastique', () => {
    expect(plannedBand(PULL, KG, { band: bandAt(1, KG), validated: false })).toEqual({ band: bandAt(1, KG), reset: false });
  });

  it('déjà le plus fort : on reste (le déblocage du niveau prend le relais)', () => {
    expect(plannedBand(PULL, KG, { band: bandAt(2, KG), validated: true })).toEqual({ band: bandAt(2, KG), reset: false });
  });

  it('élastique qui aide : progresser, c’est prendre plus léger', () => {
    expect(harderBand(bandAt(2, KG), ASSIST, KG)).toEqual(bandAt(1, KG));
    expect(harderBand(bandAt(0, KG), ASSIST, KG)).toBeNull();
    expect(isHardestBand(bandAt(0, KG), ASSIST)).toBe(true);
    expect(isHardestBand(bandAt(2, KG), ASSIST)).toBe(false);
  });

  it('isométrie : pas de changement d’élastique', () => {
    expect(harderBand(bandAt(0, KG), { start: 0, fixed: true }, KG)).toBeNull();
    expect(isHardestBand(bandAt(0, KG), { start: 0, fixed: true })).toBe(true);
  });

  it('liste modifiée depuis : l’élastique est retrouvé par son libellé', () => {
    const before = { rank: 1, of: 3, label: '20 kg' };
    const now = bandLabels([5, 10, 20, 30]);
    expect(plannedBand(PULL, now, { band: before, validated: false }).band).toEqual({ rank: 2, of: 4, label: '20 kg' });
  });

  it('enregistrement sans élastique : ne bloque pas le déblocage', () => {
    expect(isHardestBand(undefined, PULL)).toBe(true);
  });
});
