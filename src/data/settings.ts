/**
 * Accès typé aux réglages stockés dans la table `settings`.
 * Chaque nouvelle clé se déclare dans SettingsMap : le compilateur vérifie alors le type des valeurs.
 */
import { db, type CranDB } from './db';

/** Niveau d'effets visuels (SPEC §4.1) : halos et flou, ou version sobre. */
export type FxLevel = 'full' | 'reduced';

export interface SettingsMap {
  /** Date ISO du tout premier lancement. */
  installedAt: string;
  /** Effets visuels choisis par l'utilisateur. */
  fx: FxLevel;
}

export type SettingKey = keyof SettingsMap;

/** Lit un réglage ; `undefined` s'il n'a jamais été écrit. */
export async function getSetting<K extends SettingKey>(
  key: K,
  database: CranDB = db,
): Promise<SettingsMap[K] | undefined> {
  const row = await database.settings.get(key);
  return row?.value as SettingsMap[K] | undefined;
}

/** Écrit (ou remplace) un réglage. */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: SettingsMap[K],
  database: CranDB = db,
): Promise<void> {
  await database.settings.put({ key, value });
}
