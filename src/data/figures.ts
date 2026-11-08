/**
 * Animations du mannequin (SPEC §4.3, J8), par variante du catalogue : c'est une DONNÉE.
 * Le moteur (src/domain/figure.ts) décrit le repère : x vers l'avant, y vers le haut, z vers la
 * droite de la personne ; 100 unités ≈ sa taille. Le sol est à y = 0.
 *
 * Chaque position donne le bassin, l'inclinaison du tronc et la cible des mains et des pieds ;
 * coudes et genoux se placent seuls, du côté de `bend`. Les petites fonctions ci-dessous
 * calculent les positions « gainées » (corps aligné des chevilles aux épaules) pour que les
 * longueurs tombent juste.
 *
 * Prototype du 08/11 : 4 exercices, à valider avant de généraliser au catalogue.
 */
import { add, BODY, leanTurnOf, mul, norm, sub, type Animation, type LimbPose, type Pose, type Vec } from '../domain/figure';

/** Longueur des jambes presque tendues (de la hanche à la cheville). */
const LEG = BODY.thigh + BODY.shin - 1;

const limb = (to: Vec, bend: Vec, dir?: Vec): LimbPose => (dir ? { to, bend, dir } : { to, bend });
/** Même chose dans le repère du tronc (avant, haut, droite), depuis le bassin. */
const local = (to: Vec, bend: Vec, dir?: Vec): LimbPose => ({ ...limb(to, bend, dir), local: true });

/** Corps gainé : bassin et tronc alignés des chevilles vers `toward` (planche, pompes). */
function straight(ankles: Vec, toward: Vec): Pick<Pose, 'pelvis' | 'lean' | 'turn'> {
  const d = norm(sub(toward, ankles));
  return { pelvis: add(ankles, mul(d, LEG)), ...leanTurnOf(d) };
}

/** Tronc orienté du bassin vers un point. */
function aim(pelvis: Vec, toward: Vec): Pick<Pose, 'pelvis' | 'lean' | 'turn'> {
  return { pelvis, ...leanTurnOf(sub(toward, pelvis)) };
}

/** Poignées de pompes sous les mains (règle poignet), de chaque côté. */
function handles(x: number, z: number) {
  return [-1, 1].map((side) => ({
    kind: 'box' as const,
    min: [x - 4, 0, side * z - 2.5] as Vec,
    max: [x + 4, 5.5, side * z + 2.5] as Vec,
    tone: 'soft' as const,
  }));
}

// ─── Chaise contre un mur ───
// Le dos glisse le long du mur jusqu'à l'angle choisi, puis on tient.
const WALL_X = 4;
const wallSitUp: Pose = {
  pelvis: [WALL_X, 44, 0],
  lean: 0,
  armL: limb([8, 41, -12], [-1, 0, 0]),
  armR: limb([8, 41, 12], [-1, 0, 0]),
  legL: limb([30, 4, -8], [1, 0, -0.15]),
  legR: limb([30, 4, 8], [1, 0, 0.15]),
};
const wallSitDown: Pose = {
  ...wallSitUp,
  pelvis: [WALL_X, 29, 0],
  armL: limb([22, 36, -10], [-1, -0.3, -0.3]),
  armR: limb([22, 36, 10], [-1, -0.3, 0.3]),
};

// ─── Descente de marche ───
// Debout sur la jambe droite (côté caméra), la gauche dans le vide devant la marche ; le talon
// gauche descend toucher le sol en 3 secondes, genou droit dans l'axe du pied.
const STEP_TOP = 10;
const stepUp: Pose = {
  pelvis: [-3, STEP_TOP + 4 + LEG - 0.5, 0],
  lean: 4,
  armL: local([3, 3, -12], [-0.6, 0, -1], [1, -0.4, 0.2]),
  armR: local([3, 3, 12], [-0.6, 0, 1], [1, -0.4, -0.2]),
  legL: limb([10, STEP_TOP + 4, -7], [1, 0, 0], [1, -0.5, 0]),
  legR: limb([-2, STEP_TOP + 4, 6], [1, 0, 0.1]),
};
const stepDown: Pose = {
  ...stepUp,
  pelvis: [-7, 49, 0],
  lean: 22,
  legL: limb([12, 5, -7], [1, 0, 0], [0.85, 0.5, 0]),
};

