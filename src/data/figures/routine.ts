/**
 * Animations de l'échauffement et du retour au calme (J8). Repère et outils : voir kit.ts.
 */
import type { Animation, Pose, Vec } from '../../domain/figure';
import {
  aim,
  anim,
  ANK,
  arms,
  hold,
  legs,
  limb,
  localArms,
  ON_HIPS,
  SHOULDER,
  STAND,
  straight,
  TRUNK,
  wall,
  box,
} from './kit';
import { LEGS } from './legs';

const FRONT = { yaw: 65, pitch: 10 };
const PROFILE = { yaw: 25, pitch: 10 };

// ─── Cercles de bras : bras en croix, petits cercles ───
const standing = { pelvis: [0, STAND, 0] as Vec, lean: 0, ...legs(2, ANK, 9) };
const circle = (f: number, u: number): Pose => ({ ...standing, ...localArms(f, TRUNK + u, SHOULDER + 29.5, [0, -1, 0]) });

// ─── Cercles de hanches : mains sur les hanches, le bassin tourne ───
const hips = (dx: number, dz: number): Pose => ({ pelvis: [dx, STAND - 1, dz], lean: -dx * 0.6, ...ON_HIPS, ...legs(0, ANK, 10) });

// ─── Chat-vache, à quatre pattes ───
// La colonne du mannequin est rigide : le dos rond / creusé se lit par la tête et le bassin.
const allFours = (pelvisY: number, chestY: number, nod: number): Pose => ({
  ...aim([0, pelvisY, 0], [27, chestY, 0]),
  nod,
  ...arms(27, 3, 11, [-1, 0, 0], [1, 0, 0]),
  ...legs(-24, 4, 8, [1, -1, 0], [-1, -0.1, 0]),
});

// ─── Pompes faciles contre un mur ───
const WALL_FACE = 52;
const wallTop: Pose = {
  ...straight([0, ANK, 0], [21, 76, 0]),
  ...arms(WALL_FACE - 1, 74, 13, [-1, -0.4, 0.6], [0, 1, 0]),
  ...legs(0, ANK, 8, [1, 0, 0]),
};
const wallBottom: Pose = { ...wallTop, ...straight([0, ANK, 0], [37, 66, 0]) };

// ─── Étirement des mollets, mains au mur ───
const calfStretch: Pose = {
  pelvis: [-10, 45, 0],
  lean: 20,
  ...arms(28, 72, 13, [-1, -0.4, 0.5], [0, 1, 0]),
  legL: limb([8, ANK, -8], [1, 0, 0]),
  legR: limb([-34, ANK, 8], [1, 0, 0]),
};

// ─── Fléchisseurs de hanche : un genou au sol, on avance le bassin ───
const lunge = (pelvisX: number): Pose => ({
  pelvis: [pelvisX, 29, 0],
  lean: -6,
  ...ON_HIPS,
  legL: limb([20, ANK, -8], [1, 0, 0]),
  legR: limb([-36, 4, 8], [0, -1, 0], [-1, -0.1, 0]),
});

// ─── Quadriceps : sur la jambe gauche, talon droit tenu près de la fesse ───
const quad = (tilt: number): Pose => ({
  pelvis: [0, STAND - 0.5, 0],
  lean: tilt,
  armL: limb([2, 75, -38], [0, -1, -1], [0, 1, 0]),
  armR: limb([-11, 50, 11], [-1, 0, 0.5]),
  legL: limb([0, ANK, -7], [1, 0, 0]),
  legR: limb([-10, 50, 8], [0, -1, 0], [-0.3, 0.95, 0]),
});

export const ROUTINE: Record<string, Animation> = {
  'warmup-arm-circles': anim(FRONT, [
    [circle(6, 0), 0.4],
    [circle(0, 6), 0.4],
    [circle(-6, 0), 0.4],
    [circle(0, -6), 0.4],
  ]),
  'warmup-hip-circles': anim(FRONT, [
    [hips(4, 0), 0.6],
    [hips(0, 4), 0.6],
    [hips(-4, 0), 0.6],
    [hips(0, -4), 0.6],
  ]),
  'warmup-cat-cow': anim(PROFILE, [
    [allFours(30, 33, 45), 1.6, 0.6],
    [allFours(27, 31, -25), 1.6, 0.6],
  ]),
  'warmup-slow-squat': { ...LEGS['squat-tempo']!, frames: LEGS['squat-tempo']!.frames.map((k) => ({ ...k, move: k.move * 1.2 })) },
  'warmup-incline-pushup': anim(PROFILE, [
    [wallTop, 1, 0.3],
    [wallBottom, 1.4, 0.2],
  ], [wall(WALL_FACE)]),
  'cooldown-calf': anim(PROFILE, hold(calfStretch, [1.5, 0, 0]), [wall(30)]),
  'cooldown-hip-flexor': anim(PROFILE, [
    [lunge(-6), 1.6, 1],
    [lunge(-1), 1.6, 2],
  ]),
  'cooldown-quad': anim({ yaw: 35, pitch: 10 }, hold(quad(2), [0, 0.4, 0]), [box([-30, 0, -44], [30, 100, -40.5], 'wall')]),
};
