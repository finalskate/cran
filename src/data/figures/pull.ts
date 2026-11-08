/**
 * Animations « tirer » (J8) : rowings (sangles, table, élastique), tractions et leurs substituts.
 * Repère et outils : voir kit.ts.
 */
import { add, type Animation, type Pose, type Prop, type Vec } from '../../domain/figure';
import {
  aim,
  anim,
  ANK,
  arms,
  ARM,
  atTrunk,
  band,
  BENCH_H,
  block,
  chestOf,
  door,
  FOOT_FLAT,
  FOOT_HEEL,
  inclined,
  LEG,
  legs,
  limb,
  localArms,
  localLegs,
  LYING,
  pullupBar,
  reachFor,
  rep,
  shoulderOf,
  strapDoor,
  straight,
  table,
  TABLE_H,
  toward,
  TRUNK,
} from './kit';

const PROFILE = { yaw: 22, pitch: 10 };

// ─── Rowing aux sangles ───
// Face à l'ancrage, corps gainé penché en arrière : bras tendus vers l'ancrage, puis coudes
// tirés vers l'arrière, mains aux côtes.

/** Mains aux côtes (fin de tirage). */
function toRibs(p: Pick<Pose, 'pelvis' | 'lean' | 'turn'>, bend: Vec): Pick<Pose, 'armL' | 'armR'> {
  return {
    armL: limb(atTrunk(p, [6, TRUNK - 9, -13]), [bend[0], bend[1], -bend[2]]),
    armR: limb(atTrunk(p, [6, TRUNK - 9, 13]), bend),
  };
}

interface RowOptions {
  /** Inclinaison du corps (degrés depuis la verticale), bras tendus puis en fin de tirage. */
  from: number;
  to: number;
  ankles: Vec;
  /** Ancrage (haut de porte, barre…). */
  anchor: Vec;
  feet?: Vec;
}

function strapRow(o: RowOptions): { start: Pose; end: Pose } {
  const lg = legs(o.ankles[0], o.ankles[1], 8, [1, 0, 0], o.feet ?? FOOT_FLAT);
  const a = inclined(o.ankles, -o.from);
  const b = inclined(o.ankles, -o.to);
  return {
    start: { ...a, ...reachFor(a, o.anchor, [-1, -0.3, 0.3]), ...lg },
    end: { ...b, ...toRibs(b, [-1, -0.3, 0.4]), ...lg },
  };
}

// L'ancrage est à peu près dans l'axe des bras, perpendiculaire au corps en début de tirage.
const easyDoor = strapDoor(50);
const inclinedDoor = strapDoor(8);
const flatDoor = strapDoor(-91, true);
const feetUpDoor = strapDoor(-95, true);
const bentDoor = strapDoor(-82, true);
const archerDoor = strapDoor(10);

const rowEasy = strapRow({ from: 22, to: 12, ankles: [0, ANK, 0], anchor: easyDoor.anchor });
const rowInclined = strapRow({ from: 45, to: 33, ankles: [0, ANK, 0], anchor: inclinedDoor.anchor, feet: FOOT_HEEL });
const rowFlat = strapRow({ from: 72, to: 60, ankles: [0, ANK, 0], anchor: flatDoor.anchor, feet: FOOT_HEEL });
const rowFeetUp = strapRow({ from: 86, to: 74, ankles: [0, BENCH_H + 4, 0], anchor: feetUpDoor.anchor, feet: FOOT_HEEL });

// Genoux fléchis : bassin plus bas, pieds à plat près des fesses.
const bentLegs = legs(0, ANK, 8, [0, 1, 0], FOOT_FLAT);
const rowBentStartTrunk = aim([-38, 15, 0], [-70, 21, 0]);
const rowBentEndTrunk = aim([-36, 24, 0], [-60, 40, 0]);
const rowBentAnchor = bentDoor.anchor;
const rowBent = {
  start: { ...rowBentStartTrunk, ...reachFor(rowBentStartTrunk, rowBentAnchor, [-1, -0.3, 0.3]), ...bentLegs },
  end: { ...rowBentEndTrunk, ...toRibs(rowBentEndTrunk, [-1, -0.3, 0.4]), ...bentLegs },
};

