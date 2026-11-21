/**
 * État partagé du sommeil (accueil du 21/11) : les nuits notées, relues au démarrage. L'accueil
 * (carte du matin, plan du moment) et Carnet › Corps lisent la même liste.
 */
import { signal } from '@preact/signals';
import { listNights, saveNight } from '../data/sleepRepo';
import { track } from '../data/usage';
import { dayKey } from '../domain/days';
import type { NightEntry, NightQuality } from '../domain/sleep';

/** Nuits, de la plus ancienne à la plus récente. */
export const nights = signal<NightEntry[]>([]);

export async function loadSleepState(): Promise<void> {
  nights.value = await listNights();
}

/** Note la nuit dernière (jour du réveil = aujourd'hui) ; une nouvelle réponse remplace la précédente. */
export async function recordNight(quality: NightQuality, now = new Date()): Promise<void> {
  const entry: NightEntry = { day: dayKey(now), at: now.toISOString(), quality };
  await saveNight(entry);
  nights.value = [...nights.value.filter((n) => n.day !== entry.day), entry].sort((a, b) => a.day.localeCompare(b.day));
  track('night', { quality });
}
