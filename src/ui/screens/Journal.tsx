/**
 * Onglet « Carnet » (J2) : trois vues en haut de l'écran.
 *  - Calendrier : le mois, séances, séances imposées et journées notées ;
 *  - Séances : l'historique façon carnet Lafay ;
 *  - Niveaux : les échelles par mouvement, le test de placement.
 * La vue Niveaux a sa propre adresse (`#/niveaux`) : anciens liens, carte « Première fois ».
 */
import { signal } from '@preact/signals';
import { CalendarView } from '../journal/CalendarView';
import { LevelsView } from '../journal/LevelsView';
import { SessionsView } from '../journal/SessionsView';
import { currentRoute, go } from '../router';

type Tab = 'calendar' | 'sessions' | 'levels';

const TABS: { value: Tab; label: string }[] = [
  { value: 'calendar', label: 'Calendrier' },
  { value: 'sessions', label: 'Séances' },
  { value: 'levels', label: 'Niveaux' },
];

/** Dernière vue choisie parmi Calendrier et Séances (on y revient en rouvrant le Carnet). */
const lastTab = signal<'calendar' | 'sessions'>('calendar');

export function Journal() {
  const current: Tab = currentRoute.value.name === 'levels' ? 'levels' : lastTab.value;

  function pick(t: Tab) {
    if (t !== 'levels') lastTab.value = t;
    go(t === 'levels' ? 'levels' : 'journal', true);
  }

  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Ce que j’ai fait</span>
        <h1 class="screen-header__title">Carnet</h1>
      </header>

      <div class="segmented" role="tablist" aria-label="Vues du carnet">
        {TABS.map((t) => (
          <button key={t.value} type="button" class="btn btn--small" role="tab" aria-selected={current === t.value} onClick={() => pick(t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {current === 'calendar' && <CalendarView />}
      {current === 'sessions' && <SessionsView />}
      {current === 'levels' && <LevelsView />}
    </main>
  );
}
