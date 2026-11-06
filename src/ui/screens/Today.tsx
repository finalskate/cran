/**
 * Écran « Aujourd'hui » (SPEC §4.1). Au J0 : squelette visuel et état technique de l'appli.
 * Le bouton Démarrer, l'anneau de la semaine et la carte Alimentation arrivent aux J1, J4 et J6.
 */
import { offlineReady } from '../../pwa/registerSW';
import { formatLongDate } from '../format';

export function Today() {
  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">{formatLongDate(new Date())}</span>
        <h1 class="screen-header__title">Aujourd'hui</h1>
      </header>

      <section class="card" aria-labelledby="welcome-title">
        <span class="card__label">Bienvenue</span>
        <h2 id="welcome-title" class="card__title">
          Les fondations de Cran sont posées.
        </h2>
        <p class="muted" style={{ margin: 0 }}>
          Les séances arrivent au prochain jalon. Tes données restent sur ce téléphone, sans compte
          ni serveur.
        </p>
      </section>

      <section class="card" aria-label="État hors ligne">
        <div class="row">
          <span>Mode avion</span>
          {offlineReady.value ? (
            <span class="status status--ok">Prêt</span>
          ) : (
            <span class="status status--warn">Mise en cache…</span>
          )}
        </div>
      </section>

      <div class="bottom-zone">
        <button class="cta" type="button" disabled>
          <span class="cta__title">Démarrer la séance</span>
          <span class="cta__sub">Disponible au jalon J1</span>
        </button>
      </div>
    </main>
  );
}
