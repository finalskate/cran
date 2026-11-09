/**
 * Badges (J6b, SPEC §4.10, liste validée le 09/11) : des DONNÉES, à enrichir librement. Le calcul
 * est dans src/domain/badges.ts. Sobres : un médaillon, un libellé, jamais de série de jours.
 *
 * Les étapes de poids ne sont pas ici : un badge par étape saisie dans le Profil (aucun chiffre
 * personnel dans le code).
 */
import type { BadgeDef } from '../domain/badges';

export const BADGES: readonly BadgeDef[] = [
  { id: 'level-1', kind: 'level', threshold: 1, label: '1er niveau débloqué', medal: 'N1' },
  { id: 'weeks-1', kind: 'weeks', threshold: 1, label: '1re semaine réussie', medal: '1' },
  { id: 'weeks-4', kind: 'weeks', threshold: 4, label: '4 semaines réussies', medal: '4' },
  { id: 'weeks-12', kind: 'weeks', threshold: 12, label: '12 semaines réussies', medal: '12' },
  { id: 'sessions-10', kind: 'sessions', threshold: 10, label: '10 séances', medal: '10' },
  { id: 'sessions-25', kind: 'sessions', threshold: 25, label: '25 séances', medal: '25' },
  { id: 'sessions-50', kind: 'sessions', threshold: 50, label: '50 séances', medal: '50' },
  { id: 'pushups-50', kind: 'pushups', threshold: 50, label: '50 pompes au test', medal: '50' },
  { id: 'run-60', kind: 'run', threshold: 60, label: '1re sortie d’une heure', medal: '60′' },
  { id: 'run-90', kind: 'run', threshold: 90, label: 'Sortie d’1 h 30', medal: '90′' },
];
