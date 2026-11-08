/**
 * Animations gainage et abdos (J8) : planches, dead bug, hollow, Copenhague, fallout, body saw,
 * crunch inversé, relevés suspendus et aux sangles. Repère et outils : voir kit.ts.
 */
import { add, type Animation, type Pose, type Vec } from '../../domain/figure';
import { SIDE_PLANK_HOLD } from './knee';
import {
  aim,
  anim,
  ANK,
  ARM,
  arms,
  atTrunk,
  BENCH_H,
  block,
  box,
  chestOf,
  DOOR_TOP,
  FOOT_FLAT,
  FOOT_TOES,
  handles,
  hold,
  inclined,
  legs,
  limb,
  local,
  localLegs,
  LYING,
  mirror,
  ON_HANDLES,
  plankOnHands,
  pullupBar,
  rep,
  shoulderOf,
  straight,
  straps,
  toward,
  TRUNK,
} from './kit';
import { BAR, HANG } from './pull';

const PROFILE = { yaw: 22, pitch: 12 };
const SUPINE_VIEW = { yaw: 20, pitch: 18 };

// ─── Planches sur avant-bras ───
// Coudes sous les épaules (épaules à 20 du sol), corps gainé jusqu'aux orteils.
const PLANK_ANKLES: Vec = [-55, 9, 0];
function forearmPlank(ankles: Vec, chestX: number, wristX: number, wristZ = 9): Pose {
  return {
    ...straight(ankles, [chestX, 20.3, 0]),
    ...arms(wristX, 3, wristZ, [0, -1, 0], [1, 0, 0]),
    ...legs(ankles[0], ankles[1], 6, [0, -1, 0], FOOT_TOES),
  };
}
const plank = forearmPlank(PLANK_ANKLES, 19, 34);
const rkc = forearmPlank(PLANK_ANKLES, 19, 40, 6);

// ─── Sur le dos (tête vers −x) ───
const supine = (pelvis: Vec, shoulders: Vec = [-TRUNK, LYING, 0]) => aim(pelvis, shoulders);
/** Genoux au-dessus des hanches, tibias à l'horizontale (« table »). */
const TABLETOP = legs(24, 31, 8, [-1, 1, 0], [1, -0.2, 0]);

// Dead bug : bras vers le plafond ; un bras et la jambe opposée s'allongent, puis l'autre côté.
const deadBugBase: Pose = { ...supine([0, LYING, 0]), ...arms(-TRUNK, LYING + ARM - 1, 10.5, [-1, 0, 0], [0, 1, 0]), ...TABLETOP };
const deadBugReach: Pose = {
  ...deadBugBase,
  armR: limb([-TRUNK - ARM + 1, 10, 10.5], [0, 1, 0], [-1, 0, 0]),
  legL: limb([47, 10, -8], [0, 1, 0], [1, 0.2, 0]),
};

// Hollow body : épaules et jambes décollées, bras tendus derrière la tête.
const hollowTrunk = supine([0, LYING, 0], [-TRUNK, 14, 0]);
const hollowChest = chestOf(hollowTrunk);
const hollowDir: Vec = [(hollowChest[0] - 0) / TRUNK, (hollowChest[1] - LYING) / TRUNK, 0];
const hollow: Pose = {
  ...hollowTrunk,
  ...arms(hollowChest[0] + hollowDir[0] * (ARM - 1), hollowChest[1] + hollowDir[1] * (ARM - 1), 9, [0, 1, 0]),
  ...legs(46, 14, 5, [0, 1, 0], [1, 0.3, 0]),
};

