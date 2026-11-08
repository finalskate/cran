/**
 * État partagé « corps » (J3) : mensurations, photos de progression, objectifs de poids.
 * Les pesées elles-mêmes restent dans foodState (la cible calorique s'en sert).
 * Relu au démarrage, puis mis à jour à chaque écriture : accueil, Carnet › Corps et Photos
 * lisent la même chose.
 */
import { computed, signal } from '@preact/signals';
import { deleteMeasure, deletePhotos, listMeasures, listPhotos, saveMeasure, savePhoto } from '../data/bodyRepo';
import type { PhotoRow } from '../data/db';
import { deleteWeight } from '../data/foodRepo';
import { getSetting, setSetting } from '../data/settings';
import { track } from '../data/usage';
import { bodySummary, measureId, trendSeries, type MeasureEntry, type MeasureKind, type PhotoMode, type PhotoPose } from '../domain/body';
import { addDays, dayKey } from '../domain/days';
import { weights } from './foodState';

/** Mesures (taille, bras, poitrine), de la plus ancienne à la plus récente. */
export const measures = signal<MeasureEntry[]>([]);

/** Photos de progression, de la plus ancienne à la plus récente (les Blobs ne coûtent qu'une référence). */
export const photos = signal<PhotoRow[]>([]);

/** Objectifs de poids, du plus haut au plus bas (68 puis 65). */
export const weightGoals = signal<number[]>([]);

/** Invitation au tour de taille repoussée jusqu'à ce jour. */
export const waistSnoozedUntil = signal<string | undefined>(undefined);

/** Tendance à chaque pesée. */
export const trend = computed(() => trendSeries(weights.value));

/** Résumé du jour : tendance, rythme, projection. */
export const summary = computed(() => bodySummary(weights.value, weightGoals.value, dayKey(new Date())));

/** Tours de taille seuls. */
export const waists = computed(() => measures.value.filter((m) => m.kind === 'waist'));

/** Tours de bras et de poitrine (J3b). */
export const arms = computed(() => measures.value.filter((m) => m.kind === 'arm'));
export const chests = computed(() => measures.value.filter((m) => m.kind === 'chest'));

export async function loadBodyState(): Promise<void> {
  const [m, p, goals, snooze] = await Promise.all([listMeasures(), listPhotos(), getSetting('weightGoals'), getSetting('waistSnoozedUntil')]);
  measures.value = m;
  photos.value = p;
  weightGoals.value = goals ?? [];
  waistSnoozedUntil.value = snooze;
}

// ─── Objectifs ───

/** Enregistre les étapes d'objectif (triées de la plus haute à la plus basse). */
export async function saveGoals(goals: number[]): Promise<void> {
  const sorted = [...new Set(goals)].sort((a, b) => b - a);
  weightGoals.value = sorted;
  await setSetting('weightGoals', sorted);
  track('goals', { count: sorted.length });
}

// ─── Pesées ───

export async function removeWeight(day: string): Promise<void> {
  await deleteWeight(day);
  weights.value = weights.value.filter((w) => w.day !== day);
  track('weight-delete');
}

// ─── Mensurations ───

/** Enregistre une mesure du jour (la dernière du même type le même jour remplace). */
export async function recordMeasure(kind: MeasureKind, cm: number, at = new Date()): Promise<void> {
  const day = dayKey(at);
  const entry: MeasureEntry = { id: measureId(kind, day), kind, day, at: at.toISOString(), value: Math.round(cm * 10) / 10 };
  await saveMeasure(entry);
  measures.value = [...measures.value.filter((m) => m.id !== entry.id), entry].sort((a, b) => a.day.localeCompare(b.day));
  track(kind === 'waist' ? 'waist' : 'measure', kind === 'waist' ? { action: 'record' } : { action: 'record', kind });
}

export function recordWaist(cm: number, at = new Date()): Promise<void> {
  return recordMeasure('waist', cm, at);
}

/** « Pas cette fois » : on reposera la question dans une semaine. */
export async function snoozeWaist(days = 7): Promise<void> {
  const until = addDays(dayKey(new Date()), days);
  waistSnoozedUntil.value = until;
  await setSetting('waistSnoozedUntil', until);
  track('waist', { action: 'snooze' });
}

export async function removeMeasure(id: string): Promise<void> {
  const kind = measures.value.find((m) => m.id === id)?.kind;
  await deleteMeasure(id);
  measures.value = measures.value.filter((m) => m.id !== id);
  track(kind === 'waist' || !kind ? 'waist' : 'measure', kind && kind !== 'waist' ? { action: 'delete', kind } : { action: 'delete' });
}

// ─── Photos ───

export async function addPhoto(
  pose: PhotoPose,
  image: { blob: Blob; width: number; height: number },
  meta: { source: 'camera' | 'file'; timer: number; mode: PhotoMode; locationId?: string },
  at = new Date(),
): Promise<void> {
  const day = dayKey(at);
  const { mode, locationId, ...usage } = meta;
  await savePhoto({ day, month: day.slice(0, 7), pose, mode, ...(locationId ? { locationId } : {}), at: at.toISOString(), ...image });
  photos.value = await listPhotos();
  track('photo', { pose, mode, ...usage });
}

export async function removePhotos(month: string): Promise<void> {
  await deletePhotos(month);
  photos.value = photos.value.filter((p) => p.month !== month);
  track('photo-delete');
}
