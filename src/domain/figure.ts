/**
 * Mannequin animé (SPEC §4.3 « Illustrations », J8) : fonctions pures, testées dans figure.test.ts.
 *
 * Une animation est une DONNÉE (src/data/figures.ts) : quelques positions clés du corps, le
 * matériel autour (mur, marche, sangles…) et l'angle de vue. Ce module en tire, pour un instant
 * donné, la liste des formes à dessiner en 2D ; le composant Figure.tsx ne fait que les afficher.
 *
 * Choix (retour du 07/11 sur la maquette : « impossible de comprendre le mouvement ») :
 *  - squelette en 3D aux proportions réalistes, projeté selon un angle de vue choisi par exercice
 *    (profil, trois quarts, face) : la profondeur se lit, les membres du fond sont plus sombres ;
 *  - mains et pieds placés par cinématique inverse (IK) : un appui reste fixe pendant le
 *    mouvement (mains au sol pendant une pompe, pied sur la marche), coudes et genoux se plient
 *    du bon côté grâce à une direction de pliage ;
 *  - membres en fuseaux arrondis (plus larges à la racine), tronc à l'épaisseur vue sous l'angle :
 *    une silhouette, pas des bâtons.
 *
 * Repère : x vers l'avant (le regard d'une personne debout), y vers le haut, z vers sa droite.
 * Unité : 100 ≈ la taille d'une personne debout (1 unité ≈ 1,75 cm).
 */

export type Vec = readonly [number, number, number];

/** Proportions du mannequin (unités ci-dessus). */
export const BODY = {
  headR: 6.4,
  neck: 3.4,
  /** Du centre du bassin à la base du cou. */
  torso: 30,
  /** Les épaules sont un peu sous la base du cou. */
  shoulderDrop: 2.6,
  shoulderW: 21,
  hipW: 14,
  /** Épaisseur du tronc (avant-arrière) aux épaules et au bassin. */
  chestDepth: 13,
  hipDepth: 12,
  upperArm: 17,
  forearm: 15,
  hand: 6,
  thigh: 24.5,
  shin: 24,
  foot: 9,
} as const;

/** Bras ou jambe : où va le poignet (la cheville), et de quel côté plie le coude (le genou). */
export interface LimbPose {
  to: Vec;
  bend: Vec;
  /** Coordonnées dans le repère du tronc (avant, haut, droite), depuis le centre du bassin. */
  local?: boolean;
  /** Direction de la main (du pied, talon → orteils) ; par défaut : celle de l'avant-bras / à plat vers l'avant. */
  dir?: Vec;
}

/** Une position du corps. */
export interface Pose {
  /** Centre du bassin. */
  pelvis: Vec;
  /** Inclinaison du tronc depuis la verticale, vers l'avant (0 debout, 90 à plat ventre). */
  lean: number;
  /** Rotation du tronc autour de la verticale (0 : face à x ; positif : vers −z). */
  turn?: number;
  /** Rotation du tronc sur son axe (90 : couché sur le côté droit si lean = 90). */
  twist?: number;
  /** Tête : inclinaison vers l'avant par rapport au tronc (degrés). */
  nod?: number;
  armL: LimbPose;
  armR: LimbPose;
  legL: LimbPose;
  legR: LimbPose;
  /** Sac lesté sur le dos. */
  pack?: boolean;
  /** Charge (sac) tenue dans une main. */
  carry?: 'L' | 'R';
}

/** Matériel autour du mannequin. `to` d'un câble peut viser une main ou un pied. */
export type Anchor = Vec | 'handL' | 'handR' | 'footL' | 'footR' | 'kneeL' | 'kneeR' | 'ankleL' | 'ankleR';
export type Prop =
  | { kind: 'box'; min: Vec; max: Vec; tone?: 'wood' | 'wall' | 'soft' }
  | { kind: 'bar'; from: Vec; to: Vec }
  | { kind: 'cord'; from: Anchor; to: Anchor; tone: 'strap' | 'band' };

