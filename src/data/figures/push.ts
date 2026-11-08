/**
 * Animations « pousser » (J8) : pompes et leurs variantes, pousser vertical, dips, volume pompes.
 * Repère et outils : voir kit.ts.
 */
import type { Animation, Pose, Vec } from '../../domain/figure';
import {
  aim,
  anim,
  ANK,
  arms,
  ARM,
  band,
  BENCH_H,
  block,
  BODY_LINE,
  dipBars,
  FOOT_TOES,
  handles,
  legs,
  localArms,
  localLegs,
  LEG,
  mirror,
  ON_HANDLES,
  plankAt,
  plankOnHands,
  rep,
  STAND,
  straight,
  strapDoor,
  straps,
  table,
  TABLE_H,
  TRUNK,
  wall,
} from './kit';

const PROFILE = { yaw: 22, pitch: 12 };

/** Chevilles d'une pompe au sol : sur les orteils. */
const TOES_Y = 9;

interface PushupOptions {
  /** Chevilles (milieu). */
  ankles: Vec;
  /** Hauteur des poignets (poignées, table…). */
  wristY: number;
  /** Demi-écart des mains. */
  handZ: number;
  /** Hauteur des épaules en bas du mouvement. */
  bottomY: number;
  /** Coudes : vers l'arrière, à 45° (écartés) ou serrés. */
  elbowsOut?: number;
  pack?: boolean;
}

/**
 * Pompe : en haut bras tendus, en bas les épaules un peu devant les mains, coudes pliés vers
 * l'arrière. Les mains sont placées pour que le bas du mouvement tombe juste.
 */
function pushup(o: PushupOptions): { top: Pose; bottom: Pose; handX: number } {
  const reach = Math.sqrt(BODY_LINE * BODY_LINE - (o.bottomY - o.ankles[1]) ** 2);
  // Épaules un peu devant les mains en bas du mouvement.
  const handX = o.ankles[0] + reach - 7;
  const limbs = {
    ...arms(handX, o.wristY, o.handZ, [-1, 0.8, o.elbowsOut ?? 0.6], [1, 0, 0]),
    ...legs(o.ankles[0], o.ankles[1], 7, [0, -1, 0], FOOT_TOES),
    ...(o.pack ? { pack: true } : {}),
  };
  return {
    top: { ...plankOnHands(o.ankles, [handX, o.wristY, 0], o.handZ), ...limbs },
    bottom: { ...plankAt(o.ankles, o.bottomY), ...limbs },
    handX,
  };
}

const floor = pushup({ ankles: [-52, TOES_Y, 0], wristY: ON_HANDLES, handZ: 13, bottomY: ON_HANDLES + 11 });
const close = pushup({ ankles: [-52, TOES_Y, 0], wristY: ON_HANDLES, handZ: 7, bottomY: ON_HANDLES + 11, elbowsOut: 0.1 });
const incline = pushup({ ankles: [-62, TOES_Y, 0], wristY: TABLE_H + 2, handZ: 14, bottomY: TABLE_H + 9 });
const feetUp = pushup({ ankles: [-52, BENCH_H + TOES_Y, 0], wristY: ON_HANDLES, handZ: 13, bottomY: ON_HANDLES + 11 });
const decline = pushup({ ankles: [-52, BENCH_H + TOES_Y, 0], wristY: ON_HANDLES, handZ: 13, bottomY: ON_HANDLES + 11, pack: true });

// ─── Pompes archer ───
// Mains très écartées ; on descend vers une main (ce coude plie), l'autre bras reste tendu.
const ARCHER_X = 20;
const ARCHER_Z = 34;
const ARCHER_ANKLES: Vec = [-52, TOES_Y, 0];
const archerLimbs = {
  ...arms(ARCHER_X, ON_HANDLES, ARCHER_Z, [-1, 1, 0.3], [1, 0, 0]),
  ...legs(ARCHER_ANKLES[0], ARCHER_ANKLES[1], 7, [0, -1, 0], FOOT_TOES),
};
const archerUp: Pose = { ...straight(ARCHER_ANKLES, [ARCHER_X, 27, 0]), ...archerLimbs };
const archerRight: Pose = { ...straight(ARCHER_ANKLES, [ARCHER_X + 1, 17, 5]), ...archerLimbs };

