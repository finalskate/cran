/**
 * Tests de la base locale. `fake-indexeddb` fournit une implémentation d'IndexedDB en mémoire,
 * ce qui permet de tester sous Node sans navigateur.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { CranDB, SCHEMA_VERSION } from './db';
import { DEFAULT_LOCATIONS } from './equipment';
import { getSetting, setSetting } from './settings';

/** Bases ouvertes pendant un test, supprimées ensuite pour isoler les tests entre eux. */
const opened: CranDB[] = [];

function freshDb(): CranDB {
  const database = new CranDB(`cran-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()));
});

describe('CranDB', () => {
  it('ouvre la base à la version déclarée par SCHEMA_VERSION', async () => {
    const database = freshDb();
    await database.open();
    expect(database.verno).toBe(SCHEMA_VERSION);
  });

  it('crée toutes les tables', async () => {
    const database = freshDb();
    await database.open();
    expect(database.tables.map((t) => t.name).sort()).toEqual(
      ['activeSession', 'events', 'foodLog', 'foods', 'kneeLogs', 'levels', 'locations', 'settings', 'weights', 'workouts'].sort(),
    );
  });

  it('crée les lieux par défaut à la première installation', async () => {
    const database = freshDb();
    expect(await database.locations.count()).toBe(DEFAULT_LOCATIONS.length);
  });
});

describe('migration v1 → v2', () => {
  it('conserve les réglages et ajoute les lieux par défaut', async () => {
    const name = `cran-test-${crypto.randomUUID()}`;

    // Base telle qu'un téléphone l'a créée au J0 (schéma v1 seul).
    const v1 = new Dexie(name);
    v1.version(1).stores({ settings: '&key' });
    await v1.table('settings').put({ key: 'fx', value: 'reduced' });
    v1.close();

    // L'appli mise à jour ouvre la même base en v2.
    const v2 = new CranDB(name);
    opened.push(v2);
    await v2.open();
    expect(v2.verno).toBe(SCHEMA_VERSION);
    expect(await getSetting('fx', v2)).toBe('reduced');
    expect(await v2.locations.count()).toBe(DEFAULT_LOCATIONS.length);
  });
});

describe('migration v2 → v3', () => {
  it('conserve l’historique et ajoute le journal d’usage', async () => {
    const name = `cran-test-${crypto.randomUUID()}`;

    // Base telle qu'un téléphone l'a créée au J1 (schéma v2).
    const v2 = new Dexie(name);
    v2.version(1).stores({ settings: '&key' });
    v2.version(2).stores({
      locations: '&id, order',
      levels: '&movementId',
      kneeLogs: '++id, date',
      workouts: '++id, startedAt',
      activeSession: '&key',
    });
    await v2.table('workouts').add({ startedAt: '2026-11-07T18:00:00Z', entries: [] });
    await v2.table('levels').put({ movementId: 'push-h', level: 5, updatedAt: '2026-11-07T18:00:00Z' });
    v2.close();

    const v3 = new CranDB(name);
    opened.push(v3);
    await v3.open();
    expect(v3.verno).toBe(SCHEMA_VERSION);
    expect(await v3.workouts.count()).toBe(1);
    expect((await v3.levels.get('push-h'))?.level).toBe(5);
    expect(await v3.events.count()).toBe(0);
  });
});

describe('migration v3 → v4', () => {
  it('conserve séances, journal et réglages, et ajoute alimentation et pesées', async () => {
    const name = `cran-test-${crypto.randomUUID()}`;

    // Base telle qu'un téléphone l'a créée aux retouches J1 (schéma v3).
    const v3 = new Dexie(name);
    v3.version(1).stores({ settings: '&key' });
    v3.version(2).stores({
      locations: '&id, order',
      levels: '&movementId',
      kneeLogs: '++id, date',
      workouts: '++id, startedAt',
      activeSession: '&key',
    });
    v3.version(3).stores({ events: '++id, at' });
    await v3.table('workouts').add({ startedAt: '2026-11-07T18:00:00Z', entries: [] });
    await v3.table('events').add({ at: 1, type: 'app-open' });
    await v3.table('settings').put({ key: 'lastDuration', value: 10 });
    v3.close();

    const v4 = new CranDB(name);
    opened.push(v4);
    await v4.open();
    expect(v4.verno).toBe(4);
    expect(await v4.workouts.count()).toBe(1);
    expect(await v4.events.count()).toBe(1);
    expect(await getSetting('lastDuration', v4)).toBe(10);
    expect(await v4.foods.count()).toBe(0);
    expect(await v4.foodLog.count()).toBe(0);
    expect(await v4.weights.count()).toBe(0);
  });
});

describe('réglages', () => {
  it("renvoie undefined pour un réglage jamais écrit", async () => {
    const database = freshDb();
    expect(await getSetting('fx', database)).toBeUndefined();
  });

  it('relit ce qui a été écrit, et remplace la valeur précédente', async () => {
    const database = freshDb();
    await setSetting('fx', 'reduced', database);
    expect(await getSetting('fx', database)).toBe('reduced');
    await setSetting('fx', 'full', database);
    expect(await getSetting('fx', database)).toBe('full');
  });

  it('conserve les données à la réouverture (persistance)', async () => {
    const name = `cran-test-${crypto.randomUUID()}`;
    const first = new CranDB(name);
    await setSetting('installedAt', '2026-11-14T08:00:00.000Z', first);
    first.close();

    const second = new CranDB(name);
    opened.push(second);
    expect(await getSetting('installedAt', second)).toBe('2026-11-14T08:00:00.000Z');
  });
});
