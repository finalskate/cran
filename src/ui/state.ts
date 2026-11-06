/**
 * État global de l'interface, partagé entre écrans (signaux Preact).
 * Les valeurs persistantes sont relues depuis IndexedDB au démarrage puis réécrites à chaque changement.
 */
import { effect, signal } from '@preact/signals';
import { getSetting, setSetting, type FxLevel } from '../data/settings';
import { ensurePersistence, type PersistState } from '../data/storage';

/** Effets visuels (halos, flou). « reduced » = version sobre. */
export const fx = signal<FxLevel>('full');

/** État du stockage persistant (affiché dans Réglages). */
export const persistState = signal<PersistState | 'unknown'>('unknown');

/**
 * À appeler une fois au démarrage. Les deux étapes sont indépendantes : si l'une échoue
 * (base indisponible, navigateur restrictif), l'autre se fait quand même.
 */
export async function initState(): Promise<void> {
  await Promise.allSettled([loadSettings(), refreshPersistence()]);
}

async function loadSettings(): Promise<void> {
  // Premier lancement : on note la date (utile plus tard pour l'onboarding et les statistiques).
  if ((await getSetting('installedAt')) === undefined) {
    await setSetting('installedAt', new Date().toISOString());
  }
  fx.value = (await getSetting('fx')) ?? 'full';
}

/** Demande (ou redemande) la persistance et met à jour l'état affiché. */
export async function refreshPersistence(): Promise<void> {
  try {
    persistState.value = await ensurePersistence();
  } catch {
    persistState.value = 'denied';
  }
}

/** Change le niveau d'effets et l'enregistre. */
export async function setFx(level: FxLevel): Promise<void> {
  fx.value = level;
  await setSetting('fx', level);
}

// Le CSS lit l'attribut data-fx sur <html> (voir theme.css).
effect(() => {
  document.documentElement.dataset.fx = fx.value;
});
