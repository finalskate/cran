/**
 * Tests des mensurations et des photos (base en mémoire via fake-indexeddb).
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deletePhotos, listMeasures, listPhotos, saveMeasure, savePhoto } from './bodyRepo';
import { CranDB } from './db';

const opened: CranDB[] = [];

function freshDb(): CranDB {
  const database = new CranDB(`cran-test-${crypto.randomUUID()}`);
  opened.push(database);
  return database;
}

afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()));
});

const photo = (day: string, pose: 'front' | 'side', at = `${day}T08:00:00Z`) => ({
  day,
  month: day.slice(0, 7),
  pose,
  at,
  width: 2,
  height: 2,
  blob: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
});

describe('photos', () => {
  it('garde une seule photo par pose et par mois (la nouvelle remplace)', async () => {
    const database = freshDb();
    await savePhoto(photo('2026-11-08', 'front'), database);
    await savePhoto(photo('2026-11-08', 'side'), database);
    await savePhoto(photo('2026-11-20', 'front'), database);
    await savePhoto(photo('2026-12-08', 'front'), database);
    const rows = await listPhotos(database);
    expect(rows.map((r) => [r.day, r.pose])).toEqual([
      ['2026-11-08', 'side'],
      ['2026-11-20', 'front'],
      ['2026-12-08', 'front'],
    ]);
    // Le Blob survit au stockage.
    expect(rows[0]!.blob.size).toBe(1);
  });

  it('supprime les photos d’un mois', async () => {
    const database = freshDb();
    await savePhoto(photo('2026-11-08', 'front'), database);
    await savePhoto(photo('2026-11-08', 'side'), database);
    await savePhoto(photo('2026-12-08', 'front'), database);
    await deletePhotos('2026-11', 'side', database);
    expect((await listPhotos(database)).length).toBe(2);
    await deletePhotos('2026-11', undefined, database);
    expect((await listPhotos(database)).map((r) => r.month)).toEqual(['2026-12']);
  });
});

describe('mesures', () => {
  it('remplace la mesure du même jour et trie par jour', async () => {
    const database = freshDb();
    await saveMeasure({ id: 'waist:2026-11-15', kind: 'waist', day: '2026-11-15', at: '', value: 85 }, database);
    await saveMeasure({ id: 'waist:2026-11-08', kind: 'waist', day: '2026-11-08', at: '', value: 86 }, database);
    await saveMeasure({ id: 'waist:2026-11-15', kind: 'waist', day: '2026-11-15', at: '', value: 84.5 }, database);
    expect((await listMeasures(database)).map((m) => m.value)).toEqual([86, 84.5]);
  });
});