/** Angle de vue : 0 = profil vu de la droite ; 90 = de face. `pitch` : caméra au-dessus. */
export interface View {
  yaw: number;
  pitch: number;
}

/** Une position clé : durée pour l'atteindre depuis la précédente, puis temps de maintien. */
export interface Keyframe {
  pose: Pose;
  /** Secondes pour venir de la position précédente (la dernière revient à la première). */
  move: number;
  /** Secondes de maintien une fois arrivé. */
  hold?: number;
}

export interface Animation {
  view: View;
  frames: readonly Keyframe[];
  props?: readonly Prop[];
}

// ─── Vecteurs ───

export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec): Vec => {
  const l = len(a);
  return l > 1e-9 ? mul(a, 1 / l) : [0, 0, 0];
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Rotation de v autour de l'axe unitaire k (formule de Rodrigues). */
function rotate(v: Vec, k: Vec, deg: number): Vec {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
}

// ─── Squelette ───

/** Repère du tronc : axe de la colonne (`up`), avant de la poitrine (`front`), côté droit (`right`). */
export interface Frame {
  up: Vec;
  front: Vec;
  right: Vec;
}

export function trunkFrame(pose: Pick<Pose, 'lean' | 'turn' | 'twist'>): Frame {
  const Y: Vec = [0, 1, 0];
  const Z: Vec = [0, 0, 1];
  // Ordre : rotation sur l'axe du tronc, puis inclinaison vers l'avant, puis rotation verticale.
  let up: Vec = [0, 1, 0];
  let front: Vec = rotate([1, 0, 0], Y, pose.twist ?? 0);
  let right: Vec = rotate([0, 0, 1], Y, pose.twist ?? 0);
  [up, front, right] = [up, front, right].map((v) => rotate(v, Z, -pose.lean)) as [Vec, Vec, Vec];
  [up, front, right] = [up, front, right].map((v) => rotate(v, Y, pose.turn ?? 0)) as [Vec, Vec, Vec];
  return { up, front, right };
}

/** Inverse de trunkFrame pour un tronc sans rotation sur son axe : angles qui orientent la colonne selon `d`. */
export function leanTurnOf(d: Vec): { lean: number; turn: number } {
  const u = norm(d);
  const lean = (Math.acos(Math.max(-1, Math.min(1, u[1]))) * 180) / Math.PI;
  const turn = (Math.atan2(-u[2], u[0]) * 180) / Math.PI;
  // Même colonne, mais poitrine de l'autre côté : on préfère une rotation verticale entre −90° et
  // 90° et une inclinaison négative (vers l'arrière), ce qui garde le dos au sol couché sur le dos.
  if (turn > 90) return { lean: -lean, turn: turn - 180 };
  if (turn < -90) return { lean: -lean, turn: turn + 180 };
  return { lean, turn };
}

/** Point exprimé dans le repère du tronc (avant, haut, droite), depuis `origin`. */
function fromLocal(origin: Vec, f: Frame, v: Vec): Vec {
  return add(origin, add(add(mul(f.front, v[0]), mul(f.up, v[1])), mul(f.right, v[2])));
}

/**
 * Cinématique inverse à deux segments : articulation du milieu (coude, genou) pour que
 * l'extrémité atteigne `target`, pliée du côté de `bend`. Une cible trop loin donne un membre
 * tendu vers elle (`reach` > 1 le signale).
 */
export function solveLimb(root: Vec, target: Vec, a: number, b: number, bend: Vec): { mid: Vec; end: Vec; reach: number } {
  const toT = sub(target, root);
  const dist = len(toT);
  const reach = dist / (a + b);
  const d = Math.min(Math.max(dist, Math.abs(a - b) + 1e-3), a + b - 1e-3);
  const dir = dist > 1e-9 ? mul(toT, 1 / dist) : ([0, -1, 0] as Vec);
  // Direction de pliage : la part de `bend` perpendiculaire au membre.
  let perp = norm(sub(bend, mul(dir, dot(bend, dir))));
  if (len(perp) < 0.5) perp = norm(cross(dir, [0, 0, 1]));
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  return { mid: add(add(root, mul(dir, x)), mul(perp, h)), end: add(root, mul(dir, d)), reach };
}

/** Articulations d'une position, en 3D. */
export interface Skeleton {
  frame: Frame;
  pelvis: Vec;
  chest: Vec;
  head: Vec;
  shoulderL: Vec;
  shoulderR: Vec;
  hipL: Vec;
  hipR: Vec;
  elbowL: Vec;
  elbowR: Vec;
  wristL: Vec;
  wristR: Vec;
  handL: Vec;
  handR: Vec;
  kneeL: Vec;
  kneeR: Vec;
  ankleL: Vec;
  ankleR: Vec;
  toeL: Vec;
  toeR: Vec;
  /** Plus grande extension demandée à un membre (> 1 : cible hors d'atteinte). */
  maxReach: number;
  pack: boolean;
  carry?: 'L' | 'R';
}

export function skeleton(pose: Pose): Skeleton {
  const f = trunkFrame(pose);
  const B = BODY;
  const neck = add(pose.pelvis, mul(f.up, B.torso));
  const chest = add(neck, mul(f.up, -B.shoulderDrop));
  const headDir = rotate(f.up, f.right, -(pose.nod ?? 0));
  const head = add(neck, mul(headDir, B.neck + B.headR));
  const shoulderL = add(chest, mul(f.right, -B.shoulderW / 2));
  const shoulderR = add(chest, mul(f.right, B.shoulderW / 2));
  const hipL = add(pose.pelvis, mul(f.right, -B.hipW / 2));
  const hipR = add(pose.pelvis, mul(f.right, B.hipW / 2));
  const target = (l: LimbPose) => (l.local ? fromLocal(pose.pelvis, f, l.to) : l.to);
  const bendOf = (l: LimbPose) => (l.local ? fromLocal([0, 0, 0], f, l.bend) : l.bend);

  const arm = (root: Vec, l: LimbPose) => {
    const s = solveLimb(root, target(l), B.upperArm, B.forearm, bendOf(l));
    const dir = l.dir ? norm(l.local ? fromLocal([0, 0, 0], f, l.dir) : l.dir) : norm(sub(s.end, s.mid));
    return { ...s, hand: add(s.end, mul(dir, B.hand)) };
  };
  const leg = (root: Vec, l: LimbPose) => {
    const s = solveLimb(root, target(l), B.thigh, B.shin, bendOf(l));
    // Pied par défaut : à plat vers l'avant du corps (projeté à l'horizontale), orteils un peu plus bas.
    const flat = norm([f.front[0], 0, f.front[2]]);
    const dir = l.dir ? norm(l.local ? fromLocal([0, 0, 0], f, l.dir) : l.dir) : norm(add(mul(len(flat) > 0.3 ? flat : [1, 0, 0], 1), [0, -0.35, 0]));
    return { ...s, toe: add(s.end, mul(dir, B.foot)) };
  };
  const aL = arm(shoulderL, pose.armL);
  const aR = arm(shoulderR, pose.armR);
  const lL = leg(hipL, pose.legL);
  const lR = leg(hipR, pose.legR);
  return {
    frame: f,
    pelvis: pose.pelvis,
    chest,
    head,
    shoulderL,
    shoulderR,
    hipL,
    hipR,
    elbowL: aL.mid,
    elbowR: aR.mid,
    wristL: aL.end,
    wristR: aR.end,
    handL: aL.hand,
    handR: aR.hand,
    kneeL: lL.mid,
    kneeR: lR.mid,
    ankleL: lL.end,
    ankleR: lR.end,
    toeL: lL.toe,
    toeR: lR.toe,
    maxReach: Math.max(aL.reach, aR.reach, lL.reach, lR.reach),
    pack: pose.pack ?? false,
    ...(pose.carry ? { carry: pose.carry } : {}),
  };
}

// ─── Temps ───

/** Durée d'un cycle complet (aller et retour compris). */
export function cycleDuration(anim: Animation): number {
  return anim.frames.reduce((s, k) => s + k.move + (k.hold ?? 0), 0);
}

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);

