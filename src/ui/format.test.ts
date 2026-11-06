import { describe, expect, it } from 'vitest';
import { formatBytes, formatClock, formatLongDate, formatTarget } from './format';

describe('formatClock', () => {
  it('affiche minutes et secondes', () => {
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('formatTarget', () => {
  it('écrit la fourchette avec son unité', () => {
    expect(formatTarget({ kind: 'reps', min: 8, max: 15 })).toBe('8–15 rép.');
    expect(formatTarget({ kind: 'time', min: 30, max: 45 })).toBe('30–45 s');
    expect(formatTarget({ kind: 'reps', min: 5, max: 10 }, true)).toBe('5–10 rép. / côté');
    expect(formatTarget({ kind: 'time', min: 30, max: 30 })).toBe('30 s');
  });
});

describe('formatLongDate', () => {
  it('écrit la date en français, avec une majuscule initiale', () => {
    // Midi heure locale : évite tout décalage de jour lié au fuseau.
    expect(formatLongDate(new Date(2026, 10, 14, 12))).toBe('Samedi 14 novembre');
  });
});

describe('formatBytes', () => {
  it('choisit une unité lisible', () => {
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(1536)).toBe('1,5 Ko');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 Mo');
  });
});
