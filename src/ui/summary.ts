/**
 * Dernière séance terminée, gardée en mémoire pour l'écran de bilan.
 */
import { signal } from '@preact/signals';
import type { WorkoutRecord } from '../domain/history';
import type { Plan } from '../domain/types';

export const lastRecord = signal<{ record: WorkoutRecord; plan: Plan } | null>(null);
