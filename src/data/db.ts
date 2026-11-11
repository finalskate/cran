/**
 * Base locale IndexedDB (via Dexie). Toutes les données de l'utilisateur vivent ici, sur le téléphone.
 *
 * ─── Règles de versionnement (à lire avant toute modification) ───
 * 1. Ne JAMAIS modifier une version existante : chaque changement de schéma ajoute une version.
 * 2. Une nouvelle version redéclare uniquement les tables qui changent (Dexie garde les autres).
 * 3. Si des données existantes doivent être transformées, ajouter un `.upgrade(tx => …)`.
 * 4. Mettre à jour SCHEMA_VERSION (elle est écrite dans les exports JSON, SPEC §4.11).
 * 5. Ajouter un test de migration dans db.test.ts (ouvrir l'ancienne version, la remplir, rouvrir).
 * 6. Une migration qui transforme ou crée des données doit avoir son équivalent pour l'import
 *    d'un ancien export (`upgradeTables`, src/data/backup.ts) : un fichier de la v5 importé dans
 *    la v7 doit donner le même résultat que la base v5 migrée.
 *
 * Seuls les champs indexés figurent dans `stores()` ; les autres champs sont stockés librement.
 *
 * Historique :
 *  - v1 (J0) : settings.
 *  - v2 (J1) : locations, levels, kneeLogs, workouts, activeSession ; lieux par défaut créés.
 *  - v3 (retouches J1) : events (journal d'usage local, cf. src/data/usage.ts).
 *  - v4 (J4 phase A) : foods (aliments connus), foodLog (journal alimentaire), weights (pesées).
 *  - v5 (J2) : activities (séances imposées). J5a : course, vélo et vélotaf s'y ajoutent sans
 *    migration (même table, nouveaux `type` ; les champs non indexés sont libres).
 *  - v6 (J3) : measures (tour de taille), photos (photos de progression), levelHistory
 *    (changements de niveau, reconstitués depuis le journal d'usage pour le passé).
 *  - v7 (J4B) : reviews (bilan alimentaire du soir, un par jour).
 *  - v8 (retouche du 11/11) : remarks (remarques d'usage, avec contexte et capture facultative).
 */
import Dexie, { type Table, type Transaction } from 'dexie';
import type { WorkoutRecord } from '../domain/history';
import type { MeasureEntry, PhotoMeta } from '../domain/body';
import type { DailyReview } from '../domain/habits';
import type { Remark } from '../domain/remarks';
import type { LevelHistoryEntry } from '../domain/progression';
import type { Activity, KneeLog } from '../domain/recovery';
import type { Food, FoodEntry, WeightEntry } from '../domain/nutrition';
import type { SessionState } from '../domain/session';
import type { Location } from '../domain/types';
import { DEFAULT_LOCATIONS } from './equipment';

/** Nom de la base dans le navigateur. */
export const DB_NAME = 'cran';

/** Version courante du schéma. Doit toujours égaler la plus haute version déclarée ci-dessous. */
export const SCHEMA_VERSION = 8;

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

/**
 * Score de douleur au genou (SPEC §4.6). « morning » = genou du lendemain (J2), avec `worse`
 * (champ non indexé : pas de migration).
 */
export interface KneeLogRow extends KneeLog {
  id?: number;
  side?: 'left' | 'right' | 'both';
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

/**
 * Photo de progression : l'image (JPEG réduit, ~200 Ko) est un Blob stocké tel quel par
 * IndexedDB. Elle ne quitte jamais le téléphone, sauf dans un export qui l'inclut exprès.
 */
export interface PhotoRow extends PhotoMeta {
  at: string;
  blob: Blob;
  width: number;
  height: number;
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
  foods!: Table<Food, string>;
  foodLog!: Table<FoodEntry, number>;
  weights!: Table<WeightEntry, string>;
  activities!: Table<Activity, number>;
  measures!: Table<MeasureEntry, string>;
  photos!: Table<PhotoRow, number>;
  levelHistory!: Table<LevelHistoryEntry, number>;
  reviews!: Table<DailyReview, string>;
  remarks!: Table<Remark, number>;

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

    // v4 — alimentation et pesée. Nouvelles tables vides : rien à transformer.
    //  - foods : clé « ean:<code> » ou « perso:<id> », index sur le code-barres (scan) ;
    //  - foodLog : une ligne par aliment noté, index sur le jour alimentaire ;
    //  - weights : une pesée par jour (clé = jour).
    this.version(4).stores({
      foods: '&id, barcode',
      foodLog: '++id, day',
      weights: '&day',
    });

    // v5 — activités hors renfo (séances imposées ; course et vélotaf au J5). Table vide.
    //  index sur le jour (calendrier, charge) et le type.
    this.version(5).stores({
      activities: '++id, day, type',
    });

    // v6 — J3 : mensurations, photos, historique des niveaux (courbe en escalier).
    //  - measures : clé « waist:2026-11-14 » (une mesure par type et par jour), index type et jour ;
    //  - photos : index mois (une série par mois) et pose ;
    //  - levelHistory : un enregistrement par changement de niveau, index mouvement et date.
    this.version(6)
      .stores({
        measures: '&id, kind, day',
        photos: '++id, month, pose',
        levelHistory: '++id, movementId, at',
      })
      .upgrade((tx) => seedLevelHistory(tx));

    // v7 — J4B : bilan du soir. Nouvelle table vide : rien à transformer.
    //  - reviews : un bilan par jour alimentaire (clé = jour).
    this.version(7).stores({
      reviews: '&day',
    });

    // v8 — remarques d'usage (ce qui ne convient pas, noté sur le moment). Table vide.
    //  index sur l'heure (liste dans Réglages, « nouvelles depuis le dernier export »).
    this.version(8).stores({
      remarks: '++id, at',
    });

    // Base créée directement en v2 (nouvelle installation) : même contenu de départ.
    this.on('populate', (tx) => seedLocations(tx));
  }
}

async function seedLocations(tx: Transaction): Promise<void> {
  await tx.table('locations').bulkPut(DEFAULT_LOCATIONS);
}

/**
 * Reconstitue l'historique des niveaux d'une base existante : les changements notés dans le
 * journal d'usage (« level », « level-up », « level-stay »), puis le niveau actuel de chaque
 * mouvement s'il diffère du dernier changement retrouvé (ou si rien n'a été retrouvé).
 */
async function seedLevelHistory(tx: Transaction): Promise<void> {
  const events = (await tx.table('events').toArray()) as EventRow[];
  const levels = (await tx.table('levels').toArray()) as LevelRow[];
  await tx.table('levelHistory').bulkAdd(levelHistoryFrom(events, levels));
}

/** Historique des niveaux reconstitué (migration v6, et import d'un export antérieur à la v6). */
export function levelHistoryFrom(events: readonly EventRow[], levels: readonly LevelRow[]): LevelHistoryEntry[] {
  const entries: LevelHistoryEntry[] = [];
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const movementId = e.data?.movementId;
    const level = e.type === 'level-stay' ? e.data?.level : e.type === 'level' || e.type === 'level-up' ? e.data?.to : undefined;
    if (typeof movementId === 'string' && typeof level === 'number') {
      entries.push({ movementId, level, at: new Date(e.at).toISOString() });
    }
  }
  for (const row of levels) {
    const last = entries.filter((h) => h.movementId === row.movementId).at(-1);
    if (last?.level !== row.level) entries.push({ movementId: row.movementId, level: row.level, at: row.updatedAt });
  }
  return entries;
}

/** Instance partagée par toute l'appli. */
export const db = new CranDB();
