/**
 * Boîte à outils des animations (J8) : mesures du mannequin, positions de base et matériel.
 *
 * Repère (src/domain/figure.ts) : x vers l'avant, y vers le haut, z vers la droite de la personne ;
 * 100 unités ≈ sa taille, sol à y = 0. Une position donne le bassin, l'inclinaison du tronc et la
 * cible des poignets et des chevilles ; coudes et genoux se placent seuls, du côté de `bend`.
 *
 * Les fonctions ci-dessous calculent les points qui doivent tomber juste (épaules au-dessus des
 * mains bras tendus, corps gainé des chevilles aux épaules…) pour que les longueurs des membres
 * soient respectées : les tests refusent un membre étiré.
 */
import {
  add,
  BODY,
  leanTurnOf,
  len,
  mul,
  norm,
  skeleton,
  sub,
  trunkFrame,
  type Animation,
  type Anchor,
  type Keyframe,
  type LimbPose,
  type Pose,
  type Prop,
  type Vec,
  type View,
} from '../../domain/figure';

/** Hauteur de la cheville, pied à plat. */
export const ANK = 3.5;
/** Jambe presque tendue, de la hanche à la cheville. */
export const LEG = BODY.thigh + BODY.shin - 1;
/** Du bassin aux épaules (centre de la ligne des épaules). */
export const TRUNK = BODY.torso - BODY.shoulderDrop;
/** Bras presque tendu, de l'épaule au poignet. */
export const ARM = BODY.upperArm + BODY.forearm - 0.6;
/** Corps gainé, des chevilles aux épaules. */
export const BODY_LINE = LEG + TRUNK;
/** Bassin debout. */
export const STAND = ANK + LEG;
/** Bassin couché (sur le dos, le ventre ou le côté). */
export const LYING = 6.5;
/** Demi-largeur des épaules et du bassin. */
export const SHOULDER = BODY.shoulderW / 2;
export const HIP = BODY.hipW / 2;

/** Côtés : gauche (z négatif) et droit. */
export const SIDES = [-1, 1] as const;
export type Side = (typeof SIDES)[number];

export const limb = (to: Vec, bend: Vec, dir?: Vec): LimbPose => (dir ? { to, bend, dir } : { to, bend });
/** Même chose dans le repère du tronc (avant, haut, droite), depuis le bassin. */
export const local = (to: Vec, bend: Vec, dir?: Vec): LimbPose => ({ ...limb(to, bend, dir), local: true });

/** Directions de pied : à plat vers l'avant, sur les orteils (planche), orteils en l'air (talon posé). */
export const FOOT_FLAT: Vec = [1, -0.35, 0];
export const FOOT_TOES: Vec = [0.35, -0.94, 0];
export const FOOT_HEEL: Vec = [0.85, 0.5, 0];

/** Les deux jambes, chevilles en (x, y), écartées de ±z, genoux vers `bend`. */
export function legs(x: number, y: number, z: number, bend: Vec = [1, 0, 0], dir?: Vec): Pick<Pose, 'legL' | 'legR'> {
  return {
    legL: limb([x, y, -z], [bend[0], bend[1], -bend[2]], dir),
    legR: limb([x, y, z], bend, dir),
  };
}

/** Les deux bras, poignets en (x, y), écartés de ±z, coudes vers `bend` (z symétrisé). */
export function arms(x: number, y: number, z: number, bend: Vec, dir?: Vec): Pick<Pose, 'armL' | 'armR'> {
  return {
    armL: limb([x, y, -z], [bend[0], bend[1], -bend[2]], dir),
    armR: limb([x, y, z], bend, dir),
  };
}

/** Même chose dans le repère du tronc. */
export function localArms(f: number, u: number, r: number, bend: Vec, dir?: Vec): Pick<Pose, 'armL' | 'armR'> {
  const d = dir ? ([dir[0], dir[1], -dir[2]] as Vec) : undefined;
  return {
    armL: local([f, u, -r], [bend[0], bend[1], -bend[2]], d),
    armR: local([f, u, r], bend, dir),
  };
}

