/**
 * Bandeau « nouvelle version » : apparaît quand le service worker a téléchargé une mise à jour.
 * L'utilisateur choisit quand l'appliquer (jamais pendant une séance, cf. registerSW.ts).
 */
import { useState } from 'preact/hooks';
import { track } from '../../data/usage';
import { applyUpdate, markUpdateReload, postponeUpdate, updateAvailable } from '../../pwa/registerSW';

export function UpdateBanner() {
  // Un deuxième appui pendant le rechargement relançait la mise à jour (vu dans le journal).
  const [applying, setApplying] = useState(false);
  if (!updateAvailable.value) return null;

  return (
    <div class="update-banner" role="status">
      <span class="update-banner__text">Nouvelle version disponible.</span>
      <button
        class="btn btn--small"
        type="button"
        onClick={() => {
          track('update', { action: 'later' });
          postponeUpdate();
        }}
      >
        Plus tard
      </button>
      <button
        class="btn btn--small"
        type="button"
        disabled={applying}
        onClick={() => {
          setApplying(true);
          track('update', { action: 'apply' });
          markUpdateReload();
          applyUpdate();
        }}
      >
        Mettre à jour
      </button>
    </div>
  );
}
