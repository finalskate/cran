/**
 * Enregistrement du service worker et suivi des mises à jour.
 *
 * Le service worker met en cache tous les fichiers de l'appli : après la première visite,
 * elle s'ouvre sans réseau. Quand une nouvelle version est déployée, elle est téléchargée
 * en arrière-plan puis **proposée** (signal `updateAvailable`), jamais imposée : l'utilisateur
 * choisit le moment, pour ne pas couper une séance en cours.
 */
import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

/** Une nouvelle version est prête et attend l'accord de l'utilisateur. */
export const updateAvailable = signal(false);

/** L'appli est entièrement en cache : elle fonctionnera en mode avion. */
export const offlineReady = signal(false);

/** Fréquence de vérification des mises à jour quand l'appli reste ouverte longtemps. */
const UPDATE_CHECK_MS = 60 * 60 * 1000; // 1 h

let applyUpdateFn: ((reload?: boolean) => Promise<void>) | undefined;

export function initPwa(): void {
  if (!('serviceWorker' in navigator)) return;

  // Lancements suivants : un service worker contrôle déjà la page, le cache est en place.
  offlineReady.value = navigator.serviceWorker.controller !== null;

  applyUpdateFn = registerSW({
    onNeedRefresh() {
      updateAvailable.value = true;
    },
    onOfflineReady() {
      // Premier lancement : le précache vient de se terminer.
      offlineReady.value = true;
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        // Pas de réseau : inutile d'essayer (et ça éviterait une erreur dans la console).
        if (navigator.onLine) void registration.update();
      }, UPDATE_CHECK_MS);
    },
  });
}

/** Installe la nouvelle version et recharge la page. */
export function applyUpdate(): void {
  void applyUpdateFn?.(true);
}

/** Masque le bandeau jusqu'au prochain lancement. */
export function postponeUpdate(): void {
  updateAvailable.value = false;
}
