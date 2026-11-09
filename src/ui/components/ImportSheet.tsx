/**
 * Import d'une sauvegarde (J6a, SPEC §4.11), après validation complète du fichier (parseBackup) :
 * on montre ce qu'il contient et ce qu'il va remplacer, on propose d'exporter d'abord ce qui est
 * sur le téléphone, puis on remplace tout en une fois. L'appli redémarre ensuite pour tout relire.
 */
import { useState } from 'preact/hooks';
import { backupSummary, restoreBackup, type ExportFile } from '../../data/backup';
import { db } from '../../data/db';
import { track } from '../../data/usage';
import { photos } from '../bodyState';
import { weights } from '../foodState';
import { formatLongDate } from '../format';
import { activities, workouts } from '../training';
import { runExport } from '../weekState';
import { Sheet } from './Sheet';

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function ImportSheet({ file, onClose }: { file: ExportFile; onClose: () => void }) {
  const summary = backupSummary(file);
  const [step, setStep] = useState<'review' | 'working' | 'error'>('review');
  const [error, setError] = useState('');
  const [exported, setExported] = useState(false);
  const exportedAt = new Date(summary.exportedAt);
  const when = Number.isNaN(exportedAt.getTime())
    ? 'date inconnue'
    : `${formatLongDate(exportedAt).toLowerCase()} à ${exportedAt.getHours()} h ${String(exportedAt.getMinutes()).padStart(2, '0')}`;
  const here = {
    workouts: workouts.value.filter((w) => w.entries.some((e) => e.sets.length > 0)).length,
    activities: activities.value.length,
    weights: weights.value.length,
  };

  async function exportFirst() {
    try {
      const outcome = await runExport(false, 'import');
      if (outcome !== 'cancelled') setExported(true);
    } catch (e) {
      alert(`L’export a échoué : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function replace() {
    if (!confirm('Remplacer toutes les données de ce téléphone par cette sauvegarde ?')) return;
    setStep('working');
    try {
      await restoreBackup(db, file);
      track('import', { schemaVersion: file.schemaVersion, photos: summary.photos > 0 });
      // Laisse le journal s'écrire, puis relance l'appli : tous les écrans relisent la base.
      setTimeout(() => location.reload(), 300);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('error');
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Importer une sauvegarde"
      footer={
        step === 'review' && (
          <button type="button" class="btn btn--danger btn--block" onClick={() => void replace()}>
            Remplacer par cette sauvegarde
          </button>
        )
      }
    >
      {step === 'error' ? (
        <p style={{ margin: 0 }}>
          L’import n’a pas abouti, rien n’a été changé sur le téléphone. <span class="muted">({error})</span>
        </p>
      ) : (
        <>
          <div class="import-block">
            <span class="card__label">Cette sauvegarde</span>
            <span>Export du {when}</span>
            <span class="muted">
              {plural(summary.workouts, 'séance', 'séances')} · {plural(summary.activities, 'activité', 'activités')} ·{' '}
              {plural(summary.foodDays, 'journée notée', 'journées notées')} · {plural(summary.weights, 'pesée', 'pesées')}
              {summary.photos > 0 ? ` · ${plural(summary.photos, 'photo', 'photos')}` : ''}
            </span>
          </div>
          <div class="import-block">
            <span class="card__label">Sur ce téléphone, remplacé</span>
            <span class="muted">
              {plural(here.workouts, 'séance', 'séances')} · {plural(here.activities, 'activité', 'activités')} ·{' '}
              {plural(here.weights, 'pesée', 'pesées')}, avec l’assiette, les niveaux et les réglages.
              {summary.photos === 0 && photos.value.length > 0
                ? ` Tes ${plural(photos.value.length, 'photo reste', 'photos restent')} : le fichier n’en contient pas.`
                : ''}
            </span>
          </div>
          {step === 'working' ? (
            <p class="muted">Import en cours…</p>
          ) : (
            <button type="button" class="btn" disabled={exported} onClick={() => void exportFirst()}>
              {exported ? 'Données actuelles exportées ✓' : 'Exporter d’abord ce qui est ici'}
            </button>
          )}
        </>
      )}
    </Sheet>
  );
}
