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
 * Seuls les champs indexés figurent dans `stores()` ; les autres champs sont stockés librement.
 *
 * Historique :
 *  - v1 (J0) : settings.
 *  - v2 (J1) : locations, levels, kneeLogs, workouts, activeSession ; lieux par défaut créés.
 *  - v3 (retouches J1) : events (journal d'usage local, cf. src/data/usage.ts).
 */
import Dexie, { type Table, type Transaction } from 'dexie';
import type { WorkoutRecord } from '../domain/history';
import type { SessionState } from '../domain/session';
import type { Location } from '../domain/types';
import { DEFAULT_LOCATIONS } from './equipment';

/** Nom de la base dans le navigateur. */
export const DB_NAME = 'cran';

/** Version courante du schéma. Doit toujours égaler la plus haute version déclarée ci-dessous. */
export const SCHEMA_VERSION = 3;

/** Un réglage : paire clé → valeur (voir src/data/settings.ts pour les clés typées). */
export interface SettingRow {
  key: string;
  value: unknown;
}

/** Niveau choisi pour un mouvement (index dans son échelle). */
export interface LevelRow {
  movementId: string;
  level: number;
  updatedAt: string;
}

/** Score de douleur au genou (SPEC §4.6). */
export interface KneeLogRow {
  id?: number;
  date: string;
  score: number;
  side?: 'left' | 'right' | 'both';
  context: 'session' | 'run' | 'morning';
}

/**
 * Événement du journal d'usage : ce qui se passe dans l'appli (écran vu, série validée, repos…).
 * Reste sur le téléphone ; n'en sort que dans un export choisi par l'utilisateur.
 */
export interface EventRow {
  id?: number;
  /** Horodatage (ms depuis l'époque). */
  at: number;
  type: string;
  data?: Record<string, unknown>;
}

/** Séance en cours (une seule ligne, clé « current »). */
export interface ActiveSessionRow {
  key: 'current';
  state: SessionState;
}

export class CranDB extends Dexie {
  settings!: Table<SettingRow, string>;
  locations!: Table<Location, string>;
  levels!: Table<LevelRow, string>;
  kneeLogs!: Table<KneeLogRow, number>;
  workouts!: Table<WorkoutRecord, number>;
  activeSession!: Table<ActiveSessionRow, string>;
  events!: Table<EventRow, number>;

  /** Le nom est paramétrable pour que les tests utilisent chacun leur propre base. */
  constructor(name: string = DB_NAME) {
    super(name);

    // v1 — J0 : réglages uniquement (clé primaire unique « key »).
    this.version(1).stores({
      settings: '&key',
    });

    // v2 — J1 : lieux, niveaux, scores genou, historique, séance en cours.
    this.version(2)
      .stores({
        locations: '&id, order',
        levels: '&movementId',
        kneeLogs: '++id, date',
        workouts: '++id, startedAt',
        activeSession: '&key',
      })
      // Base existante en v1 : on ajoute les lieux par défaut (les réglages sont conservés).
      .upgrade((tx) => seedLocations(tx));

    // v3 — journal d'usage. Nouvelle table vide : rien à transformer.
    this.version(3).stores({
      events: '++id, at',
    });

    // Base créée directement en v2 (nouvelle installation) : même contenu de départ.
    this.on('populate', (tx) => seedLocations(tx));
  }
}

async function seedLocations(tx: Transaction): Promise<void> {
  await tx.table('locations').bulkPut(DEFAULT_LOCATIONS);
}

/** Instance partagée par toute l'appli. */
export const db = new CranDB();
