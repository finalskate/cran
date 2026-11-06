import { describe, expect, it } from 'vitest';
import { formatBytes, formatLongDate } from './format';

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
