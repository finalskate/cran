/**
 * Tests du rappel de sauvegarde.
 */
import { describe, expect, it } from 'vitest';
import { exportReminder } from './reminders';

describe('rappel d’export', () => {
  it('se montre après 7 jours sans export', () => {
    expect(exportReminder('2026-11-09T18:54:00', '2026-11-06T10:00:00', undefined, '2026-11-15')).toBeNull();
    expect(exportReminder('2026-11-09T18:54:00', '2026-11-06T10:00:00', undefined, '2026-11-16')).toEqual({ since: 7 });
  });

  it('jamais exporté : compte depuis l’installation', () => {
    expect(exportReminder(undefined, '2026-11-06T10:00:00', undefined, '2026-11-13')).toEqual({ since: null });
    expect(exportReminder('', '', undefined, '2026-11-13')).toBeNull();
  });

  it('« Plus tard » le fait taire jusqu’au jour dit', () => {
    expect(exportReminder('2026-11-01T10:00:00', undefined, '2026-11-18', '2026-11-18')).toBeNull();
    expect(exportReminder('2026-11-01T10:00:00', undefined, '2026-11-18', '2026-11-19')).toEqual({ since: 18 });
  });
});
