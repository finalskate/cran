/**
 * Export complet des données (SPEC §4.11), en JSON lisible.
 *
 * Toutes les tables y sont, journal d'usage compris : le fichier sert à la fois de sauvegarde
 * et de matière pour améliorer l'appli.
 *
 * Import (J6a) : le fichier est d'abord VALIDÉ en entier (`parseBackup`) ; rien n'est touché tant
 * que l'utilisateur n'a pas vu ce qu'il contient et confirmé. Puis tout est remplacé en UNE
 * transaction (`restoreBackup`) : en cas d'erreur, la base reste telle qu'elle était. Un export
 * d'une version plus ancienne du schéma est mis à niveau comme la base l'aurait été
 * (`upgradeTables`) ; un export d'une version plus récente est refusé (mettre l'appli à jour).
 *
 * Photos de progression (J3, SPEC §4.9) : exclues par défaut (poids du fichier, et elles ne
 * doivent pas circuler sans le vouloir). Sur demande, chaque image est incluse en base64
 * (`dataUrl`) à la place du Blob, que JSON ne sait pas représenter.
 */
import { levelHistoryFrom, SCHEMA_VERSION, type CranDB, type EventRow, type LevelRow, type PhotoRow } from './db';
import { DEFAULT_LOCATIONS } from './equipment';

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

// ─── Import ───

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lit et valide un fichier d'export (son texte : .json, ou .txt quand Android l'a renommé).
 * Vérifie l'origine, la version du schéma, que chaque table existe et que chaque ligne a sa clé.
 * Ne touche à rien : la base `database` ne sert qu'à connaître les tables et leurs clés.
 */
export function parseBackup(text: string, database: CranDB): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde lisible (contenu abîmé ou tronqué ?).' };
  }
  if (!isObject(data) || data.app !== 'cran') return { ok: false, error: 'Ce fichier ne vient pas de Cran.' };
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'Version des données inconnue : le fichier a peut-être été modifié.' };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Cette sauvegarde vient d’une version plus récente de Cran. Mets l’appli à jour (bandeau « Mettre à jour », ou relance-la), puis réessaie.',
    };
  }
  if (!isObject(data.tables)) return { ok: false, error: 'Fichier incomplet : aucune donnée dedans.' };

  for (const [name, rows] of Object.entries(data.tables)) {
    const table = database.tables.find((t) => t.name === name);
    if (!table) return { ok: false, error: `Fichier inattendu : la table « ${name} » n’existe pas dans Cran.` };
    if (!Array.isArray(rows)) return { ok: false, error: `Fichier abîmé : « ${name} » n’est pas une liste.` };
    const { keyPath, auto } = table.schema.primKey;
    for (const row of rows) {
      if (!isObject(row)) return { ok: false, error: `Fichier abîmé : une ligne de « ${name} » est illisible.` };
      const key = typeof keyPath === 'string' ? row[keyPath] : undefined;
      const keyOk = auto ? key === undefined || typeof key === 'number' : typeof key === 'string' || typeof key === 'number';
      if (!keyOk) return { ok: false, error: `Fichier abîmé : une ligne de « ${name} » n’a pas d’identifiant.` };
      if (name === 'photos' && (typeof row.dataUrl !== 'string' || !row.dataUrl.startsWith('data:'))) {
        return { ok: false, error: 'Fichier abîmé : une photo est illisible.' };
      }
    }
  }
  return { ok: true, file: data as unknown as ExportFile };
}

/** Ce que contient une sauvegarde, pour le montrer avant de remplacer. */
export interface BackupSummary {
  exportedAt: string;
  appVersion: string;
  workouts: number;
  /** Courses, vélo, vélotaf, séances imposées. */
  activities: number;
  /** Journées où l'Assiette a quelque chose. */
  foodDays: number;
  weights: number;
  photos: number;
}

export function backupSummary(file: ExportFile): BackupSummary {
  const rows = (name: string) => file.tables[name] ?? [];
  return {
    exportedAt: file.exportedAt,
    appVersion: file.appVersion,
    workouts: rows('workouts').length,
    activities: rows('activities').length,
    foodDays: new Set(rows('foodLog').map((e) => (e as { day?: string }).day)).size,
    weights: rows('weights').length,
    photos: rows('photos').length,
  };
}

/**
 * Tables d'un export mises au niveau du schéma actuel, comme les migrations de db.ts l'auraient
 * fait (règle 6 de db.ts) : lieux par défaut avant la v2, historique des niveaux avant la v6.
 * Les autres versions n'ont ajouté que des tables vides. Une table absente du fichier = vide.
 */
export function upgradeTables(file: ExportFile): Record<string, unknown[]> {
  const tables: Record<string, unknown[]> = { ...file.tables };
  if (file.schemaVersion < 2 && !(tables.locations?.length)) tables.locations = [...DEFAULT_LOCATIONS];
  if (file.schemaVersion < 6 && !(tables.levelHistory?.length)) {
    tables.levelHistory = levelHistoryFrom((tables.events ?? []) as EventRow[], (tables.levels ?? []) as LevelRow[]);
  }
  return tables;
}

/** Blob d'une image « data:image/jpeg;base64,… » (inverse de blobToDataUrl). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data = ''] = dataUrl.split(',', 2);
  const type = /^data:([^;,]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Remplace TOUT le contenu de la base par celui d'un fichier validé, en une transaction.
 *  - Les photos : un fichier sans photo (cas par défaut, elles sont exclues de l'export) laisse
 *    celles du téléphone en place ; un fichier qui en contient les remplace.
 *  - Une séance en cours n'est jamais restaurée (elle appartient au moment de l'export).
 */
export async function restoreBackup(database: CranDB, file: ExportFile): Promise<void> {
  const tables = upgradeTables(file);
  const photos = (tables.photos ?? []) as ExportedPhoto[];
  const keepPhotos = photos.length === 0;
  const photoRows: PhotoRow[] = photos.map(({ dataUrl, ...meta }) => ({ ...meta, blob: dataUrlToBlob(dataUrl) }));

  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) {
      if (table.name === 'photos' && keepPhotos) continue;
      await table.clear();
      if (table.name === 'activeSession') continue;
      const rows = table.name === 'photos' ? photoRows : (tables[table.name] ?? []);
      if (rows.length > 0) await table.bulkAdd(rows as never[]);
    }
  });
}
