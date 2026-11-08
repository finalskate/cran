/**
 * Animations bras et épaules (J8) : curls et extensions triceps (sangles, élastique), pull-apart,
 * face pull, Y-T-W. Repère et outils : voir kit.ts.
 */
import type { Animation, Pose, Vec } from '../../domain/figure';
import {
  anim,
  ANK,
  ARM,
  atTrunk,
  band,
  box,
  DOOR_TOP,
  FOOT_FLAT,
  FOOT_TOES,
  HANGING,
  inclined,
  legs,
  limb,
  local,
  localArms,
  LYING,
  reachFor,
  rep,
  SHOULDER,
  STAND,
  strapDoor,
  TRUNK,
} from './kit';

const PROFILE = { yaw: 22, pitch: 10 };
const FRONT = { yaw: 62, pitch: 10 };

// ─── Curls aux sangles ───
// Face à l'ancrage, penché en arrière, bras tendus ; on plie les coudes (qui restent à hauteur
// d'épaules) et les mains viennent vers le front.
interface StrapOptions {
  from: number;
  to: number;
  ankles: Vec;
  anchor: Vec;
  feet?: Vec;
  /** Un seul bras (le droit) ; l'autre le long du corps. */
  single?: boolean;
}

function strapCurl(o: StrapOptions): { start: Pose; end: Pose } {
  const lg = legs(o.ankles[0], o.ankles[1], 8, [1, 0, 0], o.feet ?? FOOT_FLAT);
  const a = inclined(o.ankles, -o.from);
  const b = inclined(o.ankles, -o.to);
  const bend: Vec = [1, -0.4, 0.2];
  const startArms = reachFor(a, o.anchor, bend);
  const endArms = {
    armL: limb(atTrunk(b, [9, TRUNK + 12, -6]), [bend[0], bend[1], -bend[2]]),
    armR: limb(atTrunk(b, [9, TRUNK + 12, 6]), bend),
  };
  if (!o.single) return { start: { ...a, ...startArms, ...lg }, end: { ...b, ...endArms, ...lg } };
  return {
    start: { ...a, armL: HANGING.armL, armR: startArms.armR, ...lg },
    end: { ...b, armL: HANGING.armL, armR: endArms.armR, ...lg },
  };
}

const curlEasyDoor = strapDoor(50);
const curlDoor = strapDoor(8);
const curlEasy = strapCurl({ from: 20, to: 12, ankles: [0, ANK, 0], anchor: curlEasyDoor.anchor });
const curlInclined = strapCurl({ from: 38, to: 30, ankles: [0, ANK, 0], anchor: curlDoor.anchor, feet: [0.85, 0.5, 0] });
const curlLow = strapCurl({ from: 56, to: 48, ankles: [0, ANK, 0], anchor: curlDoor.anchor, feet: [0.85, 0.5, 0] });
const curlSingle = strapCurl({ from: 36, to: 28, ankles: [0, ANK, 0], anchor: curlDoor.anchor, feet: [0.85, 0.5, 0], single: true });

// ─── Extensions triceps aux sangles ───
// Dos à l'ancrage, penché en avant, bras tendus devant ; on plie seulement les coudes (pointés
// vers l'avant) et les mains passent au-dessus de la tête.
function strapTriceps(from: number, to: number, onToes: boolean): { start: Pose; end: Pose } {
  const lg = onToes ? legs(0, ANK + 5, 8, [1, 0, 0], FOOT_TOES) : legs(0, ANK, 8, [1, 0, 0], FOOT_FLAT);
  return {
    start: { ...inclined([0, ANK, 0], from), ...localArms(ARM - 1, TRUNK, SHOULDER + 0.5, [0, -1, 0]), ...lg },
    end: { ...inclined([0, ANK, 0], to), ...localArms(4, TRUNK + 13, 7, [1, 0.4, 0.2]), ...lg },
  };
}
const tricepsDoor = strapDoor(-8, true);
const tricepsEasy = strapTriceps(14, 22, false);
const tricepsInclined = strapTriceps(30, 38, true);
const tricepsLow = strapTriceps(48, 56, true);

// ─── À l'élastique, debout ───
const standing = { pelvis: [0, STAND, 0] as Vec, lean: 2 };
const curlBandDown: Pose = { ...standing, ...localArms(3, TRUNK - ARM + 1, SHOULDER + 1.5, [-1, 0, 0]), ...legs(2, ANK, 9) };
const curlBandUp: Pose = { ...curlBandDown, ...localArms(12, TRUNK - 4, SHOULDER + 0.5, [-1, -0.2, 0]) };

// Au-dessus de la tête : fente, élastique sous le pied arrière.
const splitLegs = { legL: limb([10, ANK, -8], [1, 0, 0]), legR: limb([-16, ANK + 3, 8], [1, 0, 0], [0.6, -0.8, 0]) };
const overheadDown: Pose = { pelvis: [-2, STAND - 1.5, 0], lean: 4, ...localArms(-7, TRUNK + 12, 4, [0.3, 1, 0.3]), ...splitLegs };
const overheadUp: Pose = { ...overheadDown, ...localArms(0, TRUNK + ARM - 1, 6, [0.3, 1, 0.3]) };

