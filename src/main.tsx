/**
 * Point d'entrée : styles, rendu de l'interface, service worker et état initial.
 */
// Police des titres et chiffres, embarquée (aucun téléchargement externe, fonctionne hors ligne).
import '@fontsource-variable/space-grotesk';
import './ui/theme.css';

import { render } from 'preact';
import { pruneEvents, track } from './data/usage';
import { consumeUpdateReload, initPwa } from './pwa/registerSW';
import { App } from './ui/App';
import { currentRoute } from './ui/router';
import { initState } from './ui/state';

// Journal d'usage : erreurs non interceptées (les plus utiles pour corriger à distance).
window.addEventListener('error', (e) => track('error', { message: e.message, source: e.filename, line: e.lineno }));
window.addEventListener('unhandledrejection', (e) => track('error', { message: String(e.reason) }));

const afterUpdate = consumeUpdateReload();
track('app-open', {
  version: __APP_VERSION__,
  standalone: matchMedia('(display-mode: standalone)').matches,
  width: innerWidth,
  height: innerHeight,
  dpr: devicePixelRatio,
  afterUpdate,
});

render(<App />, document.getElementById('app')!);

// Diagnostic du défilement parasite après une mise à jour : la page doit tenir dans l'écran.
setTimeout(() => {
  const doc = document.documentElement;
  track('viewport', {
    route: currentRoute.value.name,
    afterUpdate,
    innerHeight,
    clientHeight: doc.clientHeight,
    scrollHeight: doc.scrollHeight,
    visualHeight: window.visualViewport?.height,
  });
}, 1500);

initPwa();
void initState();
void pruneEvents(Date.now()).catch(() => undefined);