// ─── Copenhague (couché sur le côté gauche, avant-bras au sol) ───
const SIDE = { twist: -90 };
function copenhagen(foot: boolean, up: boolean): Pose {
  const pelvis: Vec = foot ? [-24, up ? 27 : 16, 0] : [-18, up ? 27 : 16, 0];
  const trunk = aim(pelvis, [pelvis[0] + 27.2, 30.3, 0]);
  const c = chestOf({ ...trunk, ...SIDE });
  return {
    ...trunk,
    ...SIDE,
    armL: limb([c[0] + 2, 3, 15], [0, -1, 0], [0, 0, 1]),
    armR: local([2, 3, 12], [-1, 0, 0.5]),
    legL: limb([pelvis[0] - 22, 4.5, 0], [0, 0, 1], [0, 0, 1]),
    legR: limb(foot ? [-70, 30, 0] : [-64, 30, 0], [0, 0.4, 1], [0, 0, 1]),
  };
}

// ─── Fallout aux sangles ───
// Dos à l'ancrage, poignées en main : les bras montent devant, le corps descend gainé.
const FALL_FACE = -20;
const fallStartTrunk = inclined([0, ANK, 0], 18);
const fallEndTrunk = inclined([0, ANK, 0], 42);
const fallStart: Pose = {
  ...fallStartTrunk,
  armL: limb(toward(shoulderOf(fallStartTrunk, -1), atTrunk(fallStartTrunk, [30, -10, -12]), ARM), [-1, 0, -0.3]),
  armR: limb(toward(shoulderOf(fallStartTrunk, 1), atTrunk(fallStartTrunk, [30, -10, 12]), ARM), [-1, 0, 0.3]),
  ...legs(0, ANK, 8, [1, 0, 0], FOOT_FLAT),
};
const fallEnd: Pose = {
  ...fallEndTrunk,
  armL: limb(atTrunk(fallEndTrunk, [4, TRUNK + ARM - 1, -11]), [-1, 0, -0.3]),
  armR: limb(atTrunk(fallEndTrunk, [4, TRUNK + ARM - 1, 11]), [-1, 0, 0.3]),
  ...legs(0, ANK + 5, 8, [1, 0, 0], FOOT_TOES),
};

// ─── Body saw ───
// Planche sur avant-bras, pieds suspendus (sangles) ou sur une serviette : le corps glisse
// vers l'arrière puis revient, avant-bras fixes.
function saw(anklesY: number) {
  const front = forearmPlank([-55, anklesY, 0], 19, 34);
  const back = forearmPlank([-61, anklesY, 0], 13, 34);
  return { front, back };
}
const sawStraps = saw(16);
const sawTowel = saw(9);

// ─── Crunch inversé ───
const CRUNCH_ARMS = arms(0, 3, 16, [-0.2, 1, 0], [1, 0, 0]);
const crunchFlat: Pose = { ...supine([0, LYING, 0]), ...CRUNCH_ARMS, ...TABLETOP };
const crunchCurl: Pose = { ...supine([-3, 11, 0]), ...CRUNCH_ARMS, ...legs(-4, 36, 8, [-1, 0.3, 0], [0.5, 0.85, 0]) };

// ─── Suspendu à la barre ───
// Bassin enroulé (inclinaison vers l'arrière) : il avance un peu pour que les mains restent à la barre.
const kneeRaise: Pose = { ...HANG, pelvis: [4, 64.5, 0], lean: -10, ...localLegs(24, -24, 7, [1, 1, 0]) };
const legRaise: Pose = { ...HANG, pelvis: [4, 64.5, 0], lean: -12, ...localLegs(46, -6, 6, [0, 1, 0]) };

