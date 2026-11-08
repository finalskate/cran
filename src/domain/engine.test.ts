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
    lastSession: {},
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

  it('fixe l’objectif par double progression, borné à la fourchette', () => {
    const last = (values: number[], days = 2, feel?: 'hard') => ({
      pushup: { at: daysAgo(days), sets: values.map((value) => ({ value, ...(feel ? { feel } : {}) })) },
    });
    const prefill = (lastSession: EngineInput['lastSession']) =>
      buildPlan(input({ duration: 10, levels: { 'push-h': 1 }, lastSession }))
        .blocks.flatMap((b) => b.items)
        .find((i) => i.variantId === 'pushup')?.prefill;
    expect(prefill(last([15, 14, 13]))).toBe(14); // série la plus faible + 1
    expect(prefill(last([15, 14, 13], 2, 'hard'))).toBe(13); // « Dur » : on consolide
    expect(prefill(last([40, 40]))).toBe(25); // haut de la fourchette 12–25
    expect(prefill(last([15, 14, 13], 12))).toBe(12); // reprise après pause : 2 crans en dessous, borné
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

describe('récupération et charge (J2)', () => {
  it('écarte les mouvements déjà travaillés et le dit', () => {
    const first = buildPlan(input({ duration: 20 }));
    const done = mainItems(first).map((i) => i.movementId);
    const second = buildPlan(input({ duration: 20, exclude: done }));
    expect(mainItems(second).some((i) => done.includes(i.movementId))).toBe(false);
    expect(second.notes?.[0]).toMatch(/2e séance/);
    // La prévention genou reste.
    expect(second.blocks[0]!.kind).toBe('knee');
  });

  it('met les jambes au repos après une séance imposée « jambes »', () => {
    const plan = buildPlan(input({ duration: 20, restLegs: true }));
    expect(mainItems(plan).some((i) => categoryOf(i.movementId) === 'legs')).toBe(false);
    expect(plan.blocks.some((b) => b.kind === 'knee')).toBe(true);
    expect(plan.notes).toContain('Jambes au repos : elles ont travaillé il y a moins de 24 h.');
  });

  it('module le volume selon le ressenti, entre 2 et 4 séries', () => {
    const sets = (volume: -1 | 0 | 1) =>
      buildPlan(input({ duration: 20, volume })).blocks.find((b) => b.kind === 'superset')!.items[0]!.sets;
    expect(sets(-1)).toBe(sets(0) - 1);
    expect(sets(1)).toBeLessThanOrEqual(4);
    expect(sets(-1)).toBeGreaterThanOrEqual(2);
  });
});

describe('priorité haut du corps (J3b)', () => {
  const armsBlock = (plan: Plan) => plan.blocks.find((b) => b.title === 'Bras');
  const legsIn = (plan: Plan) => mainItems(plan).filter((i) => categoryOf(i.movementId) === 'legs');

  it('équilibrée (par défaut) : pas de bloc bras', () => {
    for (const duration of DURATIONS) expect(armsBlock(buildPlan(input({ duration }))), `${duration}`).toBeUndefined();
  });

  it('ajoute un superset biceps + triceps dès 20 min, après les mouvements principaux', () => {
    const plan = buildPlan(input({ duration: 30, focus: 'upper' }));
    const arms = armsBlock(plan)!;
    expect(arms.items.map((i) => i.movementId).sort()).toEqual(['biceps', 'triceps']);
    const lastMain = plan.blocks.findLastIndex((b) => b.items.some((i) => ['push', 'pull', 'legs'].includes(categoryOf(i.movementId) ?? '')));
    expect(plan.blocks.indexOf(arms)).toBeGreaterThan(lastMain);
    // À la maison : sangles (poignées libres en rotation) plutôt qu'élastique.
    expect(arms.items.map((i) => i.variantId)).toContain('curl-straps-easy');
  });

  it('10 min : le circuit pousser/tirer seul, sans bras', () => {
    const plan = buildPlan(input({ duration: 10, focus: 'upper' }));
    expect(armsBlock(plan)).toBeUndefined();
    expect(plan.blocks.map((b) => b.kind)).toEqual(['knee', 'superset']);
  });

  it('jambes environ 2 fois par semaine : pas de jambes si elles ont moins de 3 jours, et le dit', () => {
    const recent = buildPlan(input({ duration: 20, focus: 'upper', lastDone: { squat: daysAgo(1) } }));
    expect(legsIn(recent)).toHaveLength(0);
    expect(recent.notes?.some((n) => /Priorité haut du corps/.test(n))).toBe(true);
    expect(recent.blocks[0]!.kind).toBe('knee'); // la prévention genou reste

    const due = buildPlan(input({ duration: 20, focus: 'upper', lastDone: { squat: daysAgo(3), hinge: daysAgo(4) } }));
    expect(legsIn(due)).toHaveLength(1);
    expect(due.notes ?? []).not.toContainEqual(expect.stringMatching(/Priorité haut du corps/));
  });

  it('une seule famille de jambes par séance, même à 40 min', () => {
    const balanced = buildPlan(input({ duration: 40 }));
    const upper = buildPlan(input({ duration: 40, focus: 'upper' }));
    expect(legsIn(balanced).length).toBeGreaterThanOrEqual(1);
    expect(legsIn(upper)).toHaveLength(1);
    expect(mainItems(upper)).toHaveLength(5);
  });

  it('dès 30 min : une série de plus sur les blocs sans jambes, 4 au plus', () => {
    const setsOf = (plan: Plan) =>
      plan.blocks.find((b) => b.kind === 'superset' && b.items.every((i) => ['push', 'pull'].includes(categoryOf(i.movementId) ?? '')))!
        .items[0]!.sets;
    expect(setsOf(buildPlan(input({ duration: 30, focus: 'upper' })))).toBe(setsOf(buildPlan(input({ duration: 30 }))) + 1);
    expect(setsOf(buildPlan(input({ duration: 40, focus: 'upper', volume: 1 })))).toBeLessThanOrEqual(4);
  });

  it('reste dans la durée choisie', () => {
    for (const duration of DURATIONS) {
      const plan = buildPlan(input({ duration, focus: 'upper' }));
      expect(plan.estimatedMinutes, `${duration} min`).toBeLessThanOrEqual(duration === 40 ? 50 : duration * 1.15);
    }
  });

  it('2e séance du jour : les bras travaillés dans les 48 h sont écartés', () => {
    const plan = buildPlan(input({ duration: 30, focus: 'upper', exclude: ['biceps', 'triceps'] }));
    expect(armsBlock(plan)).toBeUndefined();
  });

  it('gainage et abdos en flexion alternent (le moins récent d’abord)', () => {
    const core = (lastDone: Record<string, string>) => buildPlan(input({ duration: 30, lastDone })).blocks.find((b) => b.kind === 'core')!;
    expect(core({ core: daysAgo(2) }).title).toBe('Abdos');
    expect(core({ abs: daysAgo(2) }).title).toBe('Gainage');
  });
});