function mixLimb(a: LimbPose, b: LimbPose, t: number): LimbPose {
  return {
    to: lerpV(a.to, b.to, t),
    bend: lerpV(a.bend, b.bend, t),
    local: a.local,
    ...(a.dir || b.dir ? { dir: lerpV(a.dir ?? b.dir!, b.dir ?? a.dir!, t) } : {}),
  };
}

/** Position intermédiaire (t de 0 à 1, sans courbe : l'appelant l'applique). */
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    pelvis: lerpV(a.pelvis, b.pelvis, t),
    lean: lerp(a.lean, b.lean, t),
    turn: lerp(a.turn ?? 0, b.turn ?? 0, t),
    twist: lerp(a.twist ?? 0, b.twist ?? 0, t),
    nod: lerp(a.nod ?? 0, b.nod ?? 0, t),
    armL: mixLimb(a.armL, b.armL, t),
    armR: mixLimb(a.armR, b.armR, t),
    legL: mixLimb(a.legL, b.legL, t),
    legR: mixLimb(a.legR, b.legR, t),
    ...(a.pack ? { pack: true } : {}),
    ...(a.carry ? { carry: a.carry } : {}),
  };
}

/**
 * Position à l'instant `time` (secondes, boucle). Chaque position clé est atteinte en `move`
 * secondes depuis la précédente (la première depuis la dernière), avec un départ et une arrivée
 * en douceur, puis tenue `hold` secondes.
 */