// ─── Pompes aux sangles ───
// Dos à l'ancrage (porte derrière les pieds), corps penché presque à l'horizontale, poignées
// sous les épaules : les sangles passent au-dessus du dos.
const strapsDoor = strapDoor(-66, true);
const strapsAnkles: Vec = [-55, TOES_Y, 0];
const strapsTop: Pose = {
  ...straight(strapsAnkles, [12, 50, 0]),
  ...arms(13, 16.5, 13, [-1, 0.8, 0.6]),
  ...legs(strapsAnkles[0], strapsAnkles[1], 7, [0, -1, 0], FOOT_TOES),
};
const strapsBottom: Pose = { ...strapsTop, ...straight(strapsAnkles, [22, 30, 0]), ...arms(13, 15, 17, [-1, 0.8, 0.6]) };

// ─── Pike push-up ───
// Corps en V inversé, bras dans le prolongement du tronc ; la tête descend devant les mains.
const PIKE_HANDS: Vec = [0, ON_HANDLES, 0];
const pikeArms = (bendBack: number) => arms(PIKE_HANDS[0], PIKE_HANDS[1], 12, [-1, bendBack, 0.5], [1, 0, 0]);
const pikeLegs = legs(-58, 8, 6, [1, 0, 0], [0.4, -0.92, 0]);
// En haut, bras tendus : le bassin est à « tronc + bras » des mains, dans l'axe.
const pikeUp: Pose = { ...aim([-41.5, 50.5, 0], PIKE_HANDS), ...pikeArms(0), ...pikeLegs };
const pikeDown: Pose = { pelvis: [-25, 42, 0], lean: 140, ...pikeArms(0.3), ...pikeLegs };

// Pieds sur une chaise : hanches au-dessus des épaules, buste plus vertical.
const pikeHighLegs = legs(-52, BENCH_H + 8, 6, [1, 0, 0], [0.5, -0.86, 0]);
const pikeHighUp: Pose = { ...aim([-20, 63, 0], PIKE_HANDS), ...pikeArms(0), ...pikeHighLegs };
const pikeHighDown: Pose = { pelvis: [-12, 50, 0], lean: 160, ...pikeArms(0.3), ...pikeHighLegs };

// ─── Appui renversé dos au mur ───
// Mains au sol, talons contre le mur ; la tête descend vers le sol, coudes vers l'avant.
const HS_WALL = 18;
const hsArms = arms(0, 3, 12, [-1, 0, 0.3], [-1, 0, 0]);
function handstand(chestY: number): Pose {
  const pelvis: Vec = [0, chestY + TRUNK, 0];
  return {
    pelvis,
    lean: 180,
    ...hsArms,
    ...legs(HS_WALL - 4, pelvis[1] + LEG - 2, 6, [-1, 0, 0], [0, 1, 0]),
  };
}
const hsTop = handstand(3 + ARM);
const hsPartial = handstand(3 + ARM - 7);
const hsFull = handstand(19);

// ─── Développé élastique debout ───
const pressBottom: Pose = {
  pelvis: [0, STAND, 0],
  lean: 0,
  ...localArms(3, TRUNK + 2.5, 22, [0, -1, 0.5]),
  ...legs(0, ANK, 9),
};
const pressTop: Pose = { ...pressBottom, ...localArms(2, TRUNK + ARM, 11, [0, -1, 0.5]) };