export function localLegs(f: number, u: number, r: number, bend: Vec, dir?: Vec): Pick<Pose, 'legL' | 'legR'> {
  return {
    legL: local([f, u, -r], [bend[0], bend[1], -bend[2]], dir),
    legR: local([f, u, r], bend, dir),
  };
}

/** Bras le long du corps, détendus. */
export const HANGING = localArms(1.5, TRUNK - ARM + 1, SHOULDER + 1.5, [-1, 0, 0]);
/** Mains sur les hanches. */
export const ON_HIPS = localArms(3, 3, SHOULDER + 1.5, [-0.6, 0, 1], [1, -0.4, -0.2]);

/** Tronc orienté du bassin vers un point. */
export function aim(pelvis: Vec, toward: Vec): Pick<Pose, 'pelvis' | 'lean' | 'turn'> {
  return { pelvis, ...leanTurnOf(sub(toward, pelvis)) };
}

/** Corps gainé : bassin et tronc alignés des chevilles vers `toward` (planche, pompes, rowing). */
export function straight(ankles: Vec, toward: Vec, legLen = LEG): Pick<Pose, 'pelvis' | 'lean' | 'turn'> {
  const d = norm(sub(toward, ankles));
  return { pelvis: add(ankles, mul(d, legLen)), ...leanTurnOf(d) };
}

/** Épaules (centre) d'une position. */
export function chestOf(p: Pick<Pose, 'pelvis' | 'lean' | 'turn' | 'twist'>): Vec {
  return add(p.pelvis, mul(trunkFrame(p).up, TRUNK));
}

/** Épaule d'un côté. */
export function shoulderOf(p: Pick<Pose, 'pelvis' | 'lean' | 'turn' | 'twist'>, side: Side): Vec {
  return add(chestOf(p), mul(trunkFrame(p).right, side * SHOULDER));
}

/** Point dans le repère du tronc, en coordonnées du monde. */
export function atTrunk(p: Pick<Pose, 'pelvis' | 'lean' | 'turn' | 'twist'>, v: Vec): Vec {
  const f = trunkFrame(p);
  return add(p.pelvis, add(add(mul(f.front, v[0]), mul(f.up, v[1])), mul(f.right, v[2])));
}

/** Centre de la tête d'une position complète. */
export function headOf(p: Pose): Vec {
  return skeleton(p).head;
}

/** Point à `dist` de `from` en direction de `to`. */
export function toward(from: Vec, to: Vec, dist: number): Vec {
  return add(from, mul(norm(sub(to, from)), dist));
}

/**
 * Corps gainé appuyé sur les mains bras tendus (haut d'une pompe) : les épaules sont à `ARM` des
 * poignets et à `BODY_LINE` des chevilles. Renvoie la position du tronc (plus haute des deux solutions).
 */
export function plankOnHands(ankles: Vec, wrists: Vec, handHalfWidth: number): Pick<Pose, 'pelvis' | 'lean' | 'turn'> {
  const dz = Math.max(0, handHalfWidth - SHOULDER);
  const a = Math.sqrt(Math.max(1, ARM * ARM - dz * dz)) - 0.5;
  // Intersection de deux cercles dans le plan (x, y) : centre chevilles rayon BODY_LINE, centre poignets rayon a.
  const c1 = [ankles[0], ankles[1]];
  const c2 = [wrists[0], wrists[1]];
  const d = Math.hypot(c2[0]! - c1[0]!, c2[1]! - c1[1]!);
  const x = (BODY_LINE * BODY_LINE - a * a + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, BODY_LINE * BODY_LINE - x * x));
  const ux = (c2[0]! - c1[0]!) / d;
  const uy = (c2[1]! - c1[1]!) / d;
  const chest: Vec = [c1[0]! + ux * x - uy * h, c1[1]! + uy * x + ux * h, 0];
  return straight(ankles, chest);
}

