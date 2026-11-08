import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import { FIGURES } from '../data/figures';
import { BODY, camera, cycleDuration, len, leanTurnOf, limbPath, poseAt, project, skeleton, solveLimb, sub, trunkFrame, type Vec } from './figure';

const dist = (a: Vec, b: Vec) => len(sub(a, b));
const close = (a: Vec, b: Vec, eps = 1e-6) => expect(dist(a, b)).toBeLessThan(eps);

describe('cinématique inverse', () => {
  it('atteint la cible en gardant la longueur des segments', () => {
    const { mid, end, reach } = solveLimb([0, 0, 0], [10, -20, 5], 17, 15, [1, 0, 0]);
    close(end, [10, -20, 5], 1e-2);
    expect(dist([0, 0, 0], mid)).toBeCloseTo(17, 6);
    expect(dist(mid, end)).toBeCloseTo(15, 6);
    expect(reach).toBeLessThan(1);
  });

  it('plie du côté demandé', () => {
    const forward = solveLimb([0, 50, 0], [0, 4, 0], 24.5, 24, [1, 0, 0]);
    const backward = solveLimb([0, 50, 0], [0, 4, 0], 24.5, 24, [-1, 0, 0]);
    expect(forward.mid[0]).toBeGreaterThan(0);
    expect(backward.mid[0]).toBeLessThan(0);
  });

  it('cible trop loin : membre tendu vers elle, signalé', () => {
    const { end, reach } = solveLimb([0, 0, 0], [100, 0, 0], 17, 15, [0, 1, 0]);
    expect(end[0]).toBeCloseTo(32, 2);
    expect(reach).toBeGreaterThan(1);
  });
});

describe('repère du tronc', () => {
  it('debout : colonne vers le haut, poitrine vers l’avant, droite vers z', () => {
    const f = trunkFrame({ lean: 0 });
    close(f.up, [0, 1, 0]);
    close(f.front, [1, 0, 0]);
    close(f.right, [0, 0, 1]);
  });

  it('à plat ventre (lean 90) : colonne vers l’avant, poitrine vers le sol', () => {
    const f = trunkFrame({ lean: 90 });
    close(f.up, [1, 0, 0]);
    close(f.front, [0, -1, 0]);
  });

  it('leanTurnOf retrouve les angles d’une direction', () => {
    const f = trunkFrame({ lean: 70, turn: -12 });
    const { lean, turn } = leanTurnOf(f.up);
    expect(lean).toBeCloseTo(70, 6);
    expect(turn).toBeCloseTo(-12, 6);
  });
});

describe('caméra', () => {
  it('profil : l’avant à droite de l’écran, le haut en haut (y SVG vers le bas)', () => {
    const cam = camera({ yaw: 0, pitch: 0 });
    expect(project(cam, [10, 0, 0]).x).toBeCloseTo(10);
    expect(project(cam, [0, 10, 0]).y).toBeCloseTo(-10);
    expect(project(cam, [0, 0, 10]).z).toBeCloseTo(10); // la droite de la personne est devant
  });
});

describe('animations du catalogue', () => {
  const ids = new Set(CATALOG.flatMap((m) => [...m.levels.flatMap((l) => l.variants), ...(m.substitutes ?? [])]).map((v) => v.id));

  for (const [id, anim] of Object.entries(FIGURES)) {
    describe(id, () => {
      it('correspond à une variante du catalogue', () => expect(ids.has(id)).toBe(true));

      it('aucun membre étiré au-delà de sa longueur, rien sous le sol', () => {
        for (const k of anim.frames) {
          const s = skeleton(k.pose);
          expect(s.maxReach).toBeLessThanOrEqual(1.01);
          for (const p of [s.head, s.handL, s.handR, s.toeL, s.toeR, s.kneeL, s.kneeR, s.pelvis]) expect(p[1]).toBeGreaterThan(-1.5);
        }
      });

      it('chaque position clé est atteinte puis tenue', () => {
        let t = 0;
        for (const k of anim.frames) {
          t += k.move;
          expect(poseAt(anim, t + 1e-6).pelvis).toEqual(k.pose.pelvis);
          t += k.hold ?? 0;
        }
        expect(t).toBeCloseTo(cycleDuration(anim));
      });
    });
  }
});

describe('dessin', () => {
  it('un fuseau est un chemin fermé', () => {
    const d = limbPath({ x: 0, y: 0, z: 0 }, { x: 20, y: 5, z: 0 }, 4, 2);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('les proportions donnent une personne d’environ 100 unités', () => {
    const standing = skeleton({
      pelvis: [0, BODY.thigh + BODY.shin + 3.5, 0],
      lean: 0,
      armL: { to: [0, 50, -12], bend: [-1, 0, 0] },
      armR: { to: [0, 50, 12], bend: [-1, 0, 0] },
      legL: { to: [0, 3.5, -7], bend: [1, 0, 0] },
      legR: { to: [0, 3.5, 7], bend: [1, 0, 0] },
    });
    const top = standing.head[1] + BODY.headR;
    expect(top).toBeGreaterThan(95);
    expect(top).toBeLessThan(102);
  });
});
