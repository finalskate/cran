/**
 * Animations « jambes » (J8) : squats, fentes, pistols, ponts fessiers, soulevé de terre, leg curl.
 * Repère et outils : voir kit.ts.
 */
import type { Animation, Pose, Vec } from '../../domain/figure';
import {
  aim,
  anim,
  ANK,
  arms,
  ARM,
  block,
  chestOf,
  door,
  DOOR_TOP,
  FOOT_FLAT,
  legs,
  limb,
  LYING,
  mirror,
  ON_HIPS,
  rep,
  STAND,
  straps,
  TRUNK,
  BENCH_H,
} from './kit';

const PROFILE = { yaw: 25, pitch: 10 };
const SUPINE_VIEW = { yaw: 18, pitch: 16 };

/** Pieds largeur d'épaules, pointes un peu ouvertes ; genoux dans l'axe des pieds. */
const SQUAT_FEET = legs(6, ANK, 10, [1, 0, 0.25], [1, -0.35, 0.3]);

/** Bras tendus devant à l'horizontale (équilibre), depuis les épaules d'une position. */
function armsForward(p: Pick<Pose, 'pelvis' | 'lean'>, drop = 0): Pick<Pose, 'armL' | 'armR'> {
  const c = chestOf(p);
  return arms(c[0] + Math.sqrt(ARM * ARM - drop * drop) - 1, c[1] - drop, 9, [0, -1, 0]);
}

/** Bras pendants (coordonnées du monde : compatibles avec des positions penchées). */
function armsDown(p: Pick<Pose, 'pelvis' | 'lean'>, forward = 1): Pick<Pose, 'armL' | 'armR'> {
  const c = chestOf(p);
  return arms(c[0] + forward, c[1] - ARM + 1, 12, [-1, 0, 0]);
}

// ─── Squats ───
const standTrunk = { pelvis: [0, STAND, 0] as Vec, lean: 3 };
const squatTop: Pose = { ...standTrunk, ...armsDown(standTrunk), ...SQUAT_FEET };
const boxBottomTrunk = { pelvis: [-14, 31, 0] as Vec, lean: 35 };
const boxBottom: Pose = { ...boxBottomTrunk, ...armsForward(boxBottomTrunk, 4), ...SQUAT_FEET };
const squatBottomTrunk = { pelvis: [-12, 27, 0] as Vec, lean: 40 };
const squatBottom: Pose = { ...squatBottomTrunk, ...armsForward(squatBottomTrunk, 2), ...SQUAT_FEET };

// ─── Fente arrière ───
// La jambe droite recule, genou arrière qui frôle le sol ; puis l'autre côté.
const lungeStand: Pose = { pelvis: [0, STAND, 0], lean: 2, ...ON_HIPS, ...legs(2, ANK, 7) };
const lungeRight: Pose = {
  pelvis: [-8, 30, 0],
  lean: 5,
  ...ON_HIPS,
  legL: limb([14, ANK, -8], [1, 0, 0]),
  legR: limb([-34, 8, 8], [0, -1, 0], [0.5, -0.87, 0]),
};

// ─── Squat bulgare ───
const bulgarianTop: Pose = {
  pelvis: [-6, 46, 0],
  lean: 6,
  ...ON_HIPS,
  legL: limb([14, ANK, -8], [1, 0, 0]),
  legR: limb([-40, BENCH_H + 6, 8], [0, -1, 0], [-0.9, -0.45, 0]),
};
const bulgarianBottom: Pose = { ...bulgarianTop, pelvis: [-9, 29, 0], lean: 14 };

// ─── Pistol ───
// Sur la jambe gauche, la droite tendue devant ; assisté : mains aux sangles.
const pistolTopTrunk = { pelvis: [0, STAND - 0.5, 0] as Vec, lean: 3 };
const pistolBottomTrunk = { pelvis: [-16, 21, 0] as Vec, lean: 40 };
const pistolLegsTop = { legL: limb([0, ANK, -6], [1, 0, 0]), legR: limb([22, 14, 7], [1, 0, 0]) };
const pistolLegsBottom = { legL: limb([0, ANK, -6], [1, 0, 0.1]), legR: limb([30, 20, 8], [0, 1, 0], [0.4, 0.9, 0]) };
const pistolTop: Pose = { ...pistolTopTrunk, ...armsForward(pistolTopTrunk, 2), ...pistolLegsTop };
const pistolBottom: Pose = { ...pistolBottomTrunk, ...armsForward(pistolBottomTrunk, 0), ...pistolLegsBottom };
const PISTOL_DOOR = 62;
const pistolAssistTop: Pose = { ...pistolTop, ...arms(24, 66, 11, [-1, -0.5, 0.3]) };
const pistolAssistBottom: Pose = { ...pistolBottom, ...arms(24, 46, 11, [-1, -0.5, 0.3]) };

