import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from './route';

describe('parseRoute', () => {
  it("renvoie l'accueil pour un hash vide ou racine", () => {
    expect(parseRoute('')).toEqual({ name: 'today' });
    expect(parseRoute('#')).toEqual({ name: 'today' });
    expect(parseRoute('#/')).toEqual({ name: 'today' });
  });

  it('reconnaît les réglages, avec ou sans « / » final', () => {
    expect(parseRoute('#/reglages')).toEqual({ name: 'settings' });
    expect(parseRoute('#/reglages/')).toEqual({ name: 'settings' });
    expect(parseRoute('#reglages')).toEqual({ name: 'settings' });
  });

  it('ignore les paramètres', () => {
    expect(parseRoute('#/reglages?onglet=stockage')).toEqual({ name: 'settings' });
  });

  it("retombe sur l'accueil pour un chemin inconnu", () => {
    expect(parseRoute('#/nimporte-quoi')).toEqual({ name: 'today' });
  });
});

describe('routeHref', () => {
  it('construit des liens que parseRoute relit à l’identique', () => {
    for (const name of ['today', 'settings'] as const) {
      expect(parseRoute(routeHref(name)).name).toBe(name);
    }
  });
});
