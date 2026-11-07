/**
 * Branche le routage pur (src/domain/route.ts) sur le navigateur : l'écran courant est un signal
 * mis à jour à chaque changement de hash.
 * Le journal d'usage y note le temps passé sur chaque écran (hors temps en arrière-plan).
 */
import { signal } from '@preact/signals';
import { track } from '../data/usage';
import { parseRoute, routeHref, type Route, type RouteName } from '../domain/route';

export const currentRoute = signal<Route>(parseRoute(location.hash));

/** Arrivée sur l'écran courant (ou retour au premier plan), pour mesurer le temps passé. */
let enteredAt = Date.now();

/** Note le temps passé sur l'écran courant et repart de zéro. */
function trackScreen(): void {
  track('screen', { name: currentRoute.value.name, ms: Date.now() - enteredAt });
  enteredAt = Date.now();
}

function setRoute(route: Route): void {
  if (route.name !== currentRoute.value.name) trackScreen();
  currentRoute.value = route;
}

window.addEventListener('hashchange', () => {
  setRoute(parseRoute(location.hash));
  // Chaque écran s'ouvre en haut, comme une nouvelle page.
  window.scrollTo(0, 0);
});

// Appli en arrière-plan (écran verrouillé, autre appli) : le temps ne compte pas pour l'écran.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    trackScreen();
    track('hidden', { name: currentRoute.value.name });
  } else {
    enteredAt = Date.now();
    track('visible', { name: currentRoute.value.name });
  }
});

/**
 * Navigue vers un écran. `replace` : remplace l'entrée d'historique au lieu d'en ajouter une
 * (le bouton retour d'Android ne revient pas sur un écran de passage, ex. score genou → séance).
 */
export function go(name: RouteName, replace = false): void {
  const hash = routeHref(name);
  if (replace) {
    history.replaceState(null, '', hash);
    setRoute(parseRoute(hash));
    window.scrollTo(0, 0);
  } else {
    location.hash = hash;
  }
}