/** Corps gainé, épaules à hauteur `chestY` (bas d'une pompe, planche…). */
export function plankAt(ankles: Vec, chestY: number, z = 0): Pick<Pose, 'pelvis' | 'lean' | 'turn'> {
  const dy = chestY - ankles[1];
  const dx = Math.sqrt(Math.max(0, BODY_LINE * BODY_LINE - dy * dy - z * z));
  return straight(ankles, [ankles[0] + dx, chestY, z]);
}

/**
 * Corps gainé incliné de `angle` degrés depuis la verticale (négatif : vers l'arrière),
 * chevilles fixes : rowing, curls et extensions aux sangles.
 */
export function inclined(ankles: Vec, angle: number): Pick<Pose, 'pelvis' | 'lean' | 'turn'> {
  const r = (angle * Math.PI) / 180;
  return straight(ankles, add(ankles, [Math.sin(r) * 10, Math.cos(r) * 10, 0]));
}

// ─── Animation ───

/** Une position clé : [position, secondes pour l'atteindre, secondes de maintien]. */
export type Step = [Pose, number, number?];

export function anim(view: View, steps: Step[], props: Prop[] = []): Animation {
  const frames: Keyframe[] = steps.map(([pose, move, hold]) => (hold ? { pose, move, hold } : { pose, move }));
  return props.length > 0 ? { view, frames, props } : { view, frames };
}

/** Aller-retour classique : départ, descente (excentrique), bas, remontée. */
export function rep(top: Pose, bottom: Pose, down = 1.6, up = 1.1, holdTop = 0.4, holdBottom = 0.2): Step[] {
  return [
    [top, up, holdTop],
    [bottom, down, holdBottom],
  ];
}

/** Maintien (gainage, isométrie) : une respiration lente, le bassin bouge à peine. */
export function hold(pose: Pose, breath: Vec = [0, 0.6, 0]): Step[] {
  return [
    [pose, 1.6, 0.6],
    [{ ...pose, pelvis: add(pose.pelvis, breath) }, 1.6, 0.6],
  ];
}

/** Le même pas, côté gauche puis côté droit (le côté droit est fourni, le gauche est son miroir). */
export function mirror(p: Pose): Pose {
  const flip = (v: Vec): Vec => [v[0], v[1], -v[2]];
  const m = (l: LimbPose): LimbPose => ({ ...l, to: flip(l.to), bend: flip(l.bend), ...(l.dir ? { dir: flip(l.dir) } : {}) });
  return {
    ...p,
    pelvis: flip(p.pelvis),
    turn: -(p.turn ?? 0),
    twist: -(p.twist ?? 0),
    armL: m(p.armR),
    armR: m(p.armL),
    legL: m(p.legR),
    legR: m(p.legL),
    ...(p.carry ? { carry: p.carry === 'L' ? 'R' : 'L' } : {}),
  };
}

// ─── Matériel ───

/** Boîte de `min` à `max`. */
export const box = (min: Vec, max: Vec, tone: 'wood' | 'wall' | 'soft' = 'wood'): Prop => ({ kind: 'box', min, max, tone });

/** Marche, banc, chaise vue comme un bloc : de x0 à x1, hauteur h. */
export const block = (x0: number, x1: number, h: number, z = 20): Prop => box([x0, 0, -z], [x1, h, z]);

/** Hauteurs utiles (en unités). */
export const STEP_H = 10;
export const BENCH_H = 25;
export const TABLE_H = 43;

/** Poignées de pompes sous les mains (règle poignet). */
export function handles(x: number, z: number): Prop[] {
  return SIDES.map((s) => box([x - 4, 0, s * z - 2.5], [x + 4, 5.5, s * z + 2.5], 'soft'));
}
/** Hauteur du poignet sur les poignées. */
export const ON_HANDLES = 8;

