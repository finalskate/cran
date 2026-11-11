import { describe, expect, it } from 'vitest';
import {
  formatApproxDate,
  formatBytes,
  formatClock,
  formatCm,
  formatInt,
  formatKg,
  formatLongDate,
  formatSigned,
  formatTarget,
  formatTime,
  parseDecimal,
  relativeDayLabel,
} from './format';

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

describe('saisie et affichage des nombres (alimentation)', () => {
  it('lit virgule, point et espaces de milliers', () => {
    expect(parseDecimal('80,4')).toBe(80.4);
    expect(parseDecimal(' 80.4 ')).toBe(80.4);
    expect(parseDecimal('1 200')).toBe(1200);
    expect(parseDecimal('')).toBeUndefined();
    expect(parseDecimal('abc')).toBeUndefined();
    expect(parseDecimal('-3')).toBeUndefined();
  });

  it('formate kilos et kilocalories à la française', () => {
    expect(formatKg(80)).toBe('80,0 kg');
    expect(formatInt(2250).replace(/\s/g, ' ')).toBe('2 250');
  });

  it('nomme aujourd’hui et hier, sinon la date', () => {
    expect(relativeDayLabel('2026-11-14', '2026-11-14')).toBe('Aujourd’hui');
    expect(relativeDayLabel('2026-11-13', '2026-11-14')).toBe('Hier');
    expect(relativeDayLabel('2026-11-12', '2026-11-14')).toBe('Jeudi 12 novembre');
  });
});

describe('poids et mesures (J3)', () => {
  it('formate un écart signé avec le vrai signe moins', () => {
    expect(formatSigned(-0.43)).toBe('−0,4');
    expect(formatSigned(0.2)).toBe('+0,2');
    expect(formatSigned(-0.04)).toBe('0');
  });

  it('donne une date approximative, avec l’année seulement si elle change', () => {
    expect(formatApproxDate('2026-03-05', '2026-01-10')).toBe('début mars');
    expect(formatApproxDate('2026-03-15', '2026-01-10')).toBe('mi-mars');
    expect(formatApproxDate('2027-01-28', '2026-11-10')).toBe('fin janvier 2027');
  });

  it('formate un tour de taille', () => {
    expect(formatCm(85.5)).toBe('85,5 cm');
    expect(formatCm(86)).toBe('86 cm');
  });
});

describe('formatTime', () => {
  it('écrit l’heure à la française, minutes sur deux chiffres', () => {
    expect(formatTime(new Date(2026, 10, 11, 18, 5))).toBe('18 h 05');
    expect(formatTime(new Date(2026, 10, 11, 7, 30))).toBe('7 h 30');
  });
});
