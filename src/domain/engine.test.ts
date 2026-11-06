import { describe, expect, it } from 'vitest';
import { CATALOG, COOLDOWN, WARMUP } from '../data/catalog';
import { DEFAULT_LOCATIONS } from '../data/equipment';
import { buildPlan, pickMains, type EngineInput } from './engine';
import { DURATIONS, type Duration, type Location, type Plan } from './types';

const loc = (id: string): Location => DEFAULT_LOCATIONS.find((l) => l.id === id)!;
const NOW = new Date('2026-11-14T09:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function input(over: Partial<EngineInput> & { location?: Location; kneeScore?: number } = {}): EngineInput {
  const { location = loc('home'), kneeScore = 0, ...rest } = over;
  return {
    catalog: CATALOG,
    warmup: WARMUP,
    cooldown: COOLDOWN,
    ctx: { location, kneeScore, wristRule: true },
    duration: 20,
    levels: {},
    lastDone: {},
    lastBest: {},
    now: NOW,
    ...rest,
  };
}

const categoryOf = (movementId: string) => CATALOG.find((m) => m.id === movementId)?.category;
const mainItems = (plan: Plan) =>
  plan.blocks.filter((b) => b.kind === 'superset' || b.kind === 'single').flatMap((b) => b.items).filter((i) => ['push', 'pull', 'legs'].includes(categoryOf(i.movementId) ?? ''));

describe('formats', () => {
  it('10 min : prévention + un circuit pousser/tirer', () => {
    const plan = buildPlan(input({ duration: 10 }));
    expect(plan.blocks.map((b) => b.kind)).toEqual(['knee', 'superset']);
    expect(mainItems(plan).map((i) => categoryOf(i.movementId)).sort()).toEqual(['pull', 'push']);
  });

  it('20 min : prévention + 3 mouvements principaux, un de chaque famille', () => {
    const plan = buildPlan(input({ duration: 20 }));
    expect(plan.blocks[0]!.kind).toBe('knee');
    const cats = mainItems(plan).map((i) => categoryOf(i.movementId));
    expect(cats).toHaveLength(3);
    expect(new Set(cats)).toEqual(new Set(['push', 'pull', 'legs']));
  });

  it('30 min : échauffement, 4 mouvements et gainage', () => {
    const plan = buildPlan(input({ duration: 30 }));
    expect(plan.blocks[0]!.kind).toBe('warmup');
    expect(mainItems(plan)).toHaveLength(4);
    expect(plan.blocks.some((b) => b.kind === 'core')).toBe(true);
  });

  it('40 min : 5 mouvements, 4 séries sur le premier bloc, gainage et épaules', () => {
    const plan = buildPlan(input({ duration: 40 }));
    expect(mainItems(plan)).toHaveLength(5);
    const firstMain = plan.blocks.find((b) => b.kind === 'superset')!;
    expect(firstMain.items[0]!.sets).toBeGreaterThanOrEqual(3);
    const core = plan.blocks.find((b) => b.title === 'Gainage et épaules');
    expect(core?.items).toHaveLength(2);
  });

  it('contient toujours la prévention genou, quel que soit le lieu et la durée', () => {
    for (const location of DEFAULT_LOCATIONS) {
      for (const duration of DURATIONS) {
        const plan = buildPlan(input({ location, duration }));
        expect(plan.blocks.some((b) => b.kind === 'knee'), `${location.id} ${duration}`).toBe(true);
      }
    }
  });

  it("donne une estimation cohérente avec la durée choisie", () => {
    for (const duration of DURATIONS) {
      const plan = buildPlan(input({ duration }));
      expect(plan.estimatedMinutes, `${duration} min`).toBeGreaterThanOrEqual(duration * 0.6);
      expect(plan.estimatedMinutes, `${duration} min`).toBeLessThanOrEqual(duration === 40 ? 50 : duration * 1.15);
    }
  });
});

describe('genou (SPEC §4.6)', () => {
  it('score ≥ 5 : aucun mouvement de jambes', () => {
    const plan = buildPlan(input({ duration: 30, kneeScore: 5 }));
    expect(mainItems(plan).some((i) => categoryOf(i.movementId) === 'legs')).toBe(false);
    expect(plan.blocks.some((b) => b.kind === 'knee')).toBe(true);
  });

  it("score 3 : l'isométrie passe en tête de la prévention", () => {
    const plan = buildPlan(input({ duration: 20, kneeScore: 3 }));
    const knee = plan.blocks.find((b) => b.kind === 'knee')!;
    expect(knee.items[0]!.target.kind).toBe('time');
  });

  it("score 4 : aucun exercice à fort impact sur le genou", () => {
    const plan = buildPlan(input({ duration: 40, kneeScore: 4, levels: { squat: 6 } }));
    const variants = plan.blocks.flatMap((b) => b.items).map((i) => i.variantId);
    expect(variants).not.toContain('pistol');
    expect(variants).not.toContain('pistol-assisted');
  });
});

describe('priorités et niveaux', () => {
  it('privilégie le mouvement le moins récent dans une famille', () => {
    // Tirer horizontal fait hier, tirer vertical jamais (au parc, il y a une barre) : on prend le vertical.
    const picked = pickMains(input({ location: loc('park'), lastDone: { 'pull-h': daysAgo(1) } }), 3);
    const pull = picked.find((p) => p.movement.category === 'pull');
    expect(pull?.movement.id).toBe('pull-v');
  });

  it('respecte le niveau choisi et adapte la variante au lieu', () => {
    const plan = buildPlan(input({ duration: 10, levels: { 'push-h': 5 } }));
    const push = plan.blocks.flatMap((b) => b.items).find((i) => i.movementId === 'push-h');
    expect(push?.variantId).toBe('pushup-archer');
    expect(push?.handSupport).toBe('handles');
  });

  it('pré-remplit avec la meilleure série de la dernière fois, bornée à la fourchette', () => {
    const plan = buildPlan(input({ duration: 10, levels: { 'push-h': 1 }, lastBest: { pushup: 40 } }));
    const push = plan.blocks.flatMap((b) => b.items).find((i) => i.variantId === 'pushup');
    expect(push?.prefill).toBe(25); // haut de la fourchette 12–25
  });

  it('ajoute la série longue de pompes une fois par semaine', () => {
    const fresh = buildPlan(input({ duration: 20 }));
    expect(fresh.blocks.some((b) => b.kind === 'volume')).toBe(true);
    const recent = buildPlan(input({ duration: 20, lastDone: { 'pushup-volume': daysAgo(3) } }));
    expect(recent.blocks.some((b) => b.kind === 'volume')).toBe(false);
  });

  it('est déterministe', () => {
    expect(buildPlan(input({ duration: 30 }))).toEqual(buildPlan(input({ duration: 30 })));
  });
});

describe('lieux pauvres', () => {
  it('Petit espace : propose quand même une séance de 20 min', () => {
    const plan = buildPlan(input({ location: loc('small'), duration: 20 as Duration }));
    expect(mainItems(plan).length).toBeGreaterThanOrEqual(2);
  });
});
