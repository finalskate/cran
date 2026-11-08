/**
 * Écran « Réglages ». Au J0 : effets visuels, état du stockage persistant (SPEC §3.1), version.
 * Retouches J1 : export complet des données (sauvegarde et journal d'usage, SPEC §4.11).
 */
import { useEffect, useState } from 'preact/hooks';
import { SCHEMA_VERSION } from '../../data/db';
import { getSetting, setSetting, type FxLevel } from '../../data/settings';
import { getStorageInfo, type StorageInfo } from '../../data/storage';
import { track } from '../../data/usage';
import { offlineReady } from '../../pwa/registerSW';
import { Toggle } from '../components/Toggle';
import { photos } from '../bodyState';
import {
  notify,
  notifyPermission,
  requestNotifyPermission,
  speak,
  unlockAudio,
  voiceAvailable,
} from '../device/feedback';
import { exportData } from '../device/exportFile';
import { formatBytes, formatLongDate } from '../format';
import { persistState, prefs, refreshPersistence, setFx, setPref } from '../state';

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

  const p = prefs.value;
  const [notifyState, setNotifyState] = useState(notifyPermission());
  const [lastExport, setLastExport] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  // Photos exclues par défaut (SPEC §4.9) : à cocher à chaque export, jamais mémorisé.
  const [includePhotos, setIncludePhotos] = useState(false);
  const photoBytes = photos.value.reduce((n, ph) => n + ph.blob.size, 0);

  useEffect(() => {
    void getSetting('lastExportAt').then(setLastExport);
  }, []);

  async function runExport() {
    setExporting(true);
    try {
      const outcome = await exportData({ includePhotos });
      track('export', { outcome, photos: includePhotos });
      if (outcome !== 'cancelled') {
        const at = new Date().toISOString();
        await setSetting('lastExportAt', at);
        setLastExport(at);
      }
    } catch (e) {
      alert(`L’export a échoué : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  /** Activer la notification demande l'autorisation Android dans la foulée. */
  async function toggleNotify(on: boolean) {
    if (on) setNotifyState(await requestNotifyPermission());
    await setPref('watchNotify', on);
  }

  /** Test réel : 5 s pour verrouiller l'écran ou poser le téléphone et sentir la montre vibrer. */
  async function testNotify() {
    const permission = await requestNotifyPermission();
    setNotifyState(permission);
    unlockAudio();
    setTimeout(() => void notify('Repos terminé', 'Test : pompes archer, série 2 sur 3'), 5000);
  }

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
              aria-pressed={prefs.value.fx === opt.value}
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

      <section class="card" aria-labelledby="photo-title">
        <span id="photo-title" class="card__label">
          Photos de progression
        </span>
        <Toggle
          label="Flouter les photos"
          hint="Floutées jusqu’au toucher, si quelqu’un regarde ton écran"
          checked={p.photoBlur}
          onChange={(v) => void setPref('photoBlur', v)}
        />
      </section>

      <section class="card" aria-labelledby="session-title">
        <span id="session-title" class="card__label">
          Pendant la séance
        </span>
        <Toggle
          label="Règle poignet"
          hint="Pompes sur poignées ou sur les poings, jamais main à plat"
          checked={p.wristRule}
          onChange={(v) => void setPref('wristRule', v)}
        />
        <Toggle label="Vibration en fin de repos" checked={p.vibration} onChange={(v) => void setPref('vibration', v)} />
        <Toggle label="Bip en fin de repos" checked={p.beep} onChange={(v) => void setPref('beep', v)} />
        <Toggle
          label="Annonces vocales"
          hint={voiceAvailable() ? 'Pratique au casque, téléphone posé' : 'Synthèse vocale indisponible'}
          checked={p.voice}
          onChange={(v) => void setPref('voice', v)}
        />
        {p.voice && (
          <button type="button" class="btn btn--small" onClick={() => speak('Repos terminé. Pompes archer, série 2 sur 3.')}>
            Tester la voix
          </button>
        )}
        <Toggle
          label="Notification en fin de repos"
          hint="La montre la relaie et vibre au poignet"
          checked={p.watchNotify}
          onChange={(v) => void toggleNotify(v)}
        />
        {p.watchNotify && (
          <>
            <button type="button" class="btn btn--small" onClick={() => void testNotify()}>
              Tester dans 5 s
            </button>
            {notifyState === 'denied' && (
              <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
                Notifications refusées : autorise-les dans les réglages Android de l’appli Cran.
              </p>
            )}
          </>
        )}
        <Toggle
          label="Rappel « activité montre »"
          hint="Au démarrage : lancer « Musculation » sur la montre"
          checked={p.watchReminder}
          onChange={(v) => void setPref('watchReminder', v)}
        />
      </section>

      <a class="card card--link" href="#/profil">
        <span class="card__label">Profil</span>
        <span class="card__title">Objectifs, priorité et cible du jour</span>
        <span class="muted">
          Priorité : {prefs.value.focus === 'upper' ? 'haut du corps' : 'équilibrée'}. Poids visé, activité, et le détail du calcul. →
        </span>
      </a>

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
        {photos.value.length > 0 && (
          <Toggle
            label="Inclure les photos"
            hint={`${photos.value.length} photo${photos.value.length > 1 ? 's' : ''}, environ ${formatBytes(photoBytes * 1.34)} de plus`}
            checked={includePhotos}
            onChange={setIncludePhotos}
          />
        )}
        <button type="button" class="btn" disabled={exporting} onClick={() => void runExport()}>
          {exporting ? 'Préparation…' : 'Exporter mes données'}
        </button>
        <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
          Tout dans un fichier : séances, niveaux, alimentation, pesées, réglages et journal d’usage. Partage-le vers OneDrive pour
          le garder à l’abri (et me le faire lire).
          {lastExport ? ` Dernier export : ${formatLongDate(new Date(lastExport)).toLowerCase()}.` : ' Aucun export pour l’instant.'}
        </p>
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
        {/* Mentions exigées par les licences des bases d'aliments. */}
        <p class="muted calc__note">
          Aliments génériques : table Ciqual 2025 de l’Anses (licence ouverte Etalab 2.0). Produits scannés : Open Food
          Facts (licence ODbL).
        </p>
      </section>
    </main>
  );
}
