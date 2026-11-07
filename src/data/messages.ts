/**
 * Messages d'encouragement : des DONNÉES, à enrichir librement (une phrase de plus suffit).
 * Le tirage est fait par src/domain/messages.ts : chaque message passe une fois avant qu'un autre
 * revienne, et jamais deux fois de suite.
 *
 * Ton : tutoiement, chaleureux sans en faire trop, jamais culpabilisant.
 */

/** Carte d'accueil quand la séance du jour est faite (titre + texte). */
export const REST_DAY: readonly { title: string; body: string }[] = [
  {
    title: 'Place à la récupération',
    body: 'Les muscles progressent pendant le repos. Marche, mobilité, un bon repas protéiné et du sommeil : demain, tu seras plus fort.',
  },
  { title: 'Repos mérité', body: 'Le travail est fait. Maintenant, c’est ton corps qui construit : laisse-le faire.' },
  {
    title: 'Le plus dur est fait',
    body: 'La régularité fait plus que l’intensité. Profite du reste de ta journée, tu l’as bien gagné.',
  },
  {
    title: 'Mission du jour : récupérer',
    body: 'De l’eau, des protéines, une bonne nuit : c’est aussi de l’entraînement, et le plus agréable.',
  },
  {
    title: 'Laisse agir',
    body: 'C’est entre deux séances que la force s’installe. Une bonne nuit vaut bien une série de plus.',
  },
  {
    title: 'Pause active',
    body: 'Une marche ou un peu de mobilité aident à récupérer. Les muscles, eux, se renforcent en silence.',
  },
  {
    title: 'Une de plus au carnet',
    body: 'Chaque séance notée compte. Demain, tu repartiras sur des bases plus solides qu’hier.',
  },
  {
    title: 'Tu peux souffler',
    body: 'Ton corps a reçu le message. Récupérer, c’est lui laisser le temps d’y répondre.',
  },
];

/** Titre du bilan de séance. */
export const SESSION_DONE: readonly string[] = [
  'Bien joué.',
  'Séance dans la boîte.',
  'Solide.',
  'Du beau travail.',
  'C’est fait, et bien fait.',
  'Tu as tenu bon.',
  'Encore une de gagnée.',
  'Un cran de plus.',
];

/** Petite phrase sous le chrono de repos, entre deux séries. */
export const REST_BREAK: readonly string[] = [
  'Respire, relâche les épaules.',
  'Une gorgée d’eau ?',
  'Le repos fait partie de l’entraînement.',
  'La prochaine série sera aussi propre.',
  'Pense à la technique, pas à la vitesse.',
  'Tu tiens le rythme.',
  'Inspire par le nez, souffle longuement.',
  'Secoue les mains, détends les bras.',
  'Ça avance bien.',
  'Chaque répétition compte.',
];

/** Ouverture de la carte « Niveau débloqué ». */
export const LEVEL_UP: readonly string[] = [
  'Le travail paie !',
  'Cran franchi !',
  'Belle progression !',
  'Ça monte !',
  'Tu l’as bien mérité !',
];

/** Ouverture de la carte qui propose de consolider un cran plus bas. */
export const STEP_BACK: readonly string[] = [
  'Ce niveau résiste encore.',
  'Chaque échelle a ses paliers.',
  'Ça arrive à tout le monde.',
  'Rien de grave, c’est le jeu.',
];

/**
 * Après une pesée (J3) : on commente la TENDANCE, jamais le chiffre du jour. Une liste par sens.
 * Quand la tendance remonte, le ton reste neutre et rassurant : jamais de reproche.
 */
export const TREND_DOWN: readonly string[] = [
  'Ça descend tranquillement, au bon rythme.',
  'La tendance va dans le bon sens. Continue comme ça.',
  'Doucement mais sûrement : c’est comme ça que ça tient.',
  'Les efforts se voient sur la courbe.',
  'Belle régularité, la tendance suit.',
  'Un peu moins chaque semaine : exactement ce qu’il faut.',
];

export const TREND_STABLE: readonly string[] = [
  'Tendance stable. Le corps fait parfois des paliers avant de repartir.',
  'Stable pour l’instant : un palier, rien d’inquiétant.',
  'La courbe se pose. Tes séances, elles, continuent de construire.',
  'Stable. C’est sur plusieurs semaines que ça se joue.',
];

export const TREND_UP: readonly string[] = [
  'Petite remontée : l’eau, le sel et le repas de la veille jouent beaucoup.',
  'La tendance remonte un peu. Une semaine n’est qu’un point sur la courbe.',
  'Un léger rebond, ça arrive à tout le monde. La suite compte plus.',
  'Ça remonte légèrement : rien qu’une bonne semaine ne rattrape.',
];

/** Tant qu'il n'y a pas assez de pesées pour un rythme. */
export const TREND_START: readonly string[] = [
  'Pesée notée. Encore quelques-unes et la tendance se dessinera.',
  'C’est noté. Chaque pesée affine la courbe.',
  'Merci ! La tendance prendra forme au fil des pesées.',
];
