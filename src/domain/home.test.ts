import { describe, expect, it } from 'vitest';
import { DEFERRED_KEEP, deferKey, hintVisible, homeFeed, markHint, MAX_NOW, undeferKey, type HomeCandidate } from './home';

const c = (id: HomeCandidate['id'], key = `${id}:2026-11-21`): HomeCandidate => ({ id, key });
const ids = (list: HomeCandidate[]) => list.map((x) => x.id);

describe('homeFeed', () => {
  it('trie par priorité et garde au plus deux cartes dans « Maintenant »', () => {
    const feed = homeFeed([c('pushup-test'), c('evening-review'), c('morning'), c('knee')], []);
    expect(MAX_NOW).toBe(2);
    expect(ids(feed.now)).toEqual(['morning', 'knee']);
    expect(ids(feed.later)).toEqual(['evening-review', 'pushup-test']);
  });

  it('envoie directement dans « Plus tard » les cartes sans priorité, à la fin', () => {
    const feed = homeFeed([c('backup'), c('cardio'), c('pause')], []);
    expect(ids(feed.now)).toEqual(['pause']);
    expect(ids(feed.later)).toEqual(['backup', 'cardio']);
  });

  it('range une carte mise de côté, et la suivante prend sa place', () => {
    const feed = homeFeed([c('morning'), c('knee'), c('run')], ['morning:2026-11-21']);
    expect(ids(feed.now)).toEqual(['knee', 'run']);
    expect(ids(feed.later)).toEqual(['morning']);
  });

  it('une mise de côté ne vaut que pour son occurrence : le lendemain, la carte revient', () => {
    const feed = homeFeed([c('morning', 'morning:2026-11-22')], ['morning:2026-11-21']);
    expect(ids(feed.now)).toEqual(['morning']);
  });

  it('une séance en cours ne se met jamais de côté et passe toujours devant', () => {
    const feed = homeFeed([c('morning'), c('resume', 'resume')], ['resume']);
    expect(ids(feed.now)).toEqual(['resume', 'morning']);
  });

  it('rien à montrer : deux listes vides', () => {
    expect(homeFeed([], [])).toEqual({ now: [], later: [] });
  });
});

describe('deferKey / undeferKey', () => {
  it('ajoute sans doublon et oublie les plus anciennes', () => {
    expect(deferKey(['a', 'b'], 'a')).toEqual(['b', 'a']);
    const many = Array.from({ length: DEFERRED_KEEP }, (_, i) => `k${i}`);
    const next = deferKey(many, 'new');
    expect(next).toHaveLength(DEFERRED_KEEP);
    expect(next[0]).toBe('k1');
    expect(next.at(-1)).toBe('new');
  });

  it('annule une mise de côté', () => {
    expect(undeferKey(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('textes d’aide', () => {
  it('se montrent 5 jours (toute la journée du 5e), puis se taisent', () => {
    let seen = {};
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
    for (const d of days) {
      expect(hintVisible(seen, 'weigh', d)).toBe(true);
      seen = markHint(seen, 'weigh', d);
      seen = markHint(seen, 'weigh', d); // revu le même jour : compte une fois
    }
    expect(hintVisible(seen, 'weigh', '2026-11-05')).toBe(true);
    expect(hintVisible(seen, 'weigh', '2026-11-06')).toBe(false);
    expect(hintVisible(seen, 'knee', '2026-11-06')).toBe(true);
  });
});
