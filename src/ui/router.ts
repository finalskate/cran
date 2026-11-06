/**
 * Branche le routage pur (src/domain/route.ts) sur le navigateur : l'écran courant est un signal
 * mis à jour à chaque changement de hash.
 */
import { signal } from '@preact/signals';
import { parseRoute, type Route } from '../domain/route';

export const currentRoute = signal<Route>(parseRoute(location.hash));

window.addEventListener('hashchange', () => {
  currentRoute.value = parseRoute(location.hash);
  // Chaque écran s'ouvre en haut, comme une nouvelle page.
  window.scrollTo(0, 0);
});
