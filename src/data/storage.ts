/**
 * Stockage persistant (SPEC §3.1).
 *
 * Sans persistance, Android peut effacer les données d'un site quand l'espace manque.
 * `navigator.storage.persist()` demande au navigateur de ne jamais les purger.
 *
 * Chrome ne pose aucune question à l'utilisateur : il accorde ou refuse selon des critères internes
 * (appli installée sur l'écran d'accueil, site fréquenté…). En pratique la demande échoue
 * souvent avant l'installation et réussit après. On la renouvelle donc à chaque lancement
 * tant qu'elle n'est pas accordée : l'appel est silencieux et sans coût.
 */

export type PersistState = 'granted' | 'denied' | 'unsupported';

export interface StorageInfo {
  persist: PersistState;
  /** Octets utilisés par l'appli, si le navigateur sait le dire. */
  usage?: number;
}

/** État actuel, sans rien demander. */
export async function getPersistState(): Promise<PersistState> {
  if (!navigator.storage?.persisted) return 'unsupported';
  return (await navigator.storage.persisted()) ? 'granted' : 'denied';
}

/** Demande la persistance si elle n'est pas déjà accordée ; renvoie l'état obtenu. */
export async function ensurePersistence(): Promise<PersistState> {
  const current = await getPersistState();
  if (current !== 'denied') return current;
  try {
    return (await navigator.storage.persist()) ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** État + espace utilisé, pour l'écran Réglages. */
export async function getStorageInfo(): Promise<StorageInfo> {
  const persist = await getPersistState();
  try {
    const estimate = await navigator.storage?.estimate?.();
    return { persist, usage: estimate?.usage };
  } catch {
    return { persist };
  }
}
