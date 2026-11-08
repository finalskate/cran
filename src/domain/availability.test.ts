import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import { DEFAULT_LOCATIONS } from '../data/equipment';
import { alternatives, handSupport, isAvailable, maxKneeImpact, resolveVariant, variantHere, type Context } from './availability';
import type { Location, Movement } from './types';

const byId = (id: string): Movement => CATALOG.find((m) => m.id === id)!;
const loc = (id: string): Location => DEFAULT_LOCATIONS.find((l) => l.id === id)!;
const ctx = (location: Location, over: Partial<Context> = {}): Context => ({ location, kneeScore: 0, wristRule: true, ...over });

const bare: Location = { id: 'bare', name: 'Rien', equipment: [], space: 'large', order: 0 };

describe('genou', () => {
  it('applique les seuils de la spec', () => {
    expect(maxKneeImpact(0)).toBe('high');
    expect(maxKneeImpact(2)).toBe('high');
    expect(maxKneeImpact(3)).toBe('mid');
    expect(maxKneeImpact(4)).toBe('mid');
    expect(maxKneeImpact(5)).toBe('low');
  });

  it('retire le pistol dès un score de 3', () => {
    const squat = byId('squat');
    const res = resolveVariant(squat, squat.levels.length - 1, ctx(loc('home'), { kneeScore: 3 }));
    expect(res?.variant.knee).not.toBe('high');
    expect(res?.adapted).toBe(true);
  });
});

describe('règle poignet', () => {
  const pushup = byId('push-h').levels[1]!.variants[0]!;
  const wallHspu = byId('push-v').levels[3]!.variants[0]!;

  it('met les pompes sur poignées quand il y en a', () => {
    expect(handSupport(pushup, ctx(loc('home')))).toBe('handles');
  });

  it('passe sur les poings sans poignées', () => {
    expect(handSupport(pushup, ctx(loc('park')))).toBe('fists');
  });

  it('autorise les mains à plat quand la règle est désactivée', () => {
    expect(handSupport(pushup, ctx(loc('park'), { wristRule: false }))).toBe('flat');
  });

  it("refuse l'appui renversé sans poignées (pas faisable sur les poings)", () => {
    expect(isAvailable(wallHspu, ctx(loc('park')))).toBe(false);
    expect(isAvailable(wallHspu, ctx(loc('home')))).toBe(true);
  });
});

describe('resolveVariant', () => {
  it('garde le niveau et change la variante selon le lieu (sangles ou table)', () => {
    const pullH = byId('pull-h');
    expect(resolveVariant(pullH, 3, ctx(loc('home')))?.variant.id).toBe('row-table-straight');
    const strapsOnly: Location = { ...bare, equipment: ['straps', 'pullup-bar'] };
    const res = resolveVariant(pullH, 3, ctx(strapsOnly));
    expect(res?.variant.id).toBe('row-straps-horizontal');
    expect(res?.level).toBe(3);
    expect(res?.adapted).toBe(false);
  });

  it('abaisse le niveau quand le matériel manque', () => {
    // Pompes déclinées lestées : banc + sac. Sans rien, on retombe sur le niveau d'en dessous (archer).
    const res = resolveVariant(byId('push-h'), 6, ctx(bare, { wristRule: false }));
    expect(res?.variant.id).toBe('pushup-archer');
    expect(res?.adapted).toBe(true);
  });

  it('monte au niveau faisable le plus proche si les niveaux faciles demandent du matériel absent', () => {
    // Niveau 1 = squat sur chaise ; sans chaise, on propose le squat (niveau 2).
    const res = resolveVariant(byId('squat'), 0, ctx(bare));
    expect(res?.variant.id).toBe('squat');
    expect(res?.adapted).toBe(true);
  });

  it('propose le substitut faible pour tirer vertical sans barre', () => {
    const res = resolveVariant(byId('pull-v'), 3, ctx(loc('home')));
    expect(res?.variant.substitute).toBe(true);
    expect(res?.level).toBe(-1);
  });

  it('renvoie null si rien n’est faisable', () => {
    expect(resolveVariant(byId('dips'), 0, ctx(bare))).toBeNull();
  });
});

describe('alternatives', () => {
  it('propose les équivalents du même niveau puis du niveau inférieur', () => {
    const pullH = byId('pull-h');
    const alts = alternatives(pullH, 2, 'row-table-bent', ctx(loc('home')));
    expect(alts[0]?.variant.id).toBe('row-straps-horizontal-bent');
    expect(alts.every((a) => a.variant.id !== 'row-table-bent')).toBe(true);
  });
});

describe('variante préférée (retouche du 08/11)', () => {
  const pushV = byId('push-v');

  it('sans préférence : la première faisable du niveau (pike push-up)', () => {
    expect(resolveVariant(pushV, 0, ctx(loc('home')))?.variant.id).toBe('pike-pushup');
    expect(variantHere(pushV, 0, ctx(loc('home'))).id).toBe('pike-pushup');
  });

  it('la variante choisie passe en premier, au même niveau', () => {
    const c = ctx(loc('home'), { preferred: { 'push-v': 'band-press' } });
    expect(resolveVariant(pushV, 0, c)).toEqual({ variant: pushV.levels[0]!.variants[1], level: 0, adapted: false });
  });

  it('ignorée là où elle n’est pas faisable, et aux autres niveaux', () => {
    // Pas d'élastiques au parc : retour au pike push-up.
    expect(resolveVariant(pushV, 0, ctx(loc('park'), { preferred: { 'push-v': 'band-press' } }))?.variant.id).toBe('pike-pushup');
    expect(resolveVariant(pushV, 1, ctx(loc('home'), { preferred: { 'push-v': 'band-press' } }))?.variant.id).toBe('pike-pushup-elevated');
  });
});

describe('ancrage de porte (retouche du 08/11)', () => {
  it('pas de dips aux sangles contre une porte, mais avec une barre ou des barres parallèles', () => {
    const dips = byId('dips');
    expect(resolveVariant(dips, 0, ctx(loc('home')))).toBeNull();
    expect(resolveVariant(dips, 0, ctx(loc('equipped')))?.variant.id).toBe('dips-straps-assisted');
    const withBeams: Location = { ...loc('home'), equipment: [...loc('home').equipment, 'dip-bars'] };
    expect(resolveVariant(dips, 0, ctx(withBeams))).toMatchObject({ variant: { id: 'dips-bars' }, level: 1 });
  });

  it('body saw sur serviette à la maison', () => {
    const core = byId('core');
    const last = core.levels.length - 1;
    expect(resolveVariant(core, last, ctx(loc('home')))?.variant.id).toBe('body-saw-towel');
  });

  it('rowing élastique sans ancrage', () => {
    const onlyBands: Location = { ...bare, equipment: ['bands'] };
    expect(resolveVariant(byId('pull-h'), 0, ctx(onlyBands))?.variant.id).toBe('row-band');
  });
});
