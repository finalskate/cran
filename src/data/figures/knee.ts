/**
 * Animations du bloc genou (J8) : isométries, descente de marche, mollets, mini-bandes, gainage
 * latéral avec abduction. Repère et outils : voir kit.ts.
 */
import type { Animation, Pose, Vec } from '../../domain/figure';
import {
  aim,
  anim,
  ANK,
  arms,
  band,
  block,
  chestOf,
  hold,
  LEG,
  legs,
  limb,
  local,
  localArms,
  LYING,
  ON_HIPS,
  rep,
  STAND,
  STEP_H,
  straight,
  table,
  TRUNK,
  wall,
} from './kit';

// ─── Chaise contre un mur ───
// Le dos glisse le long du mur jusqu'à l'angle choisi, puis on tient.
const WALL_X = 4;
const wallSitUp: Pose = {
  pelvis: [WALL_X, 44, 0],
  lean: 0,
  ...arms(8, 41, 12, [-1, 0, 0]),
  ...legs(30, 4, 8, [1, 0, 0.15]),
};
const wallSitDown: Pose = { ...wallSitUp, pelvis: [WALL_X, 29, 0], ...arms(22, 36, 10, [-1, -0.3, 0.3]) };

// ─── Descente de marche ───
// Debout sur la jambe droite (côté caméra), la gauche dans le vide devant la marche ; le talon
// gauche descend toucher le sol en 3 secondes, genou droit dans l'axe du pied.
const stepUp: Pose = {
  pelvis: [-3, STEP_H + 4 + LEG - 0.5, 0],
  lean: 4,
  ...ON_HIPS,
  legL: limb([10, STEP_H + 4, -7], [1, 0, 0], [1, -0.5, 0]),
  legR: limb([-2, STEP_H + 4, 6], [1, 0, 0.1]),
};
const stepDown: Pose = { ...stepUp, pelvis: [-7, 49, 0], lean: 22, legL: limb([12, 5, -7], [1, 0, 0], [0.85, 0.5, 0]) };

// ─── Mollets sur marche ───
// Avant des pieds sur la marche, talons dans le vide : on monte sur les deux pieds, on redescend
// en 3 secondes sur un seul (le gauche), l'autre pied levé derrière.
const CALF_EDGE = -2;
const heelsDown = (z: number) => limb([CALF_EDGE - 1, STEP_H - 3.5, z], [1, 0, 0], [0.85, 0.53, 0]);
const onToes = (z: number) => limb([CALF_EDGE - 1, STEP_H + 8.5, z], [1, 0, 0], [0.6, -0.8, 0]);
const calfDown: Pose = { pelvis: [-3, STEP_H - 3.5 + LEG, 0], lean: 2, ...ON_HIPS, legL: heelsDown(-7), legR: heelsDown(7) };
const calfUp: Pose = { ...calfDown, pelvis: [-3, STEP_H + 8.5 + LEG, 0], legL: onToes(-7), legR: onToes(7) };
const calfSingle: Pose = { ...calfDown, legR: limb([-16, 30, 7], [1, 0, 0]) };

// ─── Spanish squat ───
// Élastique autour du pied d'une table, derrière les genoux : on s'assoit en arrière, tibias
// verticaux, et on tient.
const SPANISH_TABLE = 34;
const spanishFeet = legs(6, ANK, 10, [1, 1, 0.1]);
const spanishUpTrunk = { pelvis: [0, STAND - 1, 0] as Vec, lean: 0 };
const spanishDownTrunk = { pelvis: [-20, 28.5, 0] as Vec, lean: -4 };
const spanishUp: Pose = { ...spanishUpTrunk, ...arms(1, chestOf(spanishUpTrunk)[1] - 30, 12, [-1, 0, 0]), ...spanishFeet };
const spanishDown: Pose = { ...spanishDownTrunk, ...arms(8, chestOf(spanishDownTrunk)[1] - 1, 10, [0, -1, 0]), ...spanishFeet };

// ─── Marche latérale à la mini-bande (vue de face) ───
const walkTrunk = { lean: 22, ...localArms(18, 18, 5, [0, -1, 0.5]) };
const walkA: Pose = { pelvis: [0, 42, 0], ...walkTrunk, ...legs(8, ANK, 11, [1, 0, 0.5]) };
const walkB: Pose = { ...walkA, pelvis: [0, 42, 5], legR: limb([8, ANK, 22], [1, 0, 0.5]) };