// Ancré en haut : coudes au corps, on pousse vers le bas.
const pushdownDoor = 26;
const pushdownUp: Pose = { ...standing, ...localArms(15, TRUNK - 17, SHOULDER + 0.5, [-1, 0, 0]), ...legs(2, ANK, 9) };
const pushdownDown: Pose = { ...pushdownUp, ...localArms(4, TRUNK - ARM + 1, SHOULDER + 1.5, [-1, 0, 0]) };
const pushdownBand = [
  box([pushdownDoor, 0, -16], [pushdownDoor + 2.5, DOOR_TOP + 4, 16], 'wall'),
  band([pushdownDoor - 1, DOOR_TOP - 4, -2], 'handL'),
  band([pushdownDoor - 1, DOOR_TOP - 4, 2], 'handR'),
];

// ─── Épaules ───
const apartStart: Pose = { ...standing, ...localArms(ARM - 1, TRUNK, 8, [0, -1, 0]), ...legs(2, ANK, 9) };
const apartEnd: Pose = { ...apartStart, ...localArms(4, TRUNK, SHOULDER + 29.5, [0, -1, 0]) };

const FACE_DOOR = 55;
const faceAnchor: Vec = [FACE_DOOR - 1, 86, 0];
const facePullStart: Pose = { ...standing, ...reachFor(standing, faceAnchor, [-0.2, 0.4, 1], 2), ...legs(2, ANK, 9) };
const facePullEnd: Pose = {
  ...standing,
  armL: limb(atTrunk(standing, [10, TRUNK + 12, -13]), [-0.2, 0.4, -1]),
  armR: limb(atTrunk(standing, [10, TRUNK + 12, 13]), [-0.2, 0.4, 1]),
  ...legs(2, ANK, 9),
};

// Y-T-W : à plat ventre, front au sol, bras décollés en Y, puis en T, puis en W.
const prone = { pelvis: [0, LYING, 0] as Vec, lean: 90, nod: 15, ...legs(-47.5, 4, 6, [0, 1, 0], [-1, -0.2, 0]) };
const ytwArms = (f: number, u: number, r: number, bend: Vec) => ({
  armL: local([f, u, -r], [bend[0], bend[1], -bend[2]]),
  armR: local([f, u, r], bend),
});
const ytwY: Pose = { ...prone, ...ytwArms(-5, TRUNK + 26, SHOULDER + 16, [0, -1, 0]) };
const ytwT: Pose = { ...prone, ...ytwArms(-5, TRUNK, SHOULDER + 30.5, [0, -1, 0]) };
const ytwW: Pose = { ...prone, ...ytwArms(-5, TRUNK + 6, SHOULDER + 15.5, [0, -1, 1]) };

export const ARMS: Record<string, Animation> = {
  'curl-straps-easy': anim(PROFILE, rep(curlEasy.start, curlEasy.end, 1.6, 1, 0.3, 0.3), curlEasyDoor.props),
  'curl-band': anim(PROFILE, rep(curlBandDown, curlBandUp, 1.8, 1, 0.3, 0.2), [band('footL', 'handL'), band('footR', 'handR')]),
  'curl-straps': anim(PROFILE, rep(curlInclined.start, curlInclined.end, 1.6, 1, 0.3, 0.3), curlDoor.props),
  'curl-band-tempo': anim(PROFILE, rep(curlBandDown, curlBandUp, 3, 1, 0.3, 0.2), [band('footL', 'handL'), band('footR', 'handR')]),
  'curl-straps-low': anim(PROFILE, rep(curlLow.start, curlLow.end, 1.6, 1, 0.3, 0.3), curlDoor.props),
  'curl-straps-single': anim({ yaw: 40, pitch: 10 }, rep(curlSingle.start, curlSingle.end, 1.6, 1, 0.3, 0.3), [
    curlDoor.props[0]!,
    { kind: 'cord', from: curlDoor.anchor, to: 'handR', tone: 'strap' },
  ]),

  'triceps-straps-easy': anim(PROFILE, rep(tricepsEasy.start, tricepsEasy.end, 1.6, 1, 0.3, 0.3), tricepsDoor.props),
  'triceps-band-overhead': anim(PROFILE, rep(overheadDown, overheadUp, 1.6, 1, 0.3, 0.3), [band('footR', 'handL'), band('footR', 'handR')]),
  'triceps-band-pushdown': anim(PROFILE, rep(pushdownUp, pushdownDown, 1, 1.6, 0.3, 0.3), pushdownBand),
  'triceps-straps': anim(PROFILE, rep(tricepsInclined.start, tricepsInclined.end, 1.6, 1, 0.3, 0.3), tricepsDoor.props),
  'triceps-band-tempo': anim(PROFILE, rep(overheadDown, overheadUp, 3, 1, 0.3, 0.3), [band('footR', 'handL'), band('footR', 'handR')]),
  'triceps-straps-low': anim(PROFILE, rep(tricepsLow.start, tricepsLow.end, 1.6, 1, 0.3, 0.3), tricepsDoor.props),

  'band-pull-apart': anim(FRONT, rep(apartStart, apartEnd, 1.4, 1, 0.3, 0.4), [band('handL', 'handR')]),
  'band-face-pull': anim(PROFILE, rep(facePullStart, facePullEnd, 1.4, 1, 0.3, 0.5), [
    box([FACE_DOOR, 0, -16], [FACE_DOOR + 2.5, DOOR_TOP + 4, 16], 'wall'),
    band(faceAnchor, 'handL'),
    band(faceAnchor, 'handR'),
  ]),
  'ytw-floor': anim({ yaw: 50, pitch: 35 }, [
    [ytwY, 1, 0.6],
    [ytwT, 1, 0.6],
    [ytwW, 1, 0.6],
  ]),
};