// Rowing archer : le bras droit tire, le gauche s'ouvre sur le côté presque tendu.
const archerStartTrunk = inclined([0, ANK, 0], -40);
const archerEndTrunk = inclined([0, ANK, 0], -32);
const archerAnchor = archerDoor.anchor;
const archer = {
  start: { ...archerStartTrunk, ...reachFor(archerStartTrunk, archerAnchor, [-1, -0.3, 0.3]), ...legs(0, ANK, 8, [1, 0, 0], FOOT_HEEL) },
  end: {
    ...archerEndTrunk,
    armL: limb(toward(shoulderOf(archerEndTrunk, -1), [archerAnchor[0], archerAnchor[1], -28], ARM), [-1, -0.3, -0.3]),
    armR: limb(atTrunk(archerEndTrunk, [6, TRUNK - 9, 13]), [-1, -0.3, 0.4]),
    ...legs(0, ANK, 8, [1, 0, 0], FOOT_HEEL),
  } as Pose,
};

// ─── Rowing sous une table ───
// Allongé sous la table, mains au bord : on monte la poitrine jusqu'au bord.
function tableRow(ankles: Vec, bentKnees: boolean): { start: Pose; end: Pose; edge: number } {
  const lg = bentKnees ? legs(ankles[0], ankles[1], 8, [0, 1, 0], FOOT_FLAT) : legs(ankles[0], ankles[1], 8, [0, 1, 0], FOOT_HEEL);
  const startTrunk = bentKnees ? aim([-36, 10.5, 0], [-63, 13, 0]) : straight(ankles, [-80, 13, 0]);
  const edge = chestOf(startTrunk)[0];
  const endTrunk = bentKnees ? aim([-34, 23, 0], [edge, TABLE_H - 7, 0]) : straight(ankles, [edge + 4, TABLE_H - 7, 0]);
  const hands = arms(edge, TABLE_H + 0.5, 14, [-0.3, -1, 0.5], [-1, 0, 0]);
  return { start: { ...startTrunk, ...hands, ...lg }, end: { ...endTrunk, ...hands, ...lg }, edge };
}
const tableBent = tableRow([0, ANK, 0], true);
const tableStraight = tableRow([0, ANK, 0], false);
const tableFeetUp = tableRow([0, BENCH_H + 4, 0], false);
const underTable = (edge: number) => table(edge - 42, edge + 1);

// ─── Rowing élastique assis ───
const seatedStart: Pose = {
  pelvis: [0, LYING, 0],
  lean: -8,
  ...arms(26, 32, 10, [0, -1, 0.3]),
  ...legs(LEG - 1, ANK, 8, [0, 1, 0], [0.4, 0.9, 0]),
};
const seatedEnd: Pose = { ...seatedStart, lean: -14, ...toRibs({ pelvis: [0, LYING, 0], lean: -14 }, [-1, -0.2, 0.4]) };

// ─── Tractions ───
const BAR_Y = 124;
const GRIP = 13;
const barHands = arms(0, BAR_Y - 2, GRIP, [0.4, -1, 0.5], [0, 1, 0]);
const hangLegs = localLegs(-6, -44, 6, [1, 0, 0]);
const hangPose: Pose = { pelvis: [-2, BAR_Y - 2 - ARM - TRUNK + 0.5, 0], lean: 2, ...barHands, ...hangLegs };
const scapPose: Pose = { ...hangPose, pelvis: [-2, hangPose.pelvis[1] + 3.5, 0] };
const topPose: Pose = { ...hangPose, ...aim([-6, BAR_Y - 40, 0], [-1, BAR_Y - 10, 0]) };
const bandLegs: Pick<Pose, 'legL' | 'legR'> = { legL: hangLegs.legL, legR: { ...hangLegs.legR, to: [-14, -34, 6] } };
const bandBar: Prop[] = [band([0, BAR_Y, -2], 'footR'), band([0, BAR_Y, 2], 'footR')];