// ─── Couché sur le côté gauche (poitrine vers la caméra) ───
// lean 90 + twist −90 : la colonne est à l'horizontale vers +x, le côté droit en haut.
const SIDE = { twist: -90 };

/** Gainage latéral sur l'avant-bras gauche ; `lift` : jambe du dessus levée (abduction). */
function sidePlank(lift: boolean): Pose {
  const anklesMid: Vec = [-46, 8, 0];
  const trunk = straight(anklesMid, [-46 + 71.5, 30.3, 0]);
  const c = chestOf(trunk);
  return {
    ...trunk,
    ...SIDE,
    armL: limb([c[0] + 2, 3, 15], [0, -1, 0], [0, 0, 1]),
    armR: local([2, 3, 12], [-1, 0, 0.5]),
    legL: limb([-45, 4.5, 0], [0, 0, 1], [0, 0, 1]),
    legR: limb(lift ? [-44, 38, 0] : [-47, 12, 0], [0, 0, 1], [0, 0, 1]),
  };
}

// ─── Pont fessier à la mini-bande ───
const supineBridge = (pelvis: Vec) => aim(pelvis, [-TRUNK, LYING, 0]);
const bandBridgeLegs = legs(22, ANK, 10, [0, 1, 0.45], [1, -0.35, 0]);
const bandBridgeArms = arms(3, 3, 16, [-0.2, 1, 0], [1, 0, 0]);
const bandBridgeDown: Pose = { ...supineBridge([0, LYING, 0]), ...bandBridgeArms, ...bandBridgeLegs };
const bandBridgeUp: Pose = { ...supineBridge([2, 26, 0]), ...bandBridgeArms, ...bandBridgeLegs };

// ─── Clamshell ───
// Couché sur le côté gauche, hanches et genoux pliés, pieds joints : le genou droit s'ouvre.
const clamBase = {
  pelvis: [0, 13, 0] as Vec,
  lean: 90,
  ...SIDE,
  armL: local([2, TRUNK + 30, -9], [-1, 0, 0]),
  armR: local([12, 20, 2], [0, 0, 1]),
  legL: local([0.3, -34.3, -4], [1, 0, 0]),
};
const clamClosed: Pose = { ...clamBase, legR: local([0.3, -34.3, 4], [1, 0, 0]) };
const clamOpen: Pose = { ...clamBase, legR: local([0.3, -34.3, 4], [0.5, 0, 1]) };

export const KNEE: Record<string, Animation> = {
  'wall-sit': anim(
    { yaw: 58, pitch: 12 },
    [
      [wallSitUp, 1.4, 0.8],
      [wallSitDown, 2, 3],
    ],
    [wall(WALL_X - 10)],
  ),
  'spanish-squat': anim(
    { yaw: 35, pitch: 10 },
    [
      [spanishUp, 1.2, 0.6],
      [spanishDown, 2, 3],
    ],
    [...table(SPANISH_TABLE, SPANISH_TABLE + 40), band([SPANISH_TABLE + 2, 24, -21], 'kneeL'), band([SPANISH_TABLE + 2, 24, 21], 'kneeR')],
  ),
  'step-down': anim(
    { yaw: 28, pitch: 10 },
    [
      [stepUp, 1.2, 0.6],
      [stepDown, 3, 0.3],
    ],
    [block(-18, 5, STEP_H)],
  ),
  'calf-eccentric': anim(
    { yaw: 18, pitch: 10 },
    [
      [calfDown, 0.8, 0.3],
      [calfUp, 1, 0.4],
      [calfSingle, 3, 0.4],
    ],
    [block(CALF_EDGE, 26, STEP_H)],
  ),
  'band-walk': anim({ yaw: 80, pitch: 10 }, rep(walkA, walkB, 0.9, 0.9, 0.3, 0.3), [band('kneeL', 'kneeR')]),
  'side-plank-abduction': anim({ yaw: 0, pitch: 12 }, rep(sidePlank(false), sidePlank(true), 1.2, 1.2, 0.3, 0.4)),
  'band-glute-bridge': anim({ yaw: 35, pitch: 24 }, rep(bandBridgeDown, bandBridgeUp, 1.2, 1, 0.3, 1), [band('kneeL', 'kneeR')]),
  'band-clamshell': anim({ yaw: 0, pitch: 28 }, rep(clamClosed, clamOpen, 1.4, 1, 0.3, 0.4), [band('kneeL', 'kneeR')]),
};

/** Gainage latéral tenu (famille gainage). */
export const SIDE_PLANK_HOLD = hold(sidePlank(false), [0, 0.8, 0]);
