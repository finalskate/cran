import { describe, expect, it } from 'vitest';
import {
  adjustRest,
  blockProgress,
  buildSteps,
  completeStep,
  currentStep,
  endRest,
  previousResults,
  progress,
  restRemaining,
  setItemBand,
  setsOfItem,
  skipBlock,
  startSession,
  toRecord,
} from './session';
import type { Plan, PlanItem } from './types';

const item = (movementId: string, sets: number, over: Partial<PlanItem> = {}): PlanItem => ({
  movementId,
  variantId: `${movementId}-v`,
  level: 0,
  adapted: false,
  sets,
  target: { kind: 'reps', min: 5, max: 10 },
  prefill: 5,
  ...over,
});

/** Plan minimal : un échauffement guidé, puis un superset A/B en 2 séries. */
const PLAN: Plan = {
  createdAt: '2026-11-14T09:00:00.000Z',
  locationId: 'home',
  duration: 10,
  kneeScore: 0,
  estimatedMinutes: 10,
  blocks: [
    { kind: 'warmup', title: 'Échauffement', items: [item('w', 1, { guided: true })], restBetween: 5, restAfterRound: 20 },
    { kind: 'superset', title: 'Superset A', items: [item('a', 2), item('b', 2)], restBetween: 15, restAfterRound: 60 },
  ],
};

const T0 = 1_000_000;

describe('buildSteps', () => {
  it('alterne les exercices du superset série par série', () => {
    const steps = buildSteps(PLAN);
    expect(steps.map((s) => `${s.block}.${s.item}#${s.set}`)).toEqual(['0.0#1', '1.0#1', '1.1#1', '1.0#2', '1.1#2']);
  });

  it('place les bons repos', () => {
    const steps = buildSteps(PLAN);
    expect(steps.map((s) => s.restAfter)).toEqual([20, 15, 60, 15, 0]);
  });
});

describe('déroulé', () => {
  it('lance un repos à heure de fin fixe, puis enchaîne', () => {
    let s = startSession(PLAN, T0);
    s = completeStep(s, null, T0); // échauffement
    expect(s.phase).toBe('rest');
    expect(restRemaining(s, T0 + 5_000)).toBe(15);
    s = endRest(s);
    expect(s.phase).toBe('work');
    expect(currentStep(s)).toMatchObject({ block: 1, item: 0, set: 1 });
  });

  it('le temps restant reste juste même si l’appli a été figée', () => {
    let s = startSession(PLAN, T0);
    s = completeStep(s, null, T0);
    // 10 minutes plus tard (appli en arrière-plan) : le repos est terminé, pas « en pause ».
    expect(restRemaining(s, T0 + 600_000)).toBe(0);
  });

  it('±15 s sur le repos, sans passer sous zéro', () => {
    let s = startSession(PLAN, T0);
    s = completeStep(s, null, T0); // repos de 20 s
    s = adjustRest(s, 15, T0);
    expect(restRemaining(s, T0)).toBe(35);
    s = adjustRest(s, -60, T0);
    expect(restRemaining(s, T0)).toBe(0);
  });

  it('mémorise les séries saisies et termine la séance', () => {
    let s = startSession(PLAN, T0);
    s = endRest(completeStep(s, null, T0));
    s = endRest(completeStep(s, { value: 8, feel: 'ok' }, T0)); // A1
    s = endRest(completeStep(s, { value: 10, feel: 'easy' }, T0)); // B1
    expect(previousResults(s, currentStep(s)!)).toEqual([{ value: 8, feel: 'ok' }]); // A2 : voit A1
    s = endRest(completeStep(s, { value: 7, feel: 'hard' }, T0)); // A2
    s = completeStep(s, { value: 9, feel: 'ok' }, T0); // B2, dernière
    expect(s.phase).toBe('done');
    expect(progress(s)).toEqual({ done: 5, total: 5 });

    const rec = toRecord(s, T0 + 600_000);
    // L'échauffement guidé n'est pas enregistré.
    expect(rec.entries).toEqual([
      { movementId: 'a', variantId: 'a-v', level: 0, sets: [{ value: 8, feel: 'ok' }, { value: 7, feel: 'hard' }] },
      { movementId: 'b', variantId: 'b-v', level: 0, sets: [{ value: 10, feel: 'easy' }, { value: 9, feel: 'ok' }] },
    ]);
  });

  it('peut passer un bloc entier', () => {
    let s = startSession(PLAN, T0);
    s = skipBlock(s);
    expect(currentStep(s)).toMatchObject({ block: 1, item: 0, set: 1 });
    s = skipBlock(s);
    expect(s.phase).toBe('done');
  });

  it('est sérialisable (reprise après fermeture de l’appli)', () => {
    let s = startSession(PLAN, T0);
    s = completeStep(s, null, T0);
    const restored = JSON.parse(JSON.stringify(s));
    expect(restored).toEqual(s);
    expect(restRemaining(restored, T0 + 1_000)).toBe(19);
  });
});

describe('avancement par bloc et cases de séries', () => {
  it('remplit la barre bloc par bloc', () => {
    let s = startSession(PLAN, T0);
    expect(blockProgress(s)).toEqual([{ done: 0, total: 1 }, { done: 0, total: 4 }]);
    s = endRest(completeStep(s, null, T0)); // échauffement fait
    s = completeStep(s, { value: 8, feel: 'ok' }, T0); // A1 validée, repos en cours
    expect(blockProgress(s)).toEqual([{ done: 1, total: 1 }, { done: 1, total: 4 }]);
  });

  it('donne l’état de chaque série de l’exercice en cours', () => {
    let s = startSession(PLAN, T0);
    s = endRest(completeStep(s, null, T0)); // échauffement
    s = endRest(completeStep(s, { value: 8 }, T0)); // A1
    s = endRest(completeStep(s, null, T0)); // B1 sautée
    // On est sur A2 : A1 faite, A2 à faire.
    expect(setsOfItem(s, currentStep(s)!)).toEqual([{ value: 8 }, undefined]);
    s = completeStep(s, { value: 9 }, T0); // A2, repos
    s = endRest(s); // B2
    expect(setsOfItem(s, currentStep(s)!)).toEqual([null, undefined]);
  });
});

describe('élastique de l’exercice (retouche du 08/11)', () => {
  it('se change en séance et s’enregistre avec les séries', () => {
    const band = { rank: 2, of: 3, label: 'fort' };
    let s = startSession(PLAN, T0);
    s = setItemBand(s, 1, 0, band);
    expect(s.plan.blocks[1]!.items[0]!.band).toEqual(band);
    while (s.phase !== 'done') {
      s = s.phase === 'rest' ? endRest(s) : completeStep(s, { value: 8, feel: 'ok' }, T0);
    }
    const rec = toRecord(s, T0 + 600_000);
    expect(rec.entries.find((e) => e.movementId === 'a')?.band).toEqual(band);
    expect(rec.entries.find((e) => e.movementId === 'b')).not.toHaveProperty('band');
  });
});
