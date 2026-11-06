/**
 * Branche le routage pur (src/domain/route.ts) sur le navigateur : l'écran courant est un signal
 * mis à jour à chaque changement de hash.
 */
import { signal } from '@preact/signals';
import { parseRoute, routeHref, type Route, type RouteName } from '../domain/route';

export const currentRoute = signal<Route>(parseRoute(location.hash));

window.addEventListener('hashchange', () => {
  currentRoute.value = parseRoute(location.hash);
  // Chaque écran s'ouvre en haut, comme une nouvelle page.
  window.scrollTo(0, 0);
});

/**
 * Navigue vers un écran. `replace` : remplace l'entrée d'historique au lieu d'en ajouter une
 * (le bouton retour d'Android ne revient pas sur un écran de passage, ex. score genou → séance).
 */
export function go(name: RouteName, replace = false): void {
  const hash = routeHref(name);
  if (replace) {
    history.replaceState(null, '', hash);
    currentRoute.value = parseRoute(hash);
    window.scrollTo(0, 0);
  } else {
    location.hash = hash;
  }
}
