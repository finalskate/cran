import { describe, expect, it } from 'vitest';
import { CATALOG, COOLDOWN, WARMUP } from '../data/catalog';
import { DEFAULT_LOCATIONS } from '../data/equipment';
import { findVariant, hasEquipment } from './availability';
import { buildPlan } from './engine';
import { gearNeeds, toggleMissing, withoutEquipment, type GearUse } from './gear';
import type { Location, Variant } from './types';

const loc = (id: string): Location => DEFAULT_LOCATIONS.find((l) => l.id === id)!;
const variant = (id: string): Variant => {
  for (const m of CATALOG) {
    const found = findVariant(m, id);
    if (found) return found.variant;
  }
  throw new Error(`variante inconnue : ${id}`);
};
const NOW = new Date('2026-11-14T09:00:00Z');

describe('matériel à préparer', () => {
  it('liste le matériel dans l’ordre d’utilisation, sans doublon', () => {
    const uses: GearUse[] = [
      { variant: variant('step-down') },
      { variant: variant('row-straps-easy') },
      { variant: variant('curl-straps-easy') },
    ];
    const needs = gearNeeds(uses, loc('home'));
    expect(needs.map((n) => n.tag)).toEqual(['step', 'straps', 'anchor']);
    expect(needs.find((n) => n.tag === 'straps')?.uses).toHaveLength(2);
  });

  it('marque les sangles et l’ancrage « à installer avant »', () => {
    const needs = gearNeeds([{ variant: variant('row-straps-easy') }], loc('home'));
    expect(needs.every((n) => n.setup)).toBe(true);
    expect(gearNeeds([{ variant: variant('step-down') }], loc('home'))[0]!.setup).toBe(false);
  });

  it('retient, pour « l’un ou l’autre », le matériel que le lieu possède', () => {
    const park = loc('park');
    const needs = gearNeeds([{ variant: variant('row-straps-easy') }], { ...park, equipment: [...park.equipment, 'straps'] });
    expect(needs.map((n) => n.tag)).toContain('pullup-bar');
    expect(needs.map((n) => n.tag)).not.toContain('anchor');
  });

  it('ajoute les poignées seulement quand les mains sont sur poignées', () => {
    const archer = variant('pushup-archer');
    expect(gearNeeds([{ variant: archer, handSupport: 'handles' }], loc('home')).map((n) => n.tag)).toEqual(['pushup-handles']);
    expect(gearNeeds([{ variant: archer, handSupport: 'fists' }], loc('home'))).toEqual([]);
  });

  it('précise les élastiques prévus', () => {
    const band = { rank: 1, of: 3, label: '20 kg' };
    const needs = gearNeeds([{ variant: variant('pulldown-band'), band }], loc('home'));
    expect(needs.find((n) => n.tag === 'bands')?.bands).toEqual(['20 kg']);
  });
});

describe('pas sous la main', () => {
  it('retire le matériel du lieu sans toucher au lieu d’origine', () => {
    const home = loc('home');
    const today = withoutEquipment(home, ['step']);
    expect(today.equipment).not.toContain('step');
    expect(home.equipment).toContain('step');
    expect(today.id).toBe(home.id);
    expect(withoutEquipment(home, [])).toBe(home);
  });

  it('bascule un matériel', () => {
    expect(toggleMissing([], 'step')).toEqual(['step']);
    expect(toggleMissing(['step', 'straps'], 'step')).toEqual(['straps']);
  });

  it('le moteur refait une séance complète sans la marche ni les sangles', () => {
    const today = withoutEquipment(loc('home'), ['step', 'straps']);
    for (const duration of [10, 20, 30, 40] as const) {
      const plan = buildPlan({
        catalog: CATALOG,
        warmup: WARMUP,
        cooldown: COOLDOWN,
        ctx: { location: today, kneeScore: 0, wristRule: true },
        duration,
        levels: {},
        lastDone: {},
        lastSession: {},
        now: NOW,
      });
      const items = plan.blocks.flatMap((b) => b.items);
      expect(plan.blocks.some((b) => b.kind === 'knee')).toBe(true);
      for (const item of items) {
        const all = [...CATALOG, WARMUP, COOLDOWN];
        const v = all.map((m) => findVariant(m, item.variantId)).find(Boolean)!.variant;
        expect(hasEquipment(v, today), v.name).toBe(true);
      }
    }
  });
});
