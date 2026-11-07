/**
 * Sortie du fichier d'export vers l'extérieur du téléphone.
 *
 * 1. Partage Android (Web Share) : l'utilisateur choisit OneDrive, Drive, un mail… C'est le
 *    plus pratique, mais Chrome n'accepte qu'une liste fermée de types de fichiers, sans JSON :
 *    on partage donc le même contenu en texte (.txt) quand le .json est refusé.
 * 2. Sinon (ordinateur, navigateur sans partage de fichiers) : téléchargement du .json.
 */
import { buildExport, exportFileName } from '../../data/backup';
import { db } from '../../data/db';

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled';

export async function exportData(now = new Date()): Promise<ExportOutcome> {
  const data = await buildExport(db, __APP_VERSION__, now);
  // Indentation légère : lisible à l'œil, sans gonfler le fichier.
  const text = JSON.stringify(data, null, 1);
  const name = exportFileName(now);

  const candidates = [
    new File([text], name, { type: 'application/json' }),
    new File([text], name.replace(/\.json$/, '.txt'), { type: 'text/plain' }),
  ];
  const shareable = candidates.find((f) => navigator.canShare?.({ files: [f] }));
  if (shareable) {
    try {
      await navigator.share({ files: [shareable], title: 'Export Cran' });
      return 'shared';
    } catch (e) {
      // L'utilisateur a fermé le menu de partage : ce n'est pas une erreur.
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // Autre échec du partage : on se rabat sur le téléchargement.
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
