/**
 * Garde-fous sur les DONNÉES du catalogue et des lieux : une faute de frappe dans un fichier
 * de données doit casser un test, pas l'appli.
 */
import { describe, expect, it } from 'vitest';
import type { Movement, Variant } from '../domain/types';
import { CATALOG, COOLDOWN, WARMUP } from './catalog';
import { DEFAULT_LOCATIONS, EQUIPMENT } from './equipment';

const ALL_MOVEMENTS: Movement[] = [...CATALOG, WARMUP, COOLDOWN];

function allVariants(m: Movement): Variant[] {
  return [...m.levels.flatMap((l) => l.variants), ...(m.substitutes ?? [])];
}

const KNOWN_TAGS = new Set(EQUIPMENT.map((e) => e.tag));

describe('catalogue', () => {
  it('a des identifiants uniques (mouvements et variantes)', () => {
    const movementIds = ALL_MOVEMENTS.map((m) => m.id);
    expect(new Set(movementIds).size).toBe(movementIds.length);
    const variantIds = ALL_MOVEMENTS.flatMap(allVariants).map((v) => v.id);
    expect(new Set(variantIds).size).toBe(variantIds.length);
  });

  it('a au moins une variante par niveau', () => {
    for (const m of ALL_MOVEMENTS) {
      expect(m.levels.length, m.id).toBeGreaterThan(0);
      for (const level of m.levels) expect(level.variants.length, m.id).toBeGreaterThan(0);
    }
  });

  it('ne référence que du matériel connu', () => {
    for (const v of ALL_MOVEMENTS.flatMap(allVariants)) {
      for (const req of v.needs) {
        for (const tag of Array.isArray(req) ? req : [req]) expect(KNOWN_TAGS.has(tag), `${v.id} → ${tag}`).toBe(true);
      }
    }
  });

  it('a des fourchettes valides', () => {
    for (const v of ALL_MOVEMENTS.flatMap(allVariants)) {
      expect(v.target.min, v.id).toBeGreaterThan(0);
      expect(v.target.max, v.id).toBeGreaterThanOrEqual(v.target.min);
    }
  });

  it('a 3 à 5 consignes par variante, et des erreurs courantes hors exercices guidés', () => {
    for (const m of ALL_MOVEMENTS) {
      for (const v of allVariants(m)) {
        expect(v.cues.length, v.id).toBeGreaterThanOrEqual(3);
        expect(v.cues.length, v.id).toBeLessThanOrEqual(5);
        if (m.category !== 'warmup' && m.category !== 'cooldown') expect(v.mistakes.length, v.id).toBeGreaterThan(0);
      }
    }
  });

  it('précise si une variante « mains au sol » est faisable sur les poings', () => {
    for (const v of ALL_MOVEMENTS.flatMap(allVariants)) {
      if (v.handsOnFloor) expect(typeof v.fistsOk, v.id).toBe('boolean');
    }
  });

  it('ne propose jamais la chaise sur une jambe', () => {
    for (const v of ALL_MOVEMENTS.flatMap(allVariants)) {
      expect(v.name.toLowerCase(), v.id).not.toMatch(/chaise.*une jambe/);
    }
  });
});

describe('lieux par défaut', () => {
  it('ont des identifiants uniques et du matériel connu', () => {
    const ids = DEFAULT_LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of DEFAULT_LOCATIONS) for (const t of l.equipment) expect(KNOWN_TAGS.has(t), `${l.id} → ${t}`).toBe(true);
  });
});
