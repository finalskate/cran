import { describe, expect, it } from 'vitest';
import { canSaveRemark, captureSize, lastScreenFrom, remarksSinceExport } from './remarks';

describe('remarques', () => {
  it('une remarque dit quelque chose : un texte ou une capture', () => {
    expect(canSaveRemark('  ', undefined)).toBe(false);
    expect(canSaveRemark('Le chrono part trop tôt', undefined)).toBe(true);
    expect(canSaveRemark('', 'data:image/jpeg;base64,AA')).toBe(true);
  });

  it('compte les remarques notées après le dernier export', () => {
    const at = (iso: string) => ({ at: Date.parse(iso) });
    const list = [at('2026-11-10T10:00:00Z'), at('2026-11-11T09:00:00Z'), at('2026-11-12T20:00:00Z')];
    expect(remarksSinceExport(list, '2026-11-11T08:00:00Z')).toBe(2);
    expect(remarksSinceExport(list, '')).toBe(3);
  });

  it('réduit une capture sans la déformer ni l’agrandir', () => {
    expect(captureSize(1280, 2856)).toEqual({ width: 720, height: 1607 });
    expect(captureSize(400, 800)).toEqual({ width: 400, height: 800 });
    // Capture défilante très longue : c'est la hauteur qui limite.
    expect(captureSize(1080, 9000)).toEqual({ width: 288, height: 2400 });
  });

  it('retrouve le dernier écran vu dans le journal d’usage', () => {
    const events = [
      { at: 1, type: 'screen', data: { name: 'today', ms: 10 } },
      { at: 2, type: 'set', data: { value: 12 } },
      { at: 3, type: 'screen', data: { name: 'session', ms: 50 } },
      { at: 4, type: 'hidden' },
    ];
    expect(lastScreenFrom(events)).toEqual({ name: 'session', at: 3 });
    expect(lastScreenFrom([])).toBeUndefined();
  });
});
