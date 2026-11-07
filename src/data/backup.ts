/**
 * Export complet des données (SPEC §4.11), en JSON lisible.
 *
 * Toutes les tables y sont, journal d'usage compris : le fichier sert à la fois de sauvegarde
 * et de matière pour améliorer l'appli. L'import (avec validation avant d'écraser) arrive au J6.
 */
import { SCHEMA_VERSION, type CranDB } from './db';

export interface ExportFile {
  app: 'cran';
  /** Version du schéma de la base : l'import saura quelles migrations appliquer. */
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  /** Contenu brut de chaque table, par nom de table. */
  tables: Record<string, unknown[]>;
}

/** Lit toutes les tables en une transaction (instantané cohérent). */
export async function buildExport(database: CranDB, appVersion: string, now: Date): Promise<ExportFile> {
  const tables: Record<string, unknown[]> = {};
  await database.transaction('r', database.tables, async () => {
    for (const table of database.tables) tables[table.name] = await table.toArray();
  });
  return { app: 'cran', schemaVersion: SCHEMA_VERSION, appVersion, exportedAt: now.toISOString(), tables };
}

/** « cran-export-2026-11-07-1830.json » : triable, sans caractère gênant pour Android ou OneDrive. */
export function exportFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `cran-export-${day}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}
