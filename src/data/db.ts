/**
 * Base locale IndexedDB (via Dexie). Toutes les données de l'utilisateur vivent ici, sur le téléphone.
 *
 * ─── Règles de versionnement (à lire avant toute modification) ───
 * 1. Ne JAMAIS modifier une version existante : chaque changement de schéma ajoute une version.
 * 2. Une nouvelle version redéclare uniquement les tables qui changent (Dexie garde les autres).
 * 3. Si des données existantes doivent être transformées, ajouter un `.upgrade(tx => …)`.
 * 4. Mettre à jour SCHEMA_VERSION (elle est écrite dans les exports JSON, SPEC §4.11).
 * 5. Ajouter un test de migration dans db.test.ts (ouvrir l'ancienne version, la remplir, rouvrir).
 *
 * Exemple pour une future version 2 :
 *   this.version(2)
 *     .stores({ workouts: '++id, date, location' })
 *     .upgrade(async (tx) => { … });
 *
 * Seuls les champs indexés figurent dans `stores()` ; les autres champs sont stockés librement.
 */
import Dexie, { type Table } from 'dexie';

/** Nom de la base dans le navigateur. */
export const DB_NAME = 'cran';

/** Version courante du schéma. Doit toujours égaler la plus haute version déclarée ci-dessous. */
export const SCHEMA_VERSION = 1;

/** Un réglage : paire clé → valeur (voir src/data/settings.ts pour les clés typées). */
export interface SettingRow {
  key: string;
  value: unknown;
}

export class CranDB extends Dexie {
  settings!: Table<SettingRow, string>;

  /** Le nom est paramétrable pour que les tests utilisent chacun leur propre base. */
  constructor(name: string = DB_NAME) {
    super(name);

    // v1 — J0 : réglages uniquement (clé primaire unique « key »).
    this.version(1).stores({
      settings: '&key',
    });
  }
}

/** Instance partagée par toute l'appli. */
export const db = new CranDB();