// ─── Tirage à genoux (substituts sans barre) ───
// À genoux sous l'ancrage, bras tendus vers le haut, puis coudes tirés vers les hanches.
const KNEEL_Y = 4 + 24.5;
const kneelLegs = legs(-24, 4, 8, [1, -1, 0], [-1, -0.1, 0]);
const kneelStart: Pose = { pelvis: [0, KNEEL_Y, 0], lean: -6, ...arms(10, KNEEL_Y + TRUNK + ARM - 3, 8, [0, -1, 0.5], [0, 1, 0]), ...kneelLegs };
const kneelEnd: Pose = { pelvis: [0, KNEEL_Y, 0], lean: -10, ...localArms(4, TRUNK + 3, 18, [0, -1, 0.6], [0, 1, 0]), ...kneelLegs };
const kneelDoor = strapDoor(22);

/** Suspendu à la barre, bras tendus (relevés de genoux et de jambes). */
export const HANG = hangPose;
export const BAR = { y: BAR_Y, props: pullupBar(0, BAR_Y) };

export const PULL: Record<string, Animation> = {
  'row-straps-easy': anim(PROFILE, rep(rowEasy.start, rowEasy.end, 1.4, 1, 0.3, 0.5), easyDoor.props),
  'row-band': anim(PROFILE, rep(seatedStart, seatedEnd, 1.4, 1, 0.3, 0.4), [band('footL', 'handL'), band('footR', 'handR')]),
  'row-straps-inclined': anim(PROFILE, rep(rowInclined.start, rowInclined.end, 1.4, 1, 0.3, 0.8), inclinedDoor.props),
  'row-table-bent': anim(PROFILE, rep(tableBent.start, tableBent.end, 1.4, 1, 0.3, 0.4), underTable(tableBent.edge)),
  'row-straps-horizontal-bent': anim(PROFILE, rep(rowBent.start, rowBent.end, 1.4, 1, 0.3, 0.4), bentDoor.props),
  'row-table-straight': anim(PROFILE, rep(tableStraight.start, tableStraight.end, 1.6, 1, 0.3, 0.4), underTable(tableStraight.edge)),
  'row-straps-horizontal': anim(PROFILE, rep(rowFlat.start, rowFlat.end, 1.6, 1, 0.3, 0.4), flatDoor.props),
  'row-table-feet-up': anim(PROFILE, rep(tableFeetUp.start, tableFeetUp.end, 1.6, 1, 0.3, 0.8), [...underTable(tableFeetUp.edge), block(-8, 14, BENCH_H)]),
  'row-straps-feet-up': anim(PROFILE, rep(rowFeetUp.start, rowFeetUp.end, 1.6, 1, 0.3, 0.6), [...feetUpDoor.props, block(-8, 14, BENCH_H)]),
  'row-straps-archer': anim({ yaw: 55, pitch: 12 }, rep(archer.start, archer.end, 1.6, 1.1, 0.3, 0.4), archerDoor.props),

  'scap-pulls': anim(PROFILE, rep(hangPose, scapPose, 1.2, 0.8, 0.6, 1), pullupBar(0, BAR_Y)),
  'pullup-negative': anim(PROFILE, [
    [topPose, 0.9, 0.6],
    [hangPose, 5, 0.6],
  ], pullupBar(0, BAR_Y)),
  'pullup-band': anim(PROFILE, rep({ ...hangPose, ...bandLegs }, { ...topPose, ...bandLegs }, 1.4, 1.2, 0.4, 0.3), [...pullupBar(0, BAR_Y), ...bandBar]),
  pullup: anim(PROFILE, rep(hangPose, topPose, 1.6, 1.2, 0.5, 0.3), pullupBar(0, BAR_Y)),
  'pullup-weighted': anim(PROFILE, rep({ ...hangPose, pack: true }, { ...topPose, pack: true }, 1.6, 1.2, 0.5, 0.3), pullupBar(0, BAR_Y)),
  'pulldown-band': anim(PROFILE, rep(kneelStart, kneelEnd, 1.4, 1, 0.3, 0.4), [
    door(22),
    band(add(kneelDoor.anchor, [0, 0, -2]), 'handL'),
    band(add(kneelDoor.anchor, [0, 0, 2]), 'handR'),
  ]),
  'pulldown-straps': anim(PROFILE, rep(kneelStart, kneelEnd, 1.4, 1, 0.3, 0.4), kneelDoor.props),
};