export function poseAt(anim: Animation, time: number): Pose {
  const frames = anim.frames;
  const total = cycleDuration(anim);
  let t = total > 0 ? ((time % total) + total) % total : 0;
  for (let i = 0; i < frames.length; i++) {
    const k = frames[i]!;
    const prev = frames[(i - 1 + frames.length) % frames.length]!;
    if (t < k.move) return mixPose(prev.pose, k.pose, ease(t / k.move));
    t -= k.move;
    if (t < (k.hold ?? 0)) return k.pose;
    t -= k.hold ?? 0;
  }
  return frames[0]!.pose;
}

// ─── Projection et formes à dessiner ───

/** Caméra orthographique : axes de l'écran et direction vers la caméra. */
export interface Camera {
  right: Vec;
  up: Vec;
  toward: Vec;
}

export function camera(view: View): Camera {
  const y = rad(view.yaw);
  const p = rad(view.pitch);
  const toward: Vec = [Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p)];
  const right: Vec = [Math.cos(y), 0, -Math.sin(y)];
  return { right, up: cross(toward, right), toward };
}

/** Point à l'écran (y vers le bas, comme en SVG) et sa profondeur (plus grand = plus près). */
export interface P2 {
  x: number;
  y: number;
  z: number;
}

export function project(cam: Camera, v: Vec): P2 {
  return { x: dot(v, cam.right), y: -dot(v, cam.up), z: dot(v, cam.toward) };
}

/** Forme à dessiner : fuseau (segment arrondi à deux rayons), disque ou polygone. */
export type Shape =
  | { kind: 'limb'; a: P2; b: P2; ra: number; rb: number; depth: number; part: 'body' | 'cord' | 'bar' | 'load'; tone?: string }
  | { kind: 'disc'; c: P2; r: number; depth: number }
  | { kind: 'poly'; points: P2[]; depth: number; tone: 'top' | 'side' | 'front' | 'floor'; material: string };

