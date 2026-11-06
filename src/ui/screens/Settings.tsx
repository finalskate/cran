/**
 * Écran « Réglages ». Au J0 : effets visuels, état du stockage persistant (SPEC §3.1), version.
 */
import { useEffect, useState } from 'preact/hooks';
import { SCHEMA_VERSION } from '../../data/db';
import type { FxLevel } from '../../data/settings';
import { getStorageInfo, type StorageInfo } from '../../data/storage';
import { offlineReady } from '../../pwa/registerSW';
import { formatBytes } from '../format';
import { fx, persistState, refreshPersistence, setFx } from '../state';

const FX_OPTIONS: { value: FxLevel; label: string }[] = [
  { value: 'full', label: 'Complets' },
  { value: 'reduced', label: 'Réduits' },
];

/** Libellé et style de l'état de persistance. */
function persistLabel(state: string): { text: string; ok: boolean } {
  switch (state) {
    case 'granted':
      return { text: 'Protégé', ok: true };
    case 'unsupported':
      return { text: 'Non géré par ce navigateur', ok: false };
    case 'unknown':
      return { text: 'Vérification…', ok: false };
    default:
      return { text: 'Non protégé', ok: false };
  }
}

export function Settings() {
  const [info, setInfo] = useState<StorageInfo | null>(null);

  // Espace utilisé : relu à l'ouverture de l'écran et après chaque nouvelle demande.
  useEffect(() => {
    void getStorageInfo().then(setInfo);
  }, [persistState.value]);

  const persist = persistLabel(persistState.value);

  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Cran</span>
        <h1 class="screen-header__title">Réglages</h1>
      </header>

      <section class="card" aria-labelledby="fx-title">
        <span id="fx-title" class="card__label">
          Effets visuels
        </span>
        <div class="segmented" role="group" aria-labelledby="fx-title">
          {FX_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              class="btn"
              type="button"
              aria-pressed={fx.value === opt.value}
              onClick={() => void setFx(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
          « Réduits » retire les halos et le flou : utile si la batterie est faible ou le téléphone lent.
        </p>
      </section>

      <section class="card" aria-labelledby="storage-title">
        <span id="storage-title" class="card__label">
          Données
        </span>
        <div class="row">
          <span>Stockage</span>
          <span class={`status ${persist.ok ? 'status--ok' : 'status--warn'}`}>{persist.text}</span>
        </div>
        {persistState.value === 'denied' && (
          <>
            <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
              Android pourrait effacer les données si l'espace manque. Installe l'appli sur l'écran
              d'accueil, puis réessaie.
            </p>
            <button class="btn" type="button" onClick={() => void refreshPersistence()}>
              Réessayer
            </button>
          </>
        )}
        {info?.usage !== undefined && (
          <div class="row">
            <span>Espace utilisé</span>
            <span class="muted">{formatBytes(info.usage)}</span>
          </div>
        )}
        <div class="row">
          <span>Mode avion</span>
          <span class={`status ${offlineReady.value ? 'status--ok' : 'status--warn'}`}>
            {offlineReady.value ? 'Prêt' : 'Mise en cache…'}
          </span>
        </div>
      </section>

      <section class="card" aria-labelledby="about-title">
        <span id="about-title" class="card__label">
          À propos
        </span>
        <div class="row">
          <span>Version</span>
          <span class="muted">{__APP_VERSION__}</span>
        </div>
        <div class="row">
          <span>Schéma de données</span>
          <span class="muted">v{SCHEMA_VERSION}</span>
        </div>
      </section>
    </main>
  );
}
