/**
 * Bandeau « nouvelle version » : apparaît quand le service worker a téléchargé une mise à jour.
 * L'utilisateur choisit quand l'appliquer (jamais pendant une séance, cf. registerSW.ts).
 */
import { applyUpdate, postponeUpdate, updateAvailable } from '../../pwa/registerSW';

export function UpdateBanner() {
  if (!updateAvailable.value) return null;

  return (
    <div class="update-banner" role="status">
      <span class="update-banner__text">Nouvelle version disponible.</span>
      <button class="btn btn--small" type="button" onClick={postponeUpdate}>
        Plus tard
      </button>
      <button class="btn btn--small" type="button" onClick={applyUpdate}>
        Mettre à jour
      </button>
    </div>
  );
}