/** Demi-largeur apparente d'une section elliptique du tronc, perpendiculairement à l'axe vu à l'écran. */
function sectionHalfWidth(cam: Camera, f: Frame, axis2: { x: number; y: number }, halfWidth: number, halfDepth: number): number {
  const n = { x: -axis2.y, y: axis2.x };
  const pr = project(cam, f.right);
  const pf = project(cam, f.front);
  const kr = halfWidth * (pr.x * n.x + pr.y * n.y);
  const kf = halfDepth * (pf.x * n.x + pf.y * n.y);
  return Math.hypot(kr, kf);
}

/**
 * Tronc : fuseau des épaules au bassin, à la largeur vue sous l'angle (large de face, épais de
 * profil). Les extrémités arrondies s'arrêtent à la ligne des épaules et sous le bassin.
 */
function torsoShape(cam: Camera, s: Skeleton): Shape {
  const top = project(cam, s.chest);
  const bottom = project(cam, s.pelvis);
  const ax = top.x - bottom.x;
  const ay = top.y - bottom.y;
  const l = Math.hypot(ax, ay);
  const axis = l > 1e-6 ? { x: ax / l, y: ay / l } : { x: 0, y: -1 };
  const B = BODY;
  const wt = Math.max(sectionHalfWidth(cam, s.frame, axis, B.shoulderW / 2 + 1.5, B.chestDepth / 2), 5);
  const wb = Math.max(sectionHalfWidth(cam, s.frame, axis, B.hipW / 2 + 2.5, B.hipDepth / 2), 5);
  // Centres des arrondis : en retrait du rayon, sans se croiser si le tronc est vu en raccourci.
  const room = Math.max(l + 5, 0);
  const kt = Math.min(Math.max(wt - 2, 0), room / 2);
  const kb = Math.min(Math.max(wb - 3, 0), room / 2);
  const a: P2 = { x: top.x - axis.x * kt, y: top.y - axis.y * kt, z: top.z };
  const b: P2 = { x: bottom.x + axis.x * kb, y: bottom.y + axis.y * kb, z: bottom.z };
  return { kind: 'limb', a, b, ra: wt, rb: wb, depth: (top.z + bottom.z) / 2, part: 'body' };
}

/** Rayons des membres (racine → extrémité). */
const R = {
  upperArm: [3.7, 3.0],
  forearm: [3.0, 2.4],
  hand: [2.4, 2.0],
  thigh: [5.4, 4.0],
  shin: [4.0, 2.8],
  foot: [2.6, 2.0],
  neck: [3.0, 3.0],
} as const;

function limb(cam: Camera, a: Vec, b: Vec, r: readonly [number, number]): Extract<Shape, { kind: 'limb' }> {
  const pa = project(cam, a);
  const pb = project(cam, b);
  return { kind: 'limb', a: pa, b: pb, ra: r[0], rb: r[1], depth: (pa.z + pb.z) / 2, part: 'body' };
}

/** Le corps en formes, triées du fond vers l'avant. */
export function bodyShapes(cam: Camera, s: Skeleton): Shape[] {
  const neckBase = add(s.chest, mul(s.frame.up, BODY.shoulderDrop));
  const shapes: Shape[] = [
    torsoShape(cam, s),
    limb(cam, neckBase, s.head, R.neck),
    { kind: 'disc', c: project(cam, s.head), r: BODY.headR, depth: project(cam, s.head).z },
  ];
  for (const side of ['L', 'R'] as const) {
    shapes.push(
      limb(cam, s[`shoulder${side}`], s[`elbow${side}`], R.upperArm),
      limb(cam, s[`elbow${side}`], s[`wrist${side}`], R.forearm),
      limb(cam, s[`wrist${side}`], s[`hand${side}`], R.hand),
      limb(cam, s[`hip${side}`], s[`knee${side}`], R.thigh),
      limb(cam, s[`knee${side}`], s[`ankle${side}`], R.shin),
      limb(cam, s[`ankle${side}`], s[`toe${side}`], R.foot),
    );
  }
  // Charges : sac sur le dos (dans l'axe du tronc, derrière), ou pendu à une main.
  if (s.pack) {
    const back = mul(s.frame.front, -(BODY.chestDepth / 2 + 4));
    shapes.push({ ...limb(cam, add(add(s.chest, back), mul(s.frame.up, -5)), add(add(s.pelvis, back), mul(s.frame.up, 9)), [6.5, 6]), part: 'load' });
  }
  if (s.carry) {
    const hand = s.carry === 'L' ? s.handL : s.handR;
    shapes.push({ ...limb(cam, add(hand, [0, -3, 0]), add(hand, [0, -13, 0]), [5, 5.5]), part: 'load' });
  }
  return shapes.sort((a, b) => a.depth - b.depth);
}