// ─── Ponts fessiers (sur le dos, tête vers −x) ───
/** Tronc couché sur le dos, épaules posées vers `shoulderX`. */
const supine = (pelvis: Vec, shoulders: Vec = [-TRUNK, LYING, 0]) => aim(pelvis, shoulders);
const floorArms = arms(3, 3, 16, [-0.2, 1, 0], [1, 0, 0]);
const bridgeLegs = legs(22, ANK, 8, [0, 1, 0], FOOT_FLAT);
const bridgeDown: Pose = { ...supine([0, LYING, 0]), ...floorArms, ...bridgeLegs };
const bridgeUp: Pose = { ...supine([2, 26, 0]), ...floorArms, ...bridgeLegs };
const singleDown: Pose = { ...bridgeDown, legR: limb([40, 28, 8], [0, 1, 0]) };
const singleUp: Pose = { ...bridgeUp, legR: limb([44, 46, 8], [0, 1, 0]) };

// Hip thrust : haut du dos sur le banc derrière, un pied au sol.
const THRUST_BENCH = block(-44, -20, 23);
const thrustArms = arms(-22, 26, 22, [0, 1, 0]);
const thrustUp: Pose = {
  ...aim([0, 30, 0], [-30, 31, 0]),
  ...thrustArms,
  legL: limb([16, ANK, -8], [1, 0, 0]),
  legR: limb([18, 46, 8], [1, 1, 0]),
};
const thrustDown: Pose = { ...thrustUp, ...aim([-6, 11, 0], [-30, 29, 0]), legR: limb([12, 30, 8], [0, 1, 0]) };

// ─── Soulevé de terre une jambe ───
// Sac dans la main droite, sur la jambe gauche ; la jambe droite part tendue vers l'arrière.
const rdlTopTrunk = { pelvis: [0, STAND - 0.5, 0] as Vec, lean: 0 };
const rdlBottomTrunk = { pelvis: [-4, 49, 0] as Vec, lean: 80 };
const rdlTop: Pose = { ...rdlTopTrunk, ...armsDown(rdlTopTrunk), legL: limb([0, ANK, -7], [1, 0, 0]), legR: limb([-6, 8, 7], [1, 0, 0]), carry: 'R' };
const rdlBottom: Pose = {
  ...rdlBottomTrunk,
  ...armsDown(rdlBottomTrunk, 0),
  legL: limb([0, ANK, -7], [1, 0, 0]),
  legR: limb([-50, 41, 7], [0, -1, 0], [-0.2, -0.98, 0]),
  carry: 'R',
};

// ─── Leg curl aux sangles ───
// Sur le dos, talons dans les sangles : bassin haut, puis talons ramenés vers les fesses.
const CURL_DOOR = 58;
const curlStraight: Pose = { ...supine([0, 18, 0]), ...floorArms, ...legs(46, 15, 8, [0, 1, 0], [0.2, 0.98, 0]) };
const curlBent: Pose = { ...supine([2, 30, 0]), ...floorArms, ...legs(22, 15, 8, [0, 1, 0], [0.2, 0.98, 0]) };

export const LEGS: Record<string, Animation> = {
  'box-squat': anim(PROFILE, rep(squatTop, boxBottom, 2, 1.2, 0.4, 0.3), [block(-32, -8, 26, 16)]),
  squat: anim(PROFILE, rep(squatTop, squatBottom, 1.6, 1.1, 0.4, 0.2)),
  'squat-tempo': anim(PROFILE, rep(squatTop, squatBottom, 3, 1, 0.4, 1)),
  'reverse-lunge': anim(PROFILE, [
    [lungeStand, 1, 0.3],
    [lungeRight, 1.4, 0.2],
    [lungeStand, 1, 0.3],
    [mirror(lungeRight), 1.4, 0.2],
  ]),
  'bulgarian-split-squat': anim(PROFILE, rep(bulgarianTop, bulgarianBottom, 1.8, 1.1, 0.4, 0.2), [block(-56, -34, BENCH_H)]),
  'pistol-assisted': anim(PROFILE, rep(pistolAssistTop, pistolAssistBottom, 2.2, 1.6, 0.4, 0.3), [
    door(PISTOL_DOOR),
    ...straps([PISTOL_DOOR - 1, DOOR_TOP - 4, 0]),
  ]),
  pistol: anim(PROFILE, rep(pistolTop, pistolBottom, 2.2, 1.6, 0.4, 0.3)),

  'glute-bridge': anim(SUPINE_VIEW, rep(bridgeDown, bridgeUp, 1.2, 1, 0.3, 1)),
  'glute-bridge-single': anim(SUPINE_VIEW, rep(singleDown, singleUp, 1.2, 1, 0.3, 1)),
  'hip-thrust-single': anim(SUPINE_VIEW, rep(thrustDown, thrustUp, 1.2, 1, 0.3, 1), [THRUST_BENCH]),
  'single-leg-rdl': anim(PROFILE, rep(rdlTop, rdlBottom, 1.8, 1.4, 0.4, 0.3)),
  'leg-curl-straps': anim(SUPINE_VIEW, rep(curlStraight, curlBent, 1.8, 1.2, 0.4, 0.3), [
    door(CURL_DOOR),
    ...straps([CURL_DOOR - 1, DOOR_TOP - 4, 0], ['ankleL', 'ankleR'], 8),
  ]),
};