/** Mur (plan vertical à x), sur toute la largeur. */
export const wall = (x: number, side: 1 | -1 = 1, w = 30): Prop => box([side > 0 ? x : x - 3.5, 0, -w], [side > 0 ? x + 3.5 : x, 100, w], 'wall');

/** Porte (panneau) à x, avec son ancrage en haut ou en bas. */
export const door = (x: number): Prop => box([x, 0, -16], [x + 2.5, 112, 16], 'wall');
export const DOOR_TOP = 108;

/** Table : plateau et deux pieds visibles. */
export function table(x0: number, x1: number, z = 26): Prop[] {
  return [
    box([x0, TABLE_H - 3, -z], [x1, TABLE_H, z]),
    box([x0 + 1, 0, -z + 1], [x0 + 4, TABLE_H - 3, -z + 4]),
    box([x0 + 1, 0, z - 4], [x0 + 4, TABLE_H - 3, z - 1]),
  ];
}

/** Barre fixe (le long de z) avec ses montants. */
export function pullupBar(x: number, y: number, w = 30): Prop[] {
  return [
    { kind: 'bar', from: [x, y, -w], to: [x, y, w] },
    box([x - 1.5, 0, -w - 3], [x + 1.5, y + 2, -w], 'wall'),
    box([x - 1.5, 0, w], [x + 1.5, y + 2, w + 3], 'wall'),
  ];
}

/** Barres parallèles (le long de x) à ±z, hauteur y. */
export function dipBars(y: number, z: number): Prop[] {
  return SIDES.flatMap((s) => [
    { kind: 'bar', from: [-28, y, s * z], to: [28, y, s * z] } as Prop,
    box([-26, 0, s * z - 1.5], [-23, y, s * z + 1.5], 'wall'),
    box([23, 0, s * z - 1.5], [26, y, s * z + 1.5], 'wall'),
  ]);
}

/** Sangles : deux câbles de l'ancrage aux mains (ou aux pieds). */
export function straps(anchor: Vec, to: [Anchor, Anchor] = ['handL', 'handR'], spread = 3): Prop[] {
  return [
    { kind: 'cord', from: add(anchor, [0, 0, -spread]), to: to[0], tone: 'strap' },
    { kind: 'cord', from: add(anchor, [0, 0, spread]), to: to[1], tone: 'strap' },
  ];
}

/** Élastique entre deux points (ou parties du corps). */
export const band = (from: Anchor, to: Anchor): Prop => ({ kind: 'cord', from, to, tone: 'band' });

/** Élastique sous les pieds, tenu dans les mains. */
export const bandFeetToHands: Prop[] = [band('footL', 'handL'), band('footR', 'handR')];

/** Distance entre deux points (vérifications ponctuelles). */
export const dist = (a: Vec, b: Vec) => len(sub(a, b));

/** Poignets bras tendus vers un point (sangles, élastique ancré), depuis chaque épaule. */
export function reachFor(p: Pick<Pose, 'pelvis' | 'lean' | 'turn'>, target: Vec, bend: Vec, spread = 3): Pick<Pose, 'armL' | 'armR'> {
  const w = (s: Side) => toward(shoulderOf(p, s), [target[0], target[1], target[2] + s * spread], ARM);
  return { armL: limb(w(-1), [bend[0], bend[1], -bend[2]]), armR: limb(w(1), bend) };
}

/** Porte dont la face tournée vers la personne est à x, sangles accrochées en haut devant cette face. */
export function strapDoor(face: number, behind = false): { anchor: Vec; props: Prop[] } {
  const anchor: Vec = [behind ? face + 1 : face - 1, DOOR_TOP - 4, 0];
  return { anchor, props: [behind ? box([face - 2.5, 0, -16], [face, DOOR_TOP + 4, 16], 'wall') : door(face), ...straps(anchor)] };
}
