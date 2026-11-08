/**
 * Animations du mannequin (SPEC §4.3, J8), par identifiant de variante : c'est une DONNÉE.
 * Une famille par fichier ; outils communs dans kit.ts, moteur dans src/domain/figure.ts.
 */
import type { Animation } from '../../domain/figure';
import { ARMS } from './arms';
import { CORE } from './core';
import { KNEE } from './knee';
import { LEGS } from './legs';
import { PULL } from './pull';
import { PUSH } from './push';
import { ROUTINE } from './routine';

export const FIGURES: Readonly<Record<string, Animation>> = { ...PUSH, ...PULL, ...LEGS, ...KNEE, ...CORE, ...ARMS, ...ROUTINE };
