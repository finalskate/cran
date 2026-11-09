/**
 * Tests de l'export et du journal d'usage (base en mémoire via fake-indexeddb).
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { backupSummary, buildExport, exportFileName, parseBackup, restoreBackup, type ExportFile } from './backup';
import { CranDB, SCHEMA_VERSION } from './db';
import { DEFAULT_LOCATIONS } from './equipment';
import { EVENT_MAX_AGE_DAYS, pruneEvents, track } from './usage';

const opened: CranDB[] = [];

function freshDb(): CranDB {
  const database = new CranDB(`cran-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()));
});

describe('buildExport', () => {
  it('contient toutes les tables, la version du schéma et la date', async () => {
    const database = freshDb();
    await database.workouts.add({
      startedAt: '2026-11-07T18:00:00Z',
      endedAt: '2026-11-07T18:20:00Z',
      locationId: 'home',
      duration: 20,
      kneeScore: 0,
      entries: [],
    });
    const file = await buildExport(database, '0.2.0', new Date('2026-11-07T19:00:00Z'));

    expect(file.app).toBe('cran');
    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(file.exportedAt).toBe('2026-11-07T19:00:00.000Z');
    expect(Object.keys(file.tables).sort()).toEqual(database.tables.map((t) => t.name).sort());
    expect(file.tables.workouts).toHaveLength(1);
    expect(file.tables.locations).toHaveLength(DEFAULT_LOCATIONS.length);
    // Le fichier doit survivre à un aller-retour JSON.
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });

  /** Photo fictive : quelques octets suffisent pour tester l'encodage. */
  async function addPhoto(database: CranDB) {
    await database.photos.add({
      day: '2026-11-08',
      month: '2026-11',
      pose: 'front',
      at: '2026-11-08T08:00:00Z',
      width: 2,
      height: 2,
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    });
  }

  it('laisse les photos de côté par défaut, en le signalant', async () => {
    const database = freshDb();
    await addPhoto(database);
    const file = await buildExport(database, '0.3.0', new Date());
    expect(file.tables.photos).toEqual([]);
    expect(file.photosExcluded).toBe(1);
  });

  it('inclut les photos en base64 sur demande', async () => {
    const database = freshDb();
    await addPhoto(database);
    const file = await buildExport(database, '0.3.0', new Date(), { includePhotos: true });
    expect(file.photosExcluded).toBeUndefined();
    expect(file.tables.photos).toEqual([expect.objectContaining({ pose: 'front', dataUrl: 'data:image/jpeg;base64,AQID' })]);
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });
});

