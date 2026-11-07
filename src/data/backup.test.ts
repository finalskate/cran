/**
 * Tests de l'export et du journal d'usage (base en mémoire via fake-indexeddb).
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildExport, exportFileName } from './backup';
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
