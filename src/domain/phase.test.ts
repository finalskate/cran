/**
 * Tests des phases (J5b, SPEC §1.3). Dates fictives.
 */
import { describe, expect, it } from 'vitest';
import { PHASES } from '../data/phases';
import { adaptivePause, cancelScheduled, cantineOn, cardioChoice, choosePhase, phaseAt, phaseKey, scheduledPhase, type PhaseEntry } from './phase';

const TODAY = '2026-11-20';

describe('historique des phases', () => {
  const entries: PhaseEntry[] = [
    { id: 'holidays', since: '2026-11-14' },
    { id: 'work', since: '2026-12-07' },
  ];

  it('phase du jour : la dernière commencée ; aucune avant la première', () => {
    expect(phaseAt(entries, '2026-11-13')).toBeNull();
    expect(phaseAt(entries, '2026-11-14')?.id).toBe('holidays');
    expect(phaseAt(entries, TODAY)?.id).toBe('holidays');
    expect(phaseAt(entries, '2026-12-07')?.id).toBe('work');
    expect(phaseKey(entries[0]!)).toBe('2026-11-14:holidays');
  });

  it('changement programmé : la 1re entrée future', () => {
    expect(scheduledPhase(entries, TODAY)).toEqual({ id: 'work', since: '2026-12-07' });
    expect(scheduledPhase(entries, '2026-12-07')).toBeNull();
    expect(cancelScheduled(entries, TODAY)).toEqual([entries[0]]);
  });

  it('choisir à partir d’aujourd’hui garde le changement programmé', () => {
    const next = choosePhase(entries, 'equipped', TODAY, TODAY);
    expect(next.map((e) => e.id)).toEqual(['holidays', 'equipped', 'work']);
    // Le même jour, un 2e choix remplace le 1er.
    expect(choosePhase(next, 'away', TODAY, TODAY).map((e) => e.id)).toEqual(['holidays', 'away', 'work']);
  });

  it('programmer un changement remplace le précédent', () => {
    const next = choosePhase(entries, 'away', '2027-01-10', TODAY);
    expect(next).toEqual([entries[0], { id: 'away', since: '2027-01-10' }]);
  });

  it('première phase programmée : rien avant, puis elle commence', () => {
    const next = choosePhase([], 'holidays', '2026-11-14', '2026-11-09');
    expect(phaseAt(next, '2026-11-09')).toBeNull();
    expect(scheduledPhase(next, '2026-11-09')?.id).toBe('holidays');
    expect(phaseAt(next, '2026-11-14')?.id).toBe('holidays');
  });
});

describe('ajustement de la cible et mode cantine', () => {
  const entries: PhaseEntry[] = [
    { id: 'work', since: '2026-12-07' },
    { id: 'away', since: '2027-02-01' },
    { id: 'equipped', since: '2027-02-20' },
  ];

  it('en éloignement : ajustement en pause', () => {
    expect(adaptivePause(entries, '2027-02-10', PHASES)).toEqual({ paused: true });
    expect(cantineOn(entries, '2027-02-10', PHASES)).toBe(true);
    expect(cantineOn(entries, '2027-02-20', PHASES)).toBe(false);
  });

  it('au retour : la période repart du 1er jour après l’éloignement', () => {
    expect(adaptivePause(entries, '2027-03-01', PHASES)).toEqual({ paused: false, resumedAt: '2027-02-20' });
    // Avant tout éloignement : rien à signaler.
    expect(adaptivePause(entries, '2027-01-10', PHASES)).toEqual({ paused: false });
    expect(adaptivePause([], '2027-01-10', PHASES)).toEqual({ paused: false });
  });
});

describe('cardio proposé', () => {
  it('sans phase : course, vélo en second si le lieu en a un', () => {
    expect(cardioChoice(null, [])).toEqual({ primary: 'run', alternative: null });
    expect(cardioChoice(null, ['bike'])).toEqual({ primary: 'run', alternative: 'bike' });
    expect(cardioChoice(PHASES.equipped, ['bike', 'treadmill'])).toEqual({ primary: 'run', alternative: 'bike', treadmill: 'maybe' });
  });

  it('éloigné : vélo, et la course seulement sur un tapis', () => {
    expect(cardioChoice(PHASES.away, ['bike'])).toEqual({ primary: 'bike', alternative: null });
    expect(cardioChoice(PHASES.away, ['bike', 'treadmill'])).toEqual({ primary: 'bike', alternative: 'run', treadmill: 'only' });
    // Même sans vélo noté sur le lieu : pas de course dehors, le vélo reste proposé.
    expect(cardioChoice(PHASES.away, []).primary).toBe('bike');
  });
});