describe('import', () => {
  /** Base remplie de quelques données fictives. */
  async function filled(): Promise<CranDB> {
    const database = freshDb();
    await database.workouts.add({
      startedAt: '2026-11-07T18:00:00Z', endedAt: '2026-11-07T18:20:00Z', locationId: 'home', duration: 20, kneeScore: 1,
      entries: [{ movementId: 'push-h', variantId: 'archer', level: 5, sets: [{ value: 12 }] }],
    });
    await database.settings.put({ key: 'weekGoal', value: { strength: 3, cardio: 2 } });
    await database.weights.put({ day: '2026-11-08', at: '2026-11-08T07:00:00Z', kg: 80 });
    await database.foodLog.bulkAdd([
      { day: '2026-11-08', at: '', meal: 'noon', label: 'Test', portion: '1', count: 1, unit: { kcal: 500, protein: 30 }, method: 'free' },
      { day: '2026-11-08', at: '', meal: 'evening', label: 'Test', portion: '1', count: 1, unit: { kcal: 600, protein: 40 }, method: 'free' },
    ]);
    await addPhoto(database);
    return database;
  }

  async function addPhoto(database: CranDB) {
    await database.photos.add({
      day: '2026-11-08', month: '2026-11', pose: 'front', at: '2026-11-08T08:00:00Z', width: 2, height: 2,
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    });
  }

  const text = (file: ExportFile) => JSON.stringify(file, null, 1);

  it('export → nouvelle base → import : rien ne se perd', async () => {
    const source = await filled();
    const file = await buildExport(source, '0.9.0', new Date('2026-11-09T18:54:00Z'), { includePhotos: true });
    const target = freshDb();
    await target.open();
    const parsed = parseBackup(text(file), target);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(backupSummary(parsed.file)).toMatchObject({ workouts: 1, foodDays: 1, weights: 1, photos: 1 });
    await restoreBackup(target, parsed.file);

    for (const table of source.tables) {
      if (table.name === 'photos') continue;
      expect(await target.table(table.name).toArray(), table.name).toEqual(await table.toArray());
    }
    const [photo] = await target.photos.toArray();
    expect(photo).toMatchObject({ pose: 'front', month: '2026-11' });
    expect(new Uint8Array(await photo!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('un fichier sans photo garde les photos du téléphone', async () => {
    const file = await buildExport(await filled(), '0.9.0', new Date());
    const target = freshDb();
    await addPhoto(target);
    await target.workouts.add({ startedAt: 'x', endedAt: 'x', locationId: 'park', duration: 10, kneeScore: 0, entries: [] });
    const parsed = parseBackup(text(file), target);
    if (!parsed.ok) throw new Error(parsed.error);
    await restoreBackup(target, parsed.file);
    expect(await target.photos.count()).toBe(1);
    expect((await target.workouts.toArray()).map((w) => w.locationId)).toEqual(['home']);
  });

  it('met à niveau un export d’une version plus ancienne', async () => {
    const target = freshDb();
    await target.open();
    const old = {
      app: 'cran', schemaVersion: 5, appVersion: '0.1.0', exportedAt: '2026-11-07T10:00:00Z',
      tables: {
        levels: [{ movementId: 'push-h', level: 5, updatedAt: '2026-11-07T09:00:00Z' }],
        events: [{ id: 1, at: Date.parse('2026-11-07T08:00:00Z'), type: 'level', data: { movementId: 'push-h', to: 4 } }],
        locations: DEFAULT_LOCATIONS,
      },
    };
    const parsed = parseBackup(JSON.stringify(old), target);
    if (!parsed.ok) throw new Error(parsed.error);
    await restoreBackup(target, parsed.file);
    expect((await target.levelHistory.toArray()).map((h) => h.level)).toEqual([4, 5]);
    expect(await target.reviews.count()).toBe(0);
  });

  it('refuse un fichier abîmé, étranger ou trop récent, sans rien toucher', async () => {
    const database = freshDb();
    await database.open();
    const ok = { app: 'cran', schemaVersion: SCHEMA_VERSION, appVersion: '1', exportedAt: '', tables: {} };
    const error = (data: unknown) => {
      const r = parseBackup(typeof data === 'string' ? data : JSON.stringify(data), database);
      return r.ok ? null : r.error;
    };
    expect(error('{ pas du json')).toMatch(/lisible/);
    expect(error({ ...ok, app: 'autre' })).toMatch(/ne vient pas de Cran/);
    expect(error({ ...ok, schemaVersion: SCHEMA_VERSION + 1 })).toMatch(/plus récente/);
    expect(error({ ...ok, tables: { inconnue: [] } })).toMatch(/n’existe pas/);
    expect(error({ ...ok, tables: { weights: [{ kg: 80 }] } })).toMatch(/identifiant/);
    expect(error({ ...ok, tables: { photos: [{ day: 'x' }] } })).toMatch(/photo/);
    expect(error(ok)).toBeNull();
  });
});

describe('exportFileName', () => {
  it('donne un nom daté et triable', () => {
    expect(exportFileName(new Date(2026, 10, 7, 8, 5))).toBe('cran-export-2026-11-07-0805.json');
  });
});

describe('journal d’usage', () => {
  it('enregistre un événement sans attendre', async () => {
    const database = freshDb();
    await database.open();
    track('screen', { name: 'today', ms: 1200 }, database);
    // L'écriture est lancée sans attente : on laisse la transaction se terminer.
    await new Promise((r) => setTimeout(r, 50));
    const rows = await database.events.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'screen', data: { name: 'today', ms: 1200 } });
  });

  it('efface seulement les événements trop anciens', async () => {
    const database = freshDb();
    const now = Date.parse('2026-11-07T12:00:00Z');
    const day = 24 * 3600 * 1000;
    await database.events.bulkAdd([
      { at: now - (EVENT_MAX_AGE_DAYS + 1) * day, type: 'old' },
      { at: now - 2 * day, type: 'recent' },
    ]);
    expect(await pruneEvents(now, database)).toBe(1);
    expect((await database.events.toArray()).map((e) => e.type)).toEqual(['recent']);
  });
});