/** Les 8 coins d'une boîte et ses 6 faces (normale sortante). */
const FACES: { idx: [number, number, number, number]; normal: Vec; tone: 'top' | 'side' | 'front' }[] = [
  // Coin i : bit 4 → x max, bit 2 → y max, bit 1 → z max.
  { idx: [2, 3, 7, 6], normal: [0, 1, 0], tone: 'top' },
  { idx: [0, 4, 5, 1], normal: [0, -1, 0], tone: 'side' },
  { idx: [4, 5, 7, 6], normal: [1, 0, 0], tone: 'front' },
  { idx: [0, 1, 3, 2], normal: [-1, 0, 0], tone: 'front' },
  { idx: [1, 5, 7, 3], normal: [0, 0, 1], tone: 'side' },
  { idx: [0, 4, 6, 2], normal: [0, 0, -1], tone: 'side' },
];

function boxShapes(cam: Camera, min: Vec, max: Vec, material: string): Shape[] {
  const corners: Vec[] = [];
  for (let i = 0; i < 8; i++) corners.push([i & 4 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 1 ? max[2] : min[2]]);
  const p = corners.map((c) => project(cam, c));
  return FACES.filter((face) => dot(face.normal, cam.toward) > 1e-6).map((face) => ({
    kind: 'poly' as const,
    points: face.idx.map((i) => p[i]!),
    depth: face.idx.reduce((s, i) => s + p[i]!.z, 0) / 4,
    tone: face.tone,
    material,
  }));
}

/** Une image : sol, matériel, puis le corps. */
export interface Scene {
  floor: Shape;
  props: Shape[];
  body: Shape[];
}

function anchorPoint(s: Skeleton, a: Anchor): Vec {
  if (typeof a !== 'string') return a;
  // Pied : le milieu de la plante (là où passe un élastique).
  const mid = (p: Vec, q: Vec): Vec => mul(add(p, q), 0.5);
  return {
    handL: s.handL,
    handR: s.handR,
    footL: mid(s.ankleL, s.toeL),
    footR: mid(s.ankleR, s.toeR),
    kneeL: s.kneeL,
    kneeR: s.kneeR,
    ankleL: s.ankleL,
    ankleR: s.ankleR,
  }[a];
}

/** Marge du sol autour du corps et du matériel. */
const FLOOR_MARGIN = 8;

/** Sol : rectangle autour de tout ce que l'animation occupe (positions clés et matériel). */
export function floorArea(anim: Animation): { x: [number, number]; z: [number, number] } {
  const xs: number[] = [];
  const zs: number[] = [];
  for (const k of anim.frames) {
    const s = skeleton(k.pose);
    for (const v of [s.head, s.pelvis, s.handL, s.handR, s.toeL, s.toeR, s.ankleL, s.ankleR, s.kneeL, s.kneeR]) {
      xs.push(v[0]);
      zs.push(v[2]);
    }
  }
  for (const p of anim.props ?? []) {
    if (p.kind === 'box') {
      xs.push(p.min[0], p.max[0]);
      zs.push(p.min[2], p.max[2]);
    }
  }
  return {
    x: [Math.min(...xs) - FLOOR_MARGIN, Math.max(...xs) + FLOOR_MARGIN],
    z: [Math.min(...zs) - FLOOR_MARGIN, Math.max(...zs) + FLOOR_MARGIN],
  };
}

