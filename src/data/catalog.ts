/**
 * CATALOGUE D'EXERCICES — fichier de DONNÉES (SPEC §4.3), éditable sans toucher au moteur.
 *
 * Organisation :
 *  - un mouvement = une échelle de niveaux, du plus facile (premier) au plus dur (dernier) ;
 *  - un niveau = une ou plusieurs variantes ÉQUIVALENTES pour des matériels différents
 *    (changer de lieu change la variante, pas le niveau) ; la première variante est la préférée ;
 *  - `substitutes` : solutions de repli quand aucun niveau n'est faisable sur le lieu.
 *
 * Pour ajouter une variante : la placer dans le bon niveau, avec un `id` unique.
 * Le test src/data/catalog.test.ts vérifie la cohérence (ids uniques, fourchettes, consignes…).
 *
 * Les consignes sont rédigées pour l'appli (jamais copiées d'un livre : le dépôt est public).
 */
import type { Movement } from '../domain/types';

export const CATALOG: Movement[] = [
  // ════════════════════════════ POUSSER ════════════════════════════
  {
    id: 'push-h',
    name: 'Pousser horizontal',
    category: 'push',
    note: 'Pompes. Sur poignées par défaut (règle poignet).',
    levels: [
      {
        variants: [
          {
            id: 'pushup-incline',
            name: 'Pompes inclinées',
            needs: [['table', 'bench']],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 10, max: 20 },
            cues: [
              'Mains sur le bord de la table, un peu plus larges que les épaules',
              'Corps gainé de la tête aux talons',
              'Poitrine jusqu’au bord, coudes à 45° du corps',
              'Pousse fort en soufflant',
            ],
            mistakes: ['Fesses en arrière ou bassin qui tombe', 'Coudes écartés à 90°'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pushup',
            name: 'Pompes',
            needs: [],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 12, max: 25 },
            cues: [
              'Mains sous les épaules, doigts (ou poignées) vers l’avant',
              'Serre fessiers et abdos : le corps est une planche',
              'Descends jusqu’à frôler le sol, coudes à 45°',
              'Remonte bras tendus sans casser le bassin',
            ],
            mistakes: ['Demi-amplitude', 'Tête qui avance avant la poitrine', 'Bas du dos creusé'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pushup-tempo',
            name: 'Pompes tempo (3 s en descente)',
            needs: [],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Descente lente : compte 3 secondes',
              'Pause d’une seconde en bas, sans te poser',
              'Remontée dynamique',
              'Gainage constant du début à la fin',
            ],
            mistakes: ['Accélérer la descente en fin de série', 'Se reposer au sol en bas'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pushup-feet-up',
            name: 'Pompes pieds surélevés',
            needs: ['bench'],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Pieds sur une chaise ou un banc, mains au sol',
              'Bassin aligné, ne le laisse pas monter',
              'Descends la poitrine entre les mains',
              'Plus les pieds sont hauts, plus c’est dur',
            ],
            mistakes: ['Fesses en l’air (pike involontaire)', 'Nuque cassée vers le sol'],
          },
          {
            id: 'pushup-straps',
            videoQuery: 'TRX push up',
            name: 'Pompes aux sangles',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Sangles à hauteur des genoux, poignées en main',
              'Corps incliné presque à l’horizontale',
              'Laisse les poignets tourner librement',
              'Garde les sangles contre le corps, pas écartées',
            ],
            mistakes: ['Sangles qui s’écartent en bas', 'Bassin qui tombe'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pushup-close',
            name: 'Pompes serrées',
            needs: [],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Mains (ou poignées) rapprochées sous la poitrine',
              'Coudes qui frôlent les côtes en descendant',
              'Sollicite surtout les triceps',
              'Gainage strict',
            ],
            mistakes: ['Coudes qui s’ouvrent', 'Épaules qui remontent vers les oreilles'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pushup-archer',
            videoQuery: 'archer push up tutorial',
            name: 'Pompes archer',
            needs: [],
            space: 'medium',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            perSide: true,
            target: { kind: 'reps', min: 5, max: 10 },
            cues: [
              'Mains très écartées',
              'Descends vers une main : ce bras se plie, l’autre reste presque tendu',
              'Le bras tendu aide le moins possible',
              'Alterne les côtés ou fais tout un côté puis l’autre',
            ],
            mistakes: ['Bassin qui pivote', 'Bras d’aide qui pousse trop'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pushup-decline-weighted',
            name: 'Pompes déclinées lestées',
            needs: ['bench', 'backpack'],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Sac lesté bien serré sur le dos',
              'Pieds surélevés, corps gainé',
              'Amplitude complète, poitrine près du sol',
              'Ajoute du poids quand tu tiens le haut de la fourchette',
            ],
            mistakes: ['Sac qui glisse vers la nuque', 'Amplitude qui raccourcit avec la charge'],
          },
        ],
      },
    ],
  },
  {
    id: 'push-v',
    name: 'Pousser vertical',
    category: 'push',
    note: 'Épaules. L’appui renversé charge le poignet : à débloquer seulement s’il est indolore.',
    levels: [
      {
        variants: [
          {
            id: 'pike-pushup',
            videoQuery: 'pike push up tutorial',
            name: 'Pike push-up',
            needs: [],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Fesses hautes, corps en V inversé',
              'Descends le sommet de la tête vers le sol, devant les mains',
              'Coudes vers l’arrière, pas sur les côtés',
              'Pousse en revenant en V',
            ],
            mistakes: ['Transformer le mouvement en pompe classique', 'Dos rond'],
          },
          {
            id: 'band-press',
            name: 'Développé élastique debout',
            needs: ['bands'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 10, max: 15 },
            cues: [
              'Pieds sur l’élastique, largeur de hanches',
              'Pousse au-dessus de la tête, bras tendus',
              'Abdos serrés, ne creuse pas le dos',
              'Redescends lentement aux épaules',
            ],
            mistakes: ['Dos cambré', 'Élastique trop faible : choisis plus dur'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pike-pushup-elevated',
            videoQuery: 'elevated pike push up',
            name: 'Pike pieds surélevés',
            needs: ['bench'],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Pieds sur une chaise, hanches au-dessus des épaules',
              'Tête qui descend devant les mains',
              'Plus le buste est vertical, plus c’est dur',
              'Gainage du tronc',
            ],
            mistakes: ['Pieds trop loin (moins vertical)', 'Coudes qui s’écartent'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'wall-hspu-partial',
            videoQuery: 'wall handstand push up partial range',
            name: 'Appui renversé au mur, partiel',
            needs: ['wall'],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: false,
            wristHeavy: true,
            target: { kind: 'reps', min: 3, max: 8 },
            cues: [
              'Monte en appui renversé dos au mur',
              'Descends de quelques centimètres seulement',
              'Coudes vers l’avant, pas sur les côtés',
              'Redescends du mur dès que tu fatigues',
            ],
            mistakes: ['Dos très cambré contre le mur', 'Descendre trop bas trop tôt'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'wall-hspu',
            videoQuery: 'wall handstand push up',
            name: 'Appui renversé au mur, complet',
            needs: ['wall'],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: false,
            wristHeavy: true,
            target: { kind: 'reps', min: 3, max: 8 },
            cues: [
              'Tête qui touche le sol (ou un coussin) à chaque répétition',
              'Mains à largeur d’épaules',
              'Gainage fort, côtes rentrées',
              'Pousse jusqu’aux bras tendus',
            ],
            mistakes: ['Tête qui tape le sol', 'Cambrure excessive'],
          },
        ],
      },
    ],
  },
  {
    id: 'dips',
    name: 'Dips',
    category: 'push',
    note: 'Pas de dips sur chaise (épaules).',
    levels: [
      {
        variants: [
          {
            id: 'dips-straps-assisted',
            videoQuery: 'TRX dips assisted',
            name: 'Dips aux sangles assistés',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'medium',
            knee: 'low',
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Sangles à hauteur des hanches, pieds au sol devant',
              'Les jambes aident juste ce qu’il faut',
              'Descends jusqu’à coudes à 90°',
              'Épaules basses, loin des oreilles',
            ],
            mistakes: ['Épaules qui roulent vers l’avant', 'Descendre trop bas'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'dips-bars',
            name: 'Dips aux barres parallèles',
            needs: ['dip-bars'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 5, max: 12 },
            cues: [
              'Bras tendus, épaules basses',
              'Buste légèrement penché en avant',
              'Descends jusqu’à coudes à 90°',
              'Remonte sans balancer les jambes',
            ],
            mistakes: ['Épaules qui montent', 'Amplitude trop profonde (épaule en avant)'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'dips-weighted',
            name: 'Dips lestés',
            needs: ['dip-bars', 'backpack'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 5, max: 10 },
            cues: [
              'Sac porté devant ou sur le dos, bien serré',
              'Même technique que sans charge',
              'Contrôle la descente',
              'Ajoute du poids par petits paliers',
            ],
            mistakes: ['Charge qui balance', 'Perte d’amplitude'],
          },
        ],
      },
    ],
  },

  // ════════════════════════════ TIRER ════════════════════════════
  {
    id: 'pull-h',
    name: 'Tirer horizontal',
    category: 'pull',
    note: 'Rowing. Aux sangles : recul d’au moins 1,5 m.',
    levels: [
      {
        variants: [
          {
            id: 'row-straps-easy',
            videoQuery: 'TRX row beginner',
            name: 'Rowing sangles, corps peu incliné',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 10, max: 15 },
            cues: [
              'Corps droit et gainé, penché en arrière',
              'Tire les coudes vers l’arrière, près du corps',
              'Serre les omoplates en haut',
              'Redescends lentement bras tendus',
            ],
            mistakes: ['Hanches qui cassent', 'Tirer avec les bras sans les omoplates'],
          },
          {
            id: 'row-band',
            videoQuery: 'resistance band row anchored door',
            name: 'Rowing élastique',
            needs: ['bands', ['anchor', 'pullup-bar']],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 12, max: 20 },
            cues: [
              'Élastique ancré à hauteur de poitrine',
              'Recule jusqu’à tension, genoux souples',
              'Coudes vers l’arrière, omoplates serrées',
              'Retour lent',
            ],
            mistakes: ['Élastique trop faible', 'Dos qui s’arrondit'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'row-straps-inclined',
            videoQuery: 'TRX row',
            name: 'Rowing sangles, incliné',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Avance les pieds : le corps se rapproche de l’horizontale',
              'Planche gainée, talons au sol',
              'Poitrine vers les poignées',
              'Pause d’une seconde en haut',
            ],
            mistakes: ['Bassin qui tombe', 'Haussement d’épaules'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'row-table-bent',
            videoQuery: 'inverted row under table bent knees',
            name: 'Rowing sous table, genoux fléchis',
            needs: ['table'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Allongé sous la table, mains sur le bord',
              'Genoux fléchis, pieds à plat',
              'Monte la poitrine jusqu’au bord, bassin aligné',
              'Vérifie que la table ne bascule pas',
            ],
            mistakes: ['Bassin qui reste au sol', 'Table instable : teste d’abord'],
          },
          {
            id: 'row-straps-horizontal-bent',
            videoQuery: 'TRX inverted row bent knees',
            name: 'Rowing sangles horizontal, genoux fléchis',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Sous l’ancrage, corps presque horizontal',
              'Genoux fléchis, pieds à plat',
              'Tire la poitrine vers les mains',
              'Bassin aligné avec les épaules',
            ],
            mistakes: ['Bassin qui pend', 'Tirer en balançant'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'row-table-straight',
            videoQuery: 'inverted row under table',
            name: 'Rowing sous table, jambes tendues',
            needs: ['table'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Jambes tendues, talons au sol',
              'Corps rigide comme une planche',
              'Poitrine au bord de la table',
              'Descente contrôlée',
            ],
            mistakes: ['Hanches qui fléchissent', 'Amplitude incomplète'],
          },
          {
            id: 'row-straps-horizontal',
            videoQuery: 'TRX inverted row',
            name: 'Rowing sangles horizontal, jambes tendues',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Corps horizontal, talons au sol, jambes tendues',
              'Planche rigide',
              'Poignées jusqu’aux côtes',
              'Descente lente',
            ],
            mistakes: ['Hanches qui fléchissent', 'Épaules qui montent'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'row-table-feet-up',
            videoQuery: 'feet elevated inverted row table',
            name: 'Rowing sous table, pieds surélevés',
            needs: ['table', 'bench'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Talons sur une chaise, corps horizontal',
              'Poitrine au bord de la table',
              'Gainage total',
              'Pause d’une seconde en haut',
            ],
            mistakes: ['Bassin qui tombe', 'Élan avec les hanches'],
          },
          {
            id: 'row-straps-feet-up',
            videoQuery: 'TRX feet elevated row',
            name: 'Rowing sangles, pieds surélevés',
            needs: ['straps', ['anchor', 'pullup-bar'], 'bench'],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Talons sur une chaise, corps horizontal',
              'Poignées jusqu’aux côtes',
              'Omoplates serrées en haut',
              'Descente contrôlée',
            ],
            mistakes: ['Bassin qui tombe', 'Rotation du tronc'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'row-straps-archer',
            videoQuery: 'TRX archer row',
            name: 'Rowing archer aux sangles',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            perSide: true,
            target: { kind: 'reps', min: 5, max: 10 },
            cues: [
              'Un bras tire, l’autre s’ouvre sur le côté presque tendu',
              'Le bras ouvert aide le moins possible',
              'Corps gainé, sans rotation',
              'Alterne les côtés',
            ],
            mistakes: ['Tronc qui tourne', 'Bras d’aide qui tire trop'],
          },
        ],
      },
    ],
  },
  {
    id: 'pull-v',
    name: 'Tirer vertical',
    category: 'pull',
    note: 'Barre nécessaire. Prise neutre ou supination, jamais pronation (règle poignet).',
    levels: [
      {
        variants: [
          {
            id: 'scap-pulls',
            videoQuery: 'scapular pull ups',
            name: 'Suspension active et élévations d’omoplates',
            needs: ['pullup-bar'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Suspendu bras tendus, prise supination (paumes vers toi)',
              'Abaisse les épaules sans plier les coudes',
              'Tiens 1 seconde, relâche lentement',
              'Pieds au sol si besoin pour alléger',
            ],
            mistakes: ['Plier les coudes', 'Se balancer'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pullup-negative',
            videoQuery: 'negative pull ups',
            name: 'Tractions négatives (5 s)',
            needs: ['pullup-bar'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 3, max: 6 },
            cues: [
              'Monte menton au-dessus de la barre (saut ou appui)',
              'Descends en 5 secondes, en contrôle',
              'Épaules engagées jusqu’en bas',
              'Prise supination ou neutre',
            ],
            mistakes: ['Lâcher en fin de descente', 'Prise en pronation (poignet)'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pullup-band',
            videoQuery: 'band assisted pull up',
            name: 'Tractions assistées à l’élastique',
            needs: ['pullup-bar', 'bands'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 5, max: 10 },
            cues: [
              'Élastique accroché à la barre, un pied ou un genou dedans',
              'Tire la poitrine vers la barre',
              'Descente complète, bras tendus',
              'Progresse en prenant un élastique plus faible',
            ],
            mistakes: ['Rebondir sur l’élastique', 'Demi-amplitude'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pullup',
            videoQuery: 'chin up tutorial',
            name: 'Tractions',
            needs: ['pullup-bar'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 3, max: 10 },
            cues: [
              'Prise supination ou neutre, largeur d’épaules',
              'Départ bras tendus, épaules engagées',
              'Menton au-dessus de la barre',
              'Descente contrôlée',
            ],
            mistakes: ['Kipping (élan des jambes)', 'Prise en pronation (poignet)'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pullup-weighted',
            name: 'Tractions lestées',
            needs: ['pullup-bar', 'backpack'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 3, max: 8 },
            cues: [
              'Sac lesté bien serré',
              'Même technique que sans charge',
              'Ajoute du poids par petits paliers',
              'Descente complète',
            ],
            mistakes: ['Charge qui balance', 'Amplitude qui raccourcit'],
          },
        ],
      },
    ],
    substitutes: [
      {
        id: 'pulldown-band',
        videoQuery: 'kneeling band lat pulldown door anchor',
        name: 'Tirage élastique ancré en haut',
        needs: ['bands', 'anchor'],
        space: 'small',
        knee: 'low',
        substitute: true,
        target: { kind: 'reps', min: 12, max: 20 },
        cues: [
          'Élastique ancré en haut de porte',
          'À genoux, buste droit',
          'Tire les coudes vers les hanches',
          'Substitut faible : la progression « barre » reste en attente',
        ],
        mistakes: ['Tirer avec le dos rond', 'Élastique trop faible'],
      },
      {
        id: 'pulldown-straps',
        videoQuery: 'TRX kneeling lat pulldown',
        name: 'Tirage vertical aux sangles, à genoux',
        needs: ['straps', 'anchor'],
        space: 'small',
        knee: 'low',
        substitute: true,
        target: { kind: 'reps', min: 8, max: 15 },
        cues: [
          'Sangles en haut, à genoux sous l’ancrage, un peu en arrière',
          'Tire les coudes vers le bas et l’arrière',
          'Poitrine haute',
          'Substitut : la progression « barre » reste en attente',
        ],
        mistakes: ['Pousser avec les jambes', 'Haussement d’épaules'],
      },
    ],
  },

  // ════════════════════════════ JAMBES ════════════════════════════
  {
    id: 'squat',
    name: 'Jambes (squat)',
    category: 'legs',
    note: 'Fentes arrière plutôt qu’avant : plus douces pour le genou.',
    levels: [
      {
        variants: [
          {
            id: 'box-squat',
            videoQuery: 'box squat chair bodyweight',
            name: 'Squat sur chaise',
            needs: ['bench'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 10, max: 20 },
            cues: [
              'Assieds-toi lentement en effleurant la chaise',
              'Genoux dans l’axe des pieds',
              'Poids sur les talons',
              'Remonte sans élan',
            ],
            mistakes: ['Se laisser tomber sur la chaise', 'Genoux qui rentrent'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'squat',
            name: 'Squat',
            needs: [],
            space: 'small',
            knee: 'mid',
            target: { kind: 'reps', min: 15, max: 25 },
            cues: [
              'Pieds largeur d’épaules, pointes légèrement ouvertes',
              'Descends hanches en arrière, dos droit',
              'Genoux dans l’axe des pieds',
              'Amplitude confortable, sans douleur',
            ],
            mistakes: ['Talons qui décollent', 'Genoux qui rentrent'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'squat-tempo',
            name: 'Squat tempo (3 s en descente)',
            needs: [],
            space: 'small',
            knee: 'mid',
            target: { kind: 'reps', min: 10, max: 20 },
            cues: [
              'Descente en 3 secondes',
              'Pause d’une seconde en bas',
              'Remontée dynamique',
              'Genoux dans l’axe',
            ],
            mistakes: ['Rebondir en bas', 'Perdre le tempo en fin de série'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'reverse-lunge',
            videoQuery: 'reverse lunge tutorial',
            name: 'Fente arrière',
            needs: [],
            space: 'small',
            knee: 'mid',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Grand pas en arrière',
              'Genou arrière qui frôle le sol',
              'Genou avant au-dessus de la cheville',
              'Pousse sur le talon avant pour revenir',
            ],
            mistakes: ['Genou avant qui dépasse loin devant', 'Buste qui s’effondre'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'bulgarian-split-squat',
            videoQuery: 'bulgarian split squat bodyweight',
            name: 'Squat bulgare',
            needs: ['bench'],
            space: 'small',
            knee: 'mid',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 12 },
            cues: [
              'Pied arrière posé sur la chaise',
              'Descends droit, genou arrière vers le sol',
              'Genou avant dans l’axe du pied',
              'Buste légèrement penché',
            ],
            mistakes: ['Pied avant trop près de la chaise', 'Genou qui rentre'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pistol-assisted',
            videoQuery: 'TRX assisted pistol squat',
            name: 'Pistol assisté',
            needs: [['straps', 'wall']],
            space: 'small',
            knee: 'high',
            perSide: true,
            target: { kind: 'reps', min: 5, max: 10 },
            cues: [
              'Tiens les sangles (ou un montant de porte)',
              'Jambe libre tendue devant',
              'Descends aussi bas que possible sans douleur',
              'Les bras aident juste ce qu’il faut',
            ],
            mistakes: ['Talon qui décolle', 'Tirer surtout avec les bras'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'pistol',
            videoQuery: 'pistol squat tutorial',
            name: 'Pistol',
            needs: [],
            space: 'small',
            knee: 'high',
            perSide: true,
            target: { kind: 'reps', min: 3, max: 8 },
            cues: [
              'Bras devant pour l’équilibre',
              'Descente contrôlée jusqu’en bas',
              'Genou dans l’axe du pied',
              'Remonte sans élan',
            ],
            mistakes: ['Chute en bas', 'Genou qui rentre'],
          },
        ],
      },
    ],
  },
  {
    id: 'hinge',
    name: 'Jambes (hanche)',
    category: 'legs',
    note: 'Fessiers et ischios : la chaîne arrière protège aussi le genou.',
    levels: [
      {
        variants: [
          {
            id: 'glute-bridge',
            name: 'Pont fessier',
            needs: [],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 12, max: 20 },
            cues: [
              'Allongé, pieds à plat près des fesses',
              'Monte le bassin en serrant les fessiers',
              'Tiens 1 seconde en haut',
              'Ne cambre pas : côtes rentrées',
            ],
            mistakes: ['Pousser avec le bas du dos', 'Pieds trop loin'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'glute-bridge-single',
            videoQuery: 'single leg glute bridge',
            name: 'Pont fessier une jambe',
            needs: [],
            space: 'small',
            knee: 'low',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Une jambe tendue en l’air',
              'Monte le bassin bien horizontal',
              'Pousse dans le talon au sol',
              'Tiens 1 seconde en haut',
            ],
            mistakes: ['Bassin qui penche', 'Cambrure'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'hip-thrust-single',
            videoQuery: 'single leg hip thrust couch',
            name: 'Hip thrust une jambe',
            needs: ['bench'],
            space: 'small',
            knee: 'low',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 15 },
            cues: [
              'Haut du dos appuyé sur le canapé ou un banc',
              'Une jambe au sol, genou à 90° en haut',
              'Monte jusqu’à l’alignement épaules-hanches-genou',
              'Menton rentré',
            ],
            mistakes: ['Cambrer en haut', 'Pied trop proche des fesses'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'single-leg-rdl',
            videoQuery: 'single leg romanian deadlift',
            name: 'Soulevé de terre une jambe',
            needs: ['backpack'],
            space: 'small',
            knee: 'low',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 12 },
            cues: [
              'Sac lesté dans une main',
              'Penche le buste, jambe libre tendue vers l’arrière',
              'Dos plat, genou d’appui souple',
              'Remonte en poussant les hanches',
            ],
            mistakes: ['Dos rond', 'Bassin qui s’ouvre sur le côté'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'leg-curl-straps',
            videoQuery: 'TRX hamstring curl',
            name: 'Leg curl aux sangles',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'mid',
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Allongé, talons dans les sangles basses',
              'Monte le bassin, puis ramène les talons vers les fesses',
              'Bassin haut tout le long',
              'Retour lent jambes tendues',
            ],
            mistakes: ['Bassin qui tombe', 'Crampes : réduis l’amplitude'],
          },
        ],
      },
    ],
  },

  // ════════════════════════════ GENOU (PRÉVENTION) ════════════════════════════
  // Un niveau par exercice : ce sont des exercices tournants, pas une échelle.
  {
    id: 'knee-wall-sit',
    name: 'Chaise contre un mur',
    category: 'knee',
    note: 'Isométrie sur deux jambes uniquement (jamais sur une jambe). Gardée même genou sensible.',
    levels: [
      {
        variants: [
          {
            id: 'wall-sit',
            videoQuery: 'wall sit',
            name: 'Chaise contre un mur (deux jambes)',
            needs: ['wall'],
            space: 'small',
            knee: 'low',
            target: { kind: 'time', min: 30, max: 45 },
            cues: [
              'Dos contre le mur, pieds devant',
              'Descends à un angle confortable, sans douleur',
              'Poids réparti sur les deux jambes',
              'Respire calmement',
            ],
            mistakes: ['Descendre trop bas si ça tire', 'Pousser plus sur une jambe'],
          },
        ],
      },
    ],
  },
  {
    id: 'knee-spanish-squat',
    name: 'Spanish squat',
    category: 'knee',
    note: 'Alternative à la chaise si elle est désagréable.',
    levels: [
      {
        variants: [
          {
            id: 'spanish-squat',
            videoQuery: 'spanish squat patellar tendon',
            name: 'Spanish squat',
            needs: [['straps', 'bands'], ['anchor', 'pullup-bar']],
            space: 'small',
            knee: 'low',
            target: { kind: 'time', min: 30, max: 45 },
            cues: [
              'Sangle ou élastique derrière les genoux, ancré devant',
              'Penche-toi en arrière, tibias verticaux',
              'Descends en squat, tension dans la sangle',
              'Tiens la position',
            ],
            mistakes: ['Tibias qui avancent', 'Ancrage trop bas'],
          },
        ],
      },
    ],
  },
  {
    id: 'knee-step-down',
    name: 'Descente de marche',
    category: 'knee',
    levels: [
      {
        variants: [
          {
            id: 'step-down',
            videoQuery: 'eccentric step down knee',
            name: 'Descente de marche lente',
            needs: ['step'],
            space: 'small',
            knee: 'mid',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 12 },
            cues: [
              'Debout sur une marche, sur une jambe',
              'Descends le talon libre vers le sol en 3 secondes',
              'Genou dans l’axe du pied',
              'Remonte en appui sur les deux jambes si besoin',
            ],
            mistakes: ['Genou qui rentre', 'Descente trop rapide'],
          },
        ],
      },
    ],
  },
  {
    id: 'knee-calf',
    name: 'Mollets excentriques',
    category: 'knee',
    levels: [
      {
        variants: [
          {
            id: 'calf-eccentric',
            videoQuery: 'eccentric calf raise step',
            name: 'Mollets sur marche, descente lente',
            needs: ['step'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 10, max: 15 },
            cues: [
              'Avant des pieds sur la marche',
              'Monte sur les deux pieds',
              'Descends en 3 secondes sur un seul pied',
              'Talon sous le niveau de la marche',
            ],
            mistakes: ['Rebondir en bas', 'Genou verrouillé'],
          },
        ],
      },
    ],
  },
  {
    id: 'knee-band-walk',
    name: 'Marche latérale',
    category: 'knee',
    levels: [
      {
        variants: [
          {
            id: 'band-walk',
            videoQuery: 'mini band lateral walk',
            name: 'Marche latérale à la mini-bande',
            needs: ['mini-bands'],
            space: 'small',
            knee: 'low',
            perSide: true,
            target: { kind: 'reps', min: 10, max: 15 },
            cues: [
              'Mini-bande au-dessus des genoux ou aux chevilles',
              'Demi-squat, dos droit',
              'Petits pas sur le côté, tension constante',
              'Genoux qui poussent vers l’extérieur',
            ],
            mistakes: ['Pieds qui se rejoignent', 'Buste qui balance'],
          },
        ],
      },
    ],
  },
  {
    id: 'knee-side-plank-abd',
    name: 'Gainage latéral avec abduction',
    category: 'knee',
    levels: [
      {
        variants: [
          {
            id: 'side-plank-abduction',
            videoQuery: 'side plank hip abduction',
            name: 'Gainage latéral avec abduction',
            needs: [],
            space: 'small',
            knee: 'low',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 12 },
            cues: [
              'Sur l’avant-bras, corps aligné',
              'Monte la jambe du dessus, pointe vers l’avant',
              'Bassin haut tout le long',
              'Redescends lentement',
            ],
            mistakes: ['Bassin qui tombe', 'Pointe de pied tournée vers le haut'],
          },
        ],
      },
    ],
  },

  // ════════════════════════════ GAINAGE ════════════════════════════
  {
    id: 'core',
    name: 'Gainage',
    category: 'core',
    note: 'Planche toujours sur avant-bras (règle poignet).',
    levels: [
      {
        variants: [
          {
            id: 'plank',
            name: 'Planche sur avant-bras',
            needs: [],
            space: 'small',
            knee: 'low',
            target: { kind: 'time', min: 30, max: 60 },
            cues: [
              'Coudes sous les épaules',
              'Serre fessiers et abdos',
              'Corps aligné, regard vers le sol',
              'Respire',
            ],
            mistakes: ['Fesses en l’air', 'Bas du dos qui s’affaisse'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'rkc-plank',
            videoQuery: 'RKC plank',
            name: 'Planche RKC',
            needs: [],
            space: 'small',
            knee: 'low',
            target: { kind: 'time', min: 15, max: 30 },
            cues: [
              'Planche sur avant-bras, coudes un peu plus avancés',
              'Contracte tout : fessiers, cuisses, abdos',
              'Tire les coudes vers les pieds sans bouger',
              'Courte mais intense',
            ],
            mistakes: ['Relâcher la contraction', 'Retenir sa respiration'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'dead-bug',
            videoQuery: 'dead bug exercise',
            name: 'Dead bug',
            needs: [],
            space: 'medium',
            knee: 'low',
            perSide: true,
            target: { kind: 'reps', min: 8, max: 12 },
            cues: [
              'Sur le dos, bras vers le plafond, genoux à 90°',
              'Bas du dos plaqué au sol',
              'Étends un bras et la jambe opposée',
              'Reviens lentement, alterne',
            ],
            mistakes: ['Dos qui décolle', 'Aller trop vite'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'hollow-hold',
            videoQuery: 'hollow body hold',
            name: 'Hollow body',
            needs: [],
            space: 'small',
            knee: 'low',
            target: { kind: 'time', min: 20, max: 40 },
            cues: [
              'Sur le dos, bas du dos plaqué',
              'Épaules et jambes décollées',
              'Bras tendus derrière la tête (ou le long du corps, plus facile)',
              'Tiens la forme de banane',
            ],
            mistakes: ['Dos qui se creuse', 'Jambes trop basses trop tôt'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'side-plank',
            name: 'Planche latérale',
            needs: [],
            space: 'small',
            knee: 'low',
            perSide: true,
            target: { kind: 'time', min: 20, max: 45 },
            cues: [
              'Avant-bras sous l’épaule',
              'Corps aligné, bassin haut',
              'Pieds superposés ou décalés',
              'Regard devant',
            ],
            mistakes: ['Bassin qui tombe', 'Épaule qui s’affaisse'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'copenhagen-knee',
            videoQuery: 'copenhagen plank short lever',
            name: 'Copenhague, genou en appui',
            needs: ['bench'],
            space: 'medium',
            knee: 'low',
            perSide: true,
            target: { kind: 'time', min: 15, max: 30 },
            cues: [
              'Planche latérale, genou du dessus posé sur le banc',
              'Monte le bassin, jambe du dessous libre',
              'Corps aligné',
              'Intérieur de cuisse qui travaille',
            ],
            mistakes: ['Bassin qui recule', 'Appui trop haut sur la cuisse'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'copenhagen-foot',
            videoQuery: 'copenhagen plank long lever',
            name: 'Copenhague, pied en appui',
            needs: ['bench'],
            space: 'medium',
            knee: 'low',
            perSide: true,
            target: { kind: 'time', min: 15, max: 30 },
            cues: [
              'Comme genou en appui, mais pied du dessus sur le banc',
              'Jambe tendue, bassin haut',
              'Plus dur : levier plus long',
              'Arrête si l’intérieur du genou tire',
            ],
            mistakes: ['Bassin qui tombe', 'Douleur à l’intérieur du genou'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'fallout-straps',
            videoQuery: 'TRX fallout',
            name: 'Fallout aux sangles',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Debout penché, poignées en main bras tendus',
              'Laisse les bras monter devant, corps qui descend',
              'Gainage total, dos plat',
              'Reviens en tirant les bras vers les hanches',
            ],
            mistakes: ['Dos qui se creuse', 'Aller trop loin trop tôt'],
          },
        ],
      },
      {
        variants: [
          {
            id: 'body-saw-straps',
            videoQuery: 'TRX body saw',
            name: 'Body saw aux sangles',
            needs: ['straps', ['anchor', 'pullup-bar']],
            space: 'large',
            knee: 'low',
            target: { kind: 'reps', min: 6, max: 12 },
            cues: [
              'Planche sur avant-bras, pieds dans les sangles basses',
              'Glisse le corps vers l’arrière puis l’avant',
              'Bassin aligné tout le long',
              'Petite amplitude au début',
            ],
            mistakes: ['Fesses qui montent', 'Bas du dos qui s’affaisse'],
          },
        ],
      },
    ],
  },

  // ════════════════════════════ ÉPAULES / POSTURE ════════════════════════════
  {
    id: 'shoulders-pull-apart',
    name: 'Pull-apart',
    category: 'shoulders',
    levels: [
      {
        variants: [
          {
            id: 'band-pull-apart',
            videoQuery: 'band pull apart',
            name: 'Pull-apart élastique',
            needs: ['bands'],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 15, max: 20 },
            cues: [
              'Élastique tenu bras tendus devant',
              'Écarte jusqu’à la poitrine',
              'Omoplates serrées, épaules basses',
              'Retour lent',
            ],
            mistakes: ['Hausser les épaules', 'Plier les coudes'],
          },
        ],
      },
    ],
  },
  {
    id: 'shoulders-face-pull',
    name: 'Face pull',
    category: 'shoulders',
    levels: [
      {
        variants: [
          {
            id: 'band-face-pull',
            videoQuery: 'band face pull',
            name: 'Face pull élastique',
            needs: ['bands', ['anchor', 'pullup-bar']],
            space: 'small',
            knee: 'low',
            target: { kind: 'reps', min: 12, max: 20 },
            cues: [
              'Élastique ancré à hauteur du visage',
              'Tire vers le front, coudes hauts',
              'Termine pouces vers l’arrière',
              'Retour lent',
            ],
            mistakes: ['Coudes qui tombent', 'Cambrer le dos'],
          },
        ],
      },
    ],
  },
  {
    id: 'shoulders-ytw',
    name: 'Y-T-W',
    category: 'shoulders',
    levels: [
      {
        variants: [
          {
            id: 'ytw-floor',
            videoQuery: 'prone Y T W raises',
            name: 'Y-T-W au sol',
            needs: [],
            space: 'medium',
            knee: 'low',
            target: { kind: 'reps', min: 6, max: 10 },
            cues: [
              'Allongé sur le ventre, front au sol',
              'Bras en Y, puis en T, puis en W : une répétition',
              'Décolle les bras en serrant les omoplates',
              'Pouces vers le plafond',
            ],
            mistakes: ['Lever la tête', 'Aller trop vite'],
          },
        ],
      },
    ],
  },

  // ════════════════════════════ VOLUME POMPES (hebdomadaire) ════════════════════════════
  {
    id: 'pushup-volume',
    name: 'Volume pompes',
    category: 'volume',
    note: 'Une série longue par semaine : entretient l’endurance (les variantes dures entraînent la force).',
    levels: [
      {
        variants: [
          {
            id: 'pushup-max-set',
            name: 'Série longue de pompes',
            needs: [],
            space: 'small',
            knee: 'low',
            handsOnFloor: true,
            fistsOk: true,
            target: { kind: 'reps', min: 20, max: 60 },
            cues: [
              'Pompes classiques, amplitude complète',
              'Le plus possible sans pause au sol',
              'Tu peux souffler en haut, bras tendus',
              'Arrête dès que la technique se dégrade',
            ],
            mistakes: ['Raccourcir l’amplitude pour gratter des répétitions', 'Bassin qui tombe'],
          },
        ],
      },
    ],
  },
];

/**
 * Échauffement (guidé, ~30 s par mouvement). Les mouvements marqués `knee: 'mid'` sont retirés
 * quand le genou est sensible.
 */
export const WARMUP: Movement = {
  id: 'warmup',
  name: 'Échauffement',
  category: 'warmup',
  levels: [
    {
      variants: [
        guided('warmup-arm-circles', 'Cercles de bras', 30, 'low', [
          'Grands cercles vers l’avant puis l’arrière',
          'Amplitude progressive',
          'Épaules relâchées',
        ]),
        guided('warmup-hip-circles', 'Cercles de hanches', 30, 'low', [
          'Mains sur les hanches',
          'Grands cercles dans un sens puis l’autre',
          'Genoux souples',
        ]),
        guided('warmup-cat-cow', 'Chat-vache', 30, 'low', [
          'À quatre pattes (poings ou avant-bras si le poignet gêne)',
          'Dos rond en expirant, dos creux en inspirant',
          'Mouvement lent',
        ]),
        guided('warmup-slow-squat', 'Squats lents, amplitude confortable', 30, 'mid', [
          'Descends seulement jusqu’où c’est confortable',
          'Genoux dans l’axe des pieds',
          'Respire',
        ]),
        guided('warmup-incline-pushup', 'Pompes faciles contre un mur', 30, 'low', [
          'Mains sur le mur, corps incliné',
          'Rythme tranquille',
          'Prépare épaules et coudes',
        ]),
      ],
    },
  ],
};

/** Retour au calme (guidé, facultatif). */
export const COOLDOWN: Movement = {
  id: 'cooldown',
  name: 'Retour au calme',
  category: 'cooldown',
  levels: [
    {
      variants: [
        guided('cooldown-calf', 'Étirement des mollets', 60, 'low', [
          'Mains au mur, une jambe tendue derrière',
          'Talon au sol, 30 s par côté',
          'Respire lentement',
        ]),
        guided('cooldown-hip-flexor', 'Fléchisseurs de hanche', 60, 'low', [
          'Un genou au sol, l’autre pied devant',
          'Serre le fessier de la jambe arrière, avance doucement le bassin',
          '30 s par côté',
        ]),
        guided('cooldown-quad', 'Quadriceps', 60, 'low', [
          'Debout, une main au mur',
          'Talon vers la fesse, genoux serrés',
          '30 s par côté, sans forcer sur le genou',
        ]),
      ],
    },
  ],
};

/** Fabrique une variante « guidée » (minuteur seul, rien à noter). */
function guided(
  id: string,
  name: string,
  seconds: number,
  knee: 'low' | 'mid',
  cues: string[],
): Movement['levels'][number]['variants'][number] {
  return {
    id,
    name,
    needs: [],
    space: 'small',
    knee,
    target: { kind: 'time', min: seconds, max: seconds },
    cues,
    mistakes: [],
  };
}
