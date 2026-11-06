/**
 * Tests de la base locale. `fake-indexeddb` fournit une implémentation d'IndexedDB en mémoire,
 * ce qui permet de tester sous Node sans navigateur.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { CranDB, SCHEMA_VERSION } from './db';
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

  it('crée la table des réglages', async () => {
    const database = freshDb();
    await database.open();
    expect(database.tables.map((t) => t.name)).toContain('settings');
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
