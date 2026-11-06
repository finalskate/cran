/**
 * Routage par hash (`#/reglages`) : logique pure, sans dépendance au navigateur.
 *
 * Pourquoi le hash : GitHub Pages ne sait pas renvoyer index.html pour une URL inconnue
 * (pas de « fallback SPA »). Avec le hash, l'URL réelle reste toujours /cran/ et le
 * service worker n'a qu'une page à servir hors ligne.
 */

/** Écrans connus de l'appli. S'enrichit à chaque jalon. */
export type RouteName =
  | 'today'
  | 'settings'
  | 'levels'
  | 'locations'
  | 'knee' // score genou avant la séance
  | 'preview' // aperçu de la séance proposée
  | 'session' // séance en cours
  | 'summary'; // séance terminée

export interface Route {
  name: RouteName;
}

/** Correspondance chemin → écran. Les chemins sont en français : ils sont visibles dans l'URL. */
const PATHS: Record<string, RouteName> = {
  '': 'today',
  reglages: 'settings',
  niveaux: 'levels',
  lieux: 'locations',
  genou: 'knee',
  apercu: 'preview',
  seance: 'session',
  bravo: 'summary',
};

/**
 * Transforme `location.hash` en route.
 * Tolère les variantes courantes (`#`, `#/`, `/reglages/`, paramètres `?x=1`).
 * Un chemin inconnu renvoie l'accueil plutôt qu'une page d'erreur : on ne bloque jamais l'utilisateur.
 */
export function parseRoute(hash: string): Route {
  const path = hash
    .replace(/^#/, '')
    .split('?')[0]! // on ignore les paramètres pour l'instant
    .replace(/^\/+|\/+$/g, ''); // retire les « / » de début et de fin

  return { name: PATHS[path] ?? 'today' };
}

/** Construit le hash d'un écran, pour les liens (`href={routeHref('settings')}`). */
export function routeHref(name: RouteName): string {
  const path = Object.keys(PATHS).find((p) => PATHS[p] === name) ?? '';
  return `#/${path}`;
}
