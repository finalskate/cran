/**
 * Rappel de sauvegarde (J6a, SPEC §4.11) : discret, sur l'accueil, si aucun export depuis 7 jours.
 * Rien n'est envoyé automatiquement (choix du 07/11 : l'export se fait à la main, parfois sans
 * réseau) ; « Plus tard » le fait taire quelques jours. Fonction pure, testée dans reminders.test.ts.
 */
import { dayKey, daysBetween } from './days';

/** Jours sans export avant le rappel. */
export const EXPORT_REMINDER_DAYS = 7;
/** « Plus tard » : le rappel revient après ce nombre de jours. */
export const EXPORT_SNOOZE_DAYS = 3;

/**
 * Le rappel est-il dû aujourd'hui ? Renvoie le nombre de jours depuis le dernier export (`null` :
 * jamais exporté, compté alors depuis l'installation), ou `null` s'il n'y a rien à rappeler.
 * Les dates sont des ISO (export, installation) et un jour local (« Plus tard » jusqu'au…).
 */
export function exportReminder(
  lastExportAt: string | undefined,
  installedAt: string | undefined,
  snoozedUntil: string | undefined,
  today: string,
): { since: number | null } | null {
  if (snoozedUntil && today <= snoozedUntil) return null;
  const ref = lastExportAt || installedAt;
  if (!ref) return null;
  const days = daysBetween(dayKey(new Date(ref)), today);
  if (days < EXPORT_REMINDER_DAYS) return null;
  return { since: lastExportAt ? days : null };
}