// ─── Pike push-up ───
// Corps en V inversé, bras dans le prolongement du tronc ; la tête descend devant les mains.
const PIKE_HANDS: Vec = [0, 8, 0];
const PIKE_ANKLES: Vec = [-58, 8, 0];
const pikeArms = (bendBack: number): Pick<Pose, 'armL' | 'armR'> => ({
  armL: limb([PIKE_HANDS[0], PIKE_HANDS[1], -12], [-1, bendBack, -0.5], [1, 0, 0]),
  armR: limb([PIKE_HANDS[0], PIKE_HANDS[1], 12], [-1, bendBack, 0.5], [1, 0, 0]),
});
const pikeLegs: Pick<Pose, 'legL' | 'legR'> = {
  legL: limb([PIKE_ANKLES[0], PIKE_ANKLES[1], -6], [1, 0, 0], [0.4, -0.92, 0]),
  legR: limb([PIKE_ANKLES[0], PIKE_ANKLES[1], 6], [1, 0, 0], [0.4, -0.92, 0]),
};
// En haut, bras tendus : le bassin est à « tronc + bras » des mains, dans l'axe.
const pikeUp: Pose = { ...aim([-41.5, 50.5, 0], PIKE_HANDS), ...pikeArms(0), ...pikeLegs };
const pikeDown: Pose = { pelvis: [-25, 42, 0], lean: 140, ...pikeArms(0.3), ...pikeLegs };

// ─── Pompes archer ───
// Mains très écartées ; on descend vers une main (ce coude plie), l'autre bras reste tendu, puis
// l'autre côté. Vue de trois quarts face, un peu en hauteur, pour voir les deux bras.
const ARCHER_X = 20;
const ARCHER_Z = 34;
const ARCHER_ANKLES: Vec = [-52, 9, 0];
const archerLimbs: Pick<Pose, 'armL' | 'armR' | 'legL' | 'legR'> = {
  armL: limb([ARCHER_X, 8, -ARCHER_Z], [-1, 1, -0.3], [1, 0, 0]),
  armR: limb([ARCHER_X, 8, ARCHER_Z], [-1, 1, 0.3], [1, 0, 0]),
  legL: limb([ARCHER_ANKLES[0], ARCHER_ANKLES[1], -7], [0, -1, 0], [0.35, -0.94, 0]),
  legR: limb([ARCHER_ANKLES[0], ARCHER_ANKLES[1], 7], [0, -1, 0], [0.35, -0.94, 0]),
};
const archerUp: Pose = { ...straight(ARCHER_ANKLES, [ARCHER_X, 27, 0]), ...archerLimbs };
const archerRight: Pose = { ...straight(ARCHER_ANKLES, [ARCHER_X + 1, 17, 5]), ...archerLimbs };
const archerLeft: Pose = { ...straight(ARCHER_ANKLES, [ARCHER_X + 1, 17, -5]), ...archerLimbs };

/** Animations par identifiant de variante. */
export const FIGURES: Readonly<Record<string, Animation>> = {
  'wall-sit': {
    view: { yaw: 58, pitch: 12 },
    frames: [
      { pose: wallSitUp, move: 1.4, hold: 0.8 },
      { pose: wallSitDown, move: 2, hold: 3 },
    ],
    props: [{ kind: 'box', min: [WALL_X - 10, 0, -30], max: [WALL_X - 6.5, 100, 30], tone: 'wall' }],
  },
  'step-down': {
    view: { yaw: 28, pitch: 10 },
    frames: [
      { pose: stepUp, move: 1.2, hold: 0.6 },
      { pose: stepDown, move: 3, hold: 0.3 },
    ],
    props: [{ kind: 'box', min: [-18, 0, -20], max: [5, STEP_TOP, 20], tone: 'wood' }],
  },
  'pike-pushup': {
    view: { yaw: 10, pitch: 6 },
    frames: [
      { pose: pikeUp, move: 1.2, hold: 0.4 },
      { pose: pikeDown, move: 1.6, hold: 0.2 },
    ],
    props: handles(PIKE_HANDS[0], 12),
  },
  'pushup-archer': {
    view: { yaw: 48, pitch: 26 },
    frames: [
      { pose: archerUp, move: 1.2, hold: 0.3 },
      { pose: archerRight, move: 1.6, hold: 0.2 },
      { pose: archerUp, move: 1.2, hold: 0.3 },
      { pose: archerLeft, move: 1.6, hold: 0.2 },
    ],
    props: handles(ARCHER_X, ARCHER_Z),
  },
};