// ─── Dips ───
// Aux sangles : pieds au sol devant, les jambes aident ; aux barres : jambes pliées derrière.
const dipsStrapsTop: Pose = {
  pelvis: [0, 45.5, 0],
  lean: 4,
  ...arms(0, 42, 15, [-1, 0, 0.3], [1, 0, 0]),
  ...legs(22, ANK, 8, [1, 0.4, 0]),
};
const dipsStrapsBottom: Pose = { ...dipsStrapsTop, pelvis: [-5, 32, 0], lean: 10 };
const BARS_Y = 70;
const dipsTop: Pose = {
  pelvis: [0, BARS_Y + ARM - TRUNK + 1, 0],
  lean: 3,
  ...arms(0, BARS_Y + 2, 16, [-1, 0, 0.2], [1, 0, 0]),
  ...localLegs(-14, -37, 6, [1, 0, 0]),
};
const dipsBottom: Pose = { ...dipsTop, ...aim([-8, BARS_Y - 4, 0], [3, BARS_Y + 22, 0]) };

export const PUSH: Record<string, Animation> = {
  'pushup-incline': anim(PROFILE, rep(incline.top, incline.bottom), table(incline.handX, incline.handX + 40)),
  pushup: anim(PROFILE, rep(floor.top, floor.bottom), handles(floor.handX, 13)),
  'pushup-tempo': anim(PROFILE, rep(floor.top, floor.bottom, 3, 1, 0.4, 1), handles(floor.handX, 13)),
  'pushup-feet-up': anim(PROFILE, rep(feetUp.top, feetUp.bottom), [...handles(feetUp.handX, 13), block(-62, -40, BENCH_H)]),
  'pushup-straps': anim(PROFILE, rep(strapsTop, strapsBottom), strapsDoor.props),
  'pushup-close': anim(PROFILE, rep(close.top, close.bottom), handles(close.handX, 7)),
  'pushup-archer': anim(
    { yaw: 48, pitch: 26 },
    [
      [archerUp, 1.2, 0.3],
      [archerRight, 1.6, 0.2],
      [archerUp, 1.2, 0.3],
      [mirror(archerRight), 1.6, 0.2],
    ],
    handles(ARCHER_X, ARCHER_Z),
  ),
  'pushup-decline-weighted': anim(PROFILE, rep(decline.top, decline.bottom), [...handles(decline.handX, 13), block(-62, -40, BENCH_H)]),
  'pushup-max-set': anim(PROFILE, rep(floor.top, floor.bottom, 1.2, 0.9, 0.2, 0.1), handles(floor.handX, 13)),

  'pike-pushup': anim({ yaw: 10, pitch: 6 }, rep(pikeUp, pikeDown), handles(PIKE_HANDS[0], 12)),
  'pike-pushup-elevated': anim({ yaw: 10, pitch: 6 }, rep(pikeHighUp, pikeHighDown), [...handles(PIKE_HANDS[0], 12), block(-62, -40, BENCH_H)]),
  'band-press': anim({ yaw: 55, pitch: 8 }, rep(pressBottom, pressTop, 1.4, 1, 0.3, 0.3), [band('footL', 'handL'), band('footR', 'handR')]),
  'wall-hspu-partial': anim({ yaw: 12, pitch: 6 }, rep(hsTop, hsPartial, 1.4, 1, 0.4, 0.2), [wall(HS_WALL)]),
  'wall-hspu': anim({ yaw: 12, pitch: 6 }, rep(hsTop, hsFull, 2, 1.2, 0.4, 0.3), [wall(HS_WALL)]),

  'dips-straps-assisted': anim({ yaw: 30, pitch: 8 }, rep(dipsStrapsTop, dipsStrapsBottom), [
    { kind: 'bar', from: [0, 112, -26], to: [0, 112, 26] },
    ...straps([0, 112, 0], ['handL', 'handR'], 15),
  ]),
  'dips-bars': anim({ yaw: 30, pitch: 10 }, rep(dipsTop, dipsBottom), dipBars(BARS_Y, 16)),
  'dips-weighted': anim({ yaw: 30, pitch: 10 }, rep({ ...dipsTop, pack: true }, { ...dipsBottom, pack: true }), dipBars(BARS_Y, 16)),
};
