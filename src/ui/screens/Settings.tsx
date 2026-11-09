/**
 * Écran « Réglages ». Au J0 : effets visuels, état du stockage persistant (SPEC §3.1), version.
 * Retouches J1 : export complet des données (sauvegarde et journal d'usage, SPEC §4.11).
 * J5a : objectif de la semaine (renfos et cardio) ; lien vers les lieux (sorti de l'accueil).
 * J6a : mode pause ; import d'une sauvegarde (validée, puis remplacement complet après accord).
 */
import { useEffect, useState } from 'preact/hooks';
import { SCHEMA_VERSION } from '../../data/db';
import { parseBackup, type ExportFile } from '../../data/backup';
import { db } from '../../data/db';
import type { FxLevel } from '../../data/settings';
import { getStorageInfo, type StorageInfo } from '../../data/storage';
import { offlineReady } from '../../pwa/registerSW';
import { Stepper } from '../components/Stepper';
import { Toggle } from '../components/Toggle';
import { WEEK_GOAL_MAX } from '../../domain/week';
import { PHASES } from '../../data/phases';
import { dayToDate } from '../../domain/days';
import { PhaseSheet } from '../components/PhaseSheet';
import { cancelPhaseChange, currentPhase, nextPhase, setWeekGoal } from '../phaseState';
import { photos } from '../bodyState';
import {
  notify,
  notifyPermission,
  requestNotifyPermission,
  speak,
  unlockAudio,
  voiceAvailable,
} from '../device/feedback';
import { ImportSheet } from '../components/ImportSheet';
import { PauseSheet } from '../components/PauseSheet';
import { currentPause, resume, runExport } from '../weekState';
import { formatBytes, formatLongDate, formatShortDate } from '../format';
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
  const lastExport = p.lastExportAt;
  const [exporting, setExporting] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [importing, setImporting] = useState<ExportFile | null>(null);
  const [importError, setImportError] = useState('');
  const pause = currentPause();
  // Photos exclues par défaut (SPEC §4.9) : à cocher à chaque export, jamais mémorisé.
  const [includePhotos, setIncludePhotos] = useState(false);
  const [choosingPhase, setChoosingPhase] = useState(false);
  const phase = currentPhase();
  const scheduled = nextPhase();
  const photoBytes = photos.value.reduce((n, ph) => n + ph.blob.size, 0);

  async function exportNow() {
    setExporting(true);
    try {
      await runExport(includePhotos, 'settings');
    } catch (e) {
      alert(`L’export a échoué : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  /** Fichier choisi pour l'import : lu et validé en entier avant de montrer quoi que ce soit. */
  async function pickBackup(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = ''; // le même fichier pourra être choisi de nouveau
    if (!file) return;
    setImportError('');
    const parsed = parseBackup(await file.text(), db);
    if (parsed.ok) setImporting(parsed.file);
    else setImportError(parsed.error);
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

      <section class="card" aria-labelledby="phase-title">
        <span id="phase-title" class="card__label">
          Phase
        </span>
        <span class="card__title">{phase ? PHASES[phase.id].label : 'Aucune phase choisie'}</span>
        <span class="muted">
          {phase
            ? `Depuis le ${formatShortDate(dayToDate(phase.since))} · ${PHASES[phase.id].description}`
            : 'Choisis-la quand tu commences pour de bon : lieu, objectif, cardio et assiette suivent.'}
        </span>
        {scheduled && (
          <div class="row">
            <span>
              Puis {PHASES[scheduled.id].label} le {formatShortDate(dayToDate(scheduled.since))}
            </span>
            <button type="button" class="btn btn--small btn--quiet" onClick={() => void cancelPhaseChange()}>
              Annuler
            </button>
          </div>
        )}
        <button type="button" class="btn" onClick={() => setChoosingPhase(true)}>
          Changer de phase
        </button>
      </section>
      {choosingPhase && <PhaseSheet onClose={() => setChoosingPhase(false)} />}

      <section class="card" aria-labelledby="goal-title">
        <span id="goal-title" class="card__label">
          Objectif de la semaine{phase ? ` · ${PHASES[phase.id].label}` : ''}
        </span>
        <div class="row">
          <span>Renfo</span>
          <Stepper
            label="Séances de renfo par semaine"
            value={p.weekGoal.strength}
            onChange={(v) => void setWeekGoal({ ...p.weekGoal, strength: v })}
            step={1}
            min={0}
            max={WEEK_GOAL_MAX}
            format={(v) => `${v} / sem.`}
          />
        </div>
        <div class="row">
          <span>Cardio</span>
          <Stepper
            label="Séances de cardio par semaine"
            value={p.weekGoal.cardio}
            onChange={(v) => void setWeekGoal({ ...p.weekGoal, cardio: v })}
            step={1}
            min={0}
            max={WEEK_GOAL_MAX}
            format={(v) => `${v} / sem.`}
          />
        </div>
        <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
          Une séance de 10 min compte. Cardio : course, vélo, séance imposée de course. Le vélotaf est noté à part.
        </p>
      </section>

      <section class="card" aria-labelledby="pause-title">
        <span id="pause-title" class="card__label">
          Mode pause
        </span>
        {pause ? (
          <>
            <span class="card__title">
              En pause {pause.until ? `jusqu’au ${formatShortDate(dayToDate(pause.until))}` : 'jusqu’à nouvel ordre'}
            </span>
            <span class="muted">L’objectif de la semaine est suspendu depuis le {formatShortDate(dayToDate(pause.from))}</span>
            <div class="segmented">
              <button type="button" class="btn" onClick={() => setPausing(true)}>
                Changer la fin
              </button>
              <button type="button" class="btn btn--accent" onClick={() => void resume()}>
                Reprendre
              </button>
            </div>
          </>
        ) : (
          <>
            <span class="muted">Malade, blessé, une semaine impossible : l’objectif est suspendu, rien n’est perdu.</span>
            <button type="button" class="btn" onClick={() => setPausing(true)}>
              Faire une pause
            </button>
          </>
        )}
      </section>
      {pausing && <PauseSheet onClose={() => setPausing(false)} />}

      <a class="card card--link" href="#/lieux">
        <span class="card__label">Lieux</span>
        <span class="card__title">Lieux, matériel et élastiques</span>
        <span class="muted">Ce que la séance peut utiliser à chaque endroit. →</span>
      </a>

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
        <button type="button" class="btn" disabled={exporting} onClick={() => void exportNow()}>
          {exporting ? 'Préparation…' : 'Exporter mes données'}
        </button>
        <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
          Tout dans un fichier : séances, niveaux, alimentation, pesées, réglages et journal d’usage. Partage-le vers OneDrive pour
          le garder à l’abri (et me le faire lire).
          {lastExport ? ` Dernier export : ${formatLongDate(new Date(lastExport)).toLowerCase()}.` : ' Aucun export pour l’instant.'}
        </p>
        <label class="btn btn--quiet file-btn">
          Importer une sauvegarde
          <input
            type="file"
            accept=".json,.txt,application/json,text/plain"
            class="visually-hidden"
            onChange={(e) => void pickBackup(e.currentTarget)}
          />
        </label>
        {importError && (
          <p class="notice-line" role="alert" style={{ margin: 0 }}>
            {importError}
          </p>
        )}
        <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
          Nouveau téléphone, ou appli réinstallée : choisis un export (.json ou .txt). Rien n’est remplacé avant ton accord.
        </p>
        <div class="row">
          <span>Mode avion</span>
          <span class={`status ${offlineReady.value ? 'status--ok' : 'status--warn'}`}>
            {offlineReady.value ? 'Prêt' : 'Mise en cache…'}
          </span>
        </div>
      </section>

      {importing && <ImportSheet file={importing} onClose={() => setImporting(null)} />}

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
