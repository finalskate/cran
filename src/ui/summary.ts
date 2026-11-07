/**
 * Dernière séance terminée, gardée en mémoire pour l'écran de bilan, avec les changements de
 * niveau qu'elle a provoqués (déblocages appliqués, retours en arrière proposés).
 */
import { signal } from '@preact/signals';
import type { WorkoutRecord } from '../domain/history';
import type { LevelChange } from '../domain/progression';
import type { Plan } from '../domain/types';

export const lastRecord = signal<{
  record: WorkoutRecord;
  plan: Plan;
  unlocks: LevelChange[];
  stepBacks: LevelChange[];
} | null>(null);
