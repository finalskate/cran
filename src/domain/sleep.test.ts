import { describe, expect, it } from 'vitest';
import { badNight, NIGHT_DOCTOR_BAD, NIGHT_WINDOW_DAYS, nightAsked, nightsSummary, type NightEntry } from './sleep';
import { addDays } from './days';

const night = (day: string, quality: NightEntry['quality']): NightEntry => ({ day, at: `${day}T07:00:00Z`, quality });

describe('nightAsked', () => {
  it('demande le matin, une fois par jour', () => {
    expect(nightAsked([], '2026-11-21', 7)).toBe(true);
    expect(nightAsked([night('2026-11-21', 'ok')], '2026-11-21', 7)).toBe(false);
    expect(nightAsked([night('2026-11-20', 'ok')], '2026-11-21', 7)).toBe(true);
  });

  it('pas avant 4 h ni à partir de 14 h', () => {
    expect(nightAsked([], '2026-11-21', 3)).toBe(false);
    expect(nightAsked([], '2026-11-21', 13)).toBe(true);
    expect(nightAsked([], '2026-11-21', 14)).toBe(false);
  });
});

describe('badNight', () => {
  it('seulement la nuit notée ce matin', () => {
    expect(badNight([night('2026-11-21', 'bad')], '2026-11-21')).toBe(true);
    expect(badNight([night('2026-11-20', 'bad')], '2026-11-21')).toBe(false);
    expect(badNight([night('2026-11-21', 'ok')], '2026-11-21')).toBe(false);
  });
});

describe('nightsSummary', () => {
  it('donne les 14 derniers jours, les trous à null', () => {
    const s = nightsSummary([night('2026-11-21', 'good'), night('2026-11-19', 'bad'), night('2026-11-01', 'bad')], '2026-11-21');
    expect(s.days).toHaveLength(NIGHT_WINDOW_DAYS);
    expect(s.days.at(-1)).toEqual({ day: '2026-11-21', quality: 'good' });
    expect(s.days.at(-2)).toEqual({ day: '2026-11-20', quality: null });
    expect(s.days[0]!.day).toBe('2026-11-08');
    expect(s.answered).toBe(2);
    expect(s.bad).toBe(1);
    expect(s.adviseDoctor).toBe(false);
  });

  it('suggère un médecin à partir de 8 mauvaises nuits sur 14', () => {
    const today = '2026-11-21';
    const list = Array.from({ length: NIGHT_DOCTOR_BAD }, (_, i) => night(addDays(today, -i), 'bad'));
    expect(nightsSummary(list, today).adviseDoctor).toBe(true);
    expect(nightsSummary(list.slice(1), today).adviseDoctor).toBe(false);
  });
});
