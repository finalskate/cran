/**
 * Onglet « Carnet » (J2) : quatre vues en haut de l'écran.
 *  - Calendrier : la semaine (J5a), puis le mois : séances, cardio, vélotaf, séances imposées
 *    et journées notées ;
 *  - Séances : l'historique façon carnet Lafay, et les séances par semaine ;
 *  - Niveaux : les échelles par mouvement, le test de placement, la courbe en escalier ;
 *  - Corps (J3) : tendance de poids, tour de taille, photos.
 * Niveaux et Corps ont leur propre adresse (`#/niveaux`, `#/corps`) : carte « Première fois »,
 * résumé de l'accueil.
 */
import { signal } from '@preact/signals';
import { BodyView } from '../journal/BodyView';
import { CalendarView } from '../journal/CalendarView';
import { LevelsView } from '../journal/LevelsView';
import { SessionsView } from '../journal/SessionsView';
import { currentRoute, go } from '../router';

type Tab = 'calendar' | 'sessions' | 'levels' | 'body';

const TABS: { value: Tab; label: string }[] = [
  { value: 'calendar', label: 'Calendrier' },
  { value: 'sessions', label: 'Séances' },
  { value: 'levels', label: 'Niveaux' },
  { value: 'body', label: 'Corps' },
];

/** Vues qui ont leur propre adresse. */
const ROUTED: Partial<Record<Tab, 'levels' | 'body'>> = { levels: 'levels', body: 'body' };

/** Dernière vue choisie parmi Calendrier et Séances (on y revient en rouvrant le Carnet). */
const lastTab = signal<'calendar' | 'sessions'>('calendar');

/** Ouvre le Carnet sur le calendrier (carte « Cette semaine » de l'accueil). */
export function openCalendar(): void {
  lastTab.value = 'calendar';
  go('journal');
}

export function Journal() {
  const route = currentRoute.value.name;
  const current: Tab = route === 'levels' || route === 'body' ? route : lastTab.value;

  function pick(t: Tab) {
    if (t === 'calendar' || t === 'sessions') lastTab.value = t;
    go(ROUTED[t] ?? 'journal', true);
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
      {current === 'body' && <BodyView />}
    </main>
  );
}
