/**
 * Export complet des données (SPEC §4.11), en JSON lisible.
 *
 * Toutes les tables y sont, journal d'usage compris : le fichier sert à la fois de sauvegarde
 * et de matière pour améliorer l'appli. L'import (avec validation avant d'écraser) arrive au J6.
 *
 * Photos de progression (J3, SPEC §4.9) : exclues par défaut (poids du fichier, et elles ne
 * doivent pas circuler sans le vouloir). Sur demande, chaque image est incluse en base64
 * (`dataUrl`) à la place du Blob, que JSON ne sait pas représenter.
 */
import { SCHEMA_VERSION, type CranDB, type PhotoRow } from './db';

export interface ExportFile {
  app: 'cran';
  /** Version du schéma de la base : l'import saura quelles migrations appliquer. */
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  /** Contenu brut de chaque table, par nom de table. */
  tables: Record<string, unknown[]>;
  /** Nombre de photos laissées de côté (table `photos` vide dans le fichier). */
  photosExcluded?: number;
}

export interface ExportOptions {
  includePhotos?: boolean;
}

/** Photo telle qu'elle figure dans un export qui inclut les images. */
export type ExportedPhoto = Omit<PhotoRow, 'blob'> & { dataUrl: string };

/** « data:image/jpeg;base64,… » d'un Blob, sans FileReader (fonctionne aussi sous Node pour les tests). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Par paquets : String.fromCharCode(...tout) dépasserait la taille de pile sur une image.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

/** Lit toutes les tables en une transaction (instantané cohérent). */
export async function buildExport(database: CranDB, appVersion: string, now: Date, options: ExportOptions = {}): Promise<ExportFile> {
  const tables: Record<string, unknown[]> = {};
  await database.transaction('r', database.tables, async () => {
    for (const table of database.tables) tables[table.name] = await table.toArray();
  });
  const file: ExportFile = { app: 'cran', schemaVersion: SCHEMA_VERSION, appVersion, exportedAt: now.toISOString(), tables };

  // Conversion hors transaction : lire un Blob n'est pas une opération IndexedDB.
  const photos = (tables.photos ?? []) as PhotoRow[];
  if (options.includePhotos) {
    tables.photos = await Promise.all(
      photos.map(async ({ blob, ...meta }): Promise<ExportedPhoto> => ({ ...meta, dataUrl: await blobToDataUrl(blob) })),
    );
  } else {
    tables.photos = [];
    if (photos.length > 0) file.photosExcluded = photos.length;
  }
  return file;
}

/** « cran-export-2026-11-07-1830.json » : triable, sans caractère gênant pour Android ou OneDrive. */
export function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `cran-export-${day}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}
