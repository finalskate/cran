/**
 * Garde-fous sur la DONNÉE des habitudes : chaque déclencheur a un libellé, les plans de départ
 * sont complets, uniques et assez génériques pour un dépôt public.
 */
import { describe, expect, it } from 'vitest';
import { isCompletePlan, TRIGGERS } from '../domain/habits';
import { DEFAULT_PLANS, TRIGGER_LABEL } from './habits';

describe('habitudes (données)', () => {
  it('un libellé par déclencheur', () => {
    for (const t of TRIGGERS) expect(TRIGGER_LABEL[t], t).toBeTruthy();
  });

  it('des plans de départ complets, aux identifiants uniques, liés à un déclencheur connu', () => {
    expect(new Set(DEFAULT_PLANS.map((p) => p.id)).size).toBe(DEFAULT_PLANS.length);
    for (const p of DEFAULT_PLANS) {
      expect(isCompletePlan(p), p.id).toBe(true);
      expect(TRIGGERS, p.id).toContain(p.trigger);
    }
  });

  it('chaque déclencheur (sauf « autre ») a au moins un plan de départ', () => {
    for (const t of TRIGGERS.filter((t) => t !== 'other')) expect(DEFAULT_PLANS.some((p) => p.trigger === t), t).toBe(true);
  });
});