export function scene(anim: Animation, time: number, floor = floorArea(anim)): Scene {
  const cam = camera(anim.view);
  const s = skeleton(poseAt(anim, time));
  const props: Shape[] = [];
  for (const p of anim.props ?? []) {
    if (p.kind === 'box') props.push(...boxShapes(cam, p.min, p.max, p.tone ?? 'wood'));
    else if (p.kind === 'bar') {
      const a = project(cam, p.from);
      const b = project(cam, p.to);
      props.push({ kind: 'limb', a, b, ra: 1.8, rb: 1.8, depth: (a.z + b.z) / 2, part: 'bar' });
    } else {
      const a = project(cam, anchorPoint(s, p.from));
      const b = project(cam, anchorPoint(s, p.to));
      props.push({ kind: 'limb', a, b, ra: p.tone === 'band' ? 1.3 : 1, rb: p.tone === 'band' ? 1.3 : 1, depth: (a.z + b.z) / 2, part: 'cord', tone: p.tone });
    }
  }
  const corners: Vec[] = [
    [floor.x[0], 0, floor.z[0]],
    [floor.x[1], 0, floor.z[0]],
    [floor.x[1], 0, floor.z[1]],
    [floor.x[0], 0, floor.z[1]],
  ];
  return {
    floor: { kind: 'poly', points: corners.map((c) => project(cam, c)), depth: -1e9, tone: 'floor', material: 'floor' },
    props,
    body: bodyShapes(cam, s),
  };
}

/** Cadre de l'animation entière (toutes les positions), pour une taille stable à l'écran. */
export function bounds(anim: Animation, samples = 24): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const total = cycleDuration(anim);
  const floor = floorArea(anim);
  const extend = (p: P2, r: number) => {
    x0 = Math.min(x0, p.x - r);
    y0 = Math.min(y0, p.y - r);
    x1 = Math.max(x1, p.x + r);
    y1 = Math.max(y1, p.y + r);
  };
  for (let i = 0; i < samples; i++) {
    const sc = scene(anim, (total * i) / samples, floor);
    for (const sh of [sc.floor, ...sc.props, ...sc.body]) {
      if (sh.kind === 'limb') (extend(sh.a, sh.ra), extend(sh.b, sh.rb));
      else if (sh.kind === 'disc') extend(sh.c, sh.r);
      else sh.points.forEach((p) => extend(p, 0));
    }
  }
  const pad = 6;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

/** Contour d'un fuseau : deux cercles reliés par leurs tangentes extérieures (chemin SVG). */
export function limbPath(a: P2, b: P2, ra: number, rb: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const f = (n: number) => n.toFixed(2);
  if (d < Math.abs(ra - rb) + 0.01) {
    const big = ra >= rb ? { c: a, r: ra } : { c: b, r: rb };
    return `M${f(big.c.x - big.r)} ${f(big.c.y)}a${f(big.r)} ${f(big.r)} 0 1 0 ${f(2 * big.r)} 0a${f(big.r)} ${f(big.r)} 0 1 0 ${f(-2 * big.r)} 0Z`;
  }
  const phi = Math.atan2(dy, dx);
  const alpha = Math.acos((ra - rb) / d);
  const p = (c: P2, r: number, ang: number) => `${f(c.x + r * Math.cos(ang))} ${f(c.y + r * Math.sin(ang))}`;
  return [
    `M${p(a, ra, phi + alpha)}`,
    `L${p(b, rb, phi + alpha)}`,
    `A${f(rb)} ${f(rb)} 0 0 0 ${p(b, rb, phi - alpha)}`,
    `L${p(a, ra, phi - alpha)}`,
    `A${f(ra)} ${f(ra)} 0 1 0 ${p(a, ra, phi + alpha)}Z`,
  ].join('');
}
