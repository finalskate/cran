/**
 * Point d'entrée : styles, rendu de l'interface, service worker et état initial.
 */
// Police des titres et chiffres, embarquée (aucun téléchargement externe, fonctionne hors ligne).
import '@fontsource-variable/space-grotesk';
import './ui/theme.css';

import { render } from 'preact';
import { initPwa } from './pwa/registerSW';
import { App } from './ui/App';
import { initState } from './ui/state';

render(<App />, document.getElementById('app')!);

initPwa();
void initState();