// ─── Aux sangles, en appui sur les mains ───
const TUCK_HANDS: Vec = [16, ON_HANDLES, 0];
const tuckAnkles: Vec = [-52, 22, 0];
const tuckArms = arms(TUCK_HANDS[0], TUCK_HANDS[1], 13, [-1, 0.8, 0.5], [1, 0, 0]);
const tuckTopTrunk = plankOnHands(tuckAnkles, TUCK_HANDS, 13);
const tuckPlank: Pose = { ...tuckTopTrunk, ...tuckArms, ...legs(tuckAnkles[0], tuckAnkles[1], 7, [0, -1, 0], FOOT_TOES) };
const tuckChest = chestOf(tuckTopTrunk);
const tuckIn: Pose = { ...aim([-12, 40, 0], tuckChest), ...tuckArms, ...legs(-26, 24, 7, [1, -1, 0], FOOT_TOES) };
// Pike : les épaules restent au-dessus des mains, le bassin monte.
const pikeUp: Pose = { ...aim(add(tuckChest, [-17.6, 21, 0]), tuckChest), ...tuckArms, ...legs(-30, 24, 7, [1, 0, 0], FOOT_TOES) };
const FEET_DOOR = -70;
const feetStraps = [box([FEET_DOOR - 2.5, 0, -16], [FEET_DOOR, DOOR_TOP + 4, 16], 'wall'), ...straps([FEET_DOOR + 1, DOOR_TOP - 4, 0], ['ankleL', 'ankleR'], 6)];

export const CORE: Record<string, Animation> = {
  plank: anim(PROFILE, hold(plank)),
  'rkc-plank': anim(PROFILE, hold(rkc, [0, 0.4, 0])),
  'dead-bug': anim(SUPINE_VIEW, [
    [deadBugBase, 1, 0.3],
    [deadBugReach, 1.6, 0.3],
    [deadBugBase, 1.2, 0.3],
    [mirror(deadBugReach), 1.6, 0.3],
  ]),
  'hollow-hold': anim(SUPINE_VIEW, hold(hollow, [0, 0.5, 0])),
  'side-plank': anim({ yaw: 0, pitch: 12 }, SIDE_PLANK_HOLD),
  'copenhagen-knee': anim({ yaw: 0, pitch: 14 }, rep(copenhagen(false, false), copenhagen(false, true), 1.2, 1.2, 0.4, 2), [block(-74, -40, BENCH_H, 14)]),
  'copenhagen-foot': anim({ yaw: 0, pitch: 14 }, rep(copenhagen(true, false), copenhagen(true, true), 1.2, 1.2, 0.4, 2), [block(-80, -60, BENCH_H, 14)]),
  'fallout-straps': anim(PROFILE, rep(fallStart, fallEnd, 2, 1.4, 0.4, 0.3), [
    box([FALL_FACE - 2.5, 0, -16], [FALL_FACE, DOOR_TOP + 4, 16], 'wall'),
    ...straps([FALL_FACE + 1, DOOR_TOP - 4, 0]),
  ]),
  'body-saw-straps': anim(PROFILE, rep(sawStraps.front, sawStraps.back, 1.4, 1.2, 0.3, 0.3), [
    ...pullupBar(-58, BAR.y),
    ...straps([-58, BAR.y, 0], ['ankleL', 'ankleR'], 6),
  ]),
  'body-saw-towel': anim(PROFILE, rep(sawTowel.front, sawTowel.back, 1.4, 1.2, 0.3, 0.3), [box([-70, 0, -12], [-46, 0.8, 12], 'soft')]),

  'reverse-crunch': anim(SUPINE_VIEW, rep(crunchFlat, crunchCurl, 1.6, 1, 0.3, 0.4)),
  'hanging-knee-raise': anim(PROFILE, rep(HANG, kneeRaise, 1.6, 1, 0.4, 0.5), BAR.props),
  'straps-knee-tuck': anim(PROFILE, rep(tuckPlank, tuckIn, 1.4, 1, 0.3, 0.4), [...handles(TUCK_HANDS[0], 13), ...feetStraps]),
  'hanging-leg-raise': anim(PROFILE, rep(HANG, legRaise, 1.8, 1.2, 0.4, 0.5), BAR.props),
  'straps-pike': anim(PROFILE, rep(tuckPlank, pikeUp, 1.6, 1.2, 0.3, 0.5), [...handles(TUCK_HANDS[0], 13), ...feetStraps]),
};
