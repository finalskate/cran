/**
 * Racine de l'interface : choisit l'écran selon la route, ajoute la navigation et le bandeau de mise à jour.
 * Pendant la séance, ni barre de navigation ni bandeau : rien ne doit gêner (ni recharger l'appli).
 */
import type { RouteName } from '../domain/route';
import { Nav } from './components/Nav';
import { UpdateBanner } from './components/UpdateBanner';
import { currentRoute } from './router';
import { KneeCheck } from './screens/KneeCheck';
import { Levels } from './screens/Levels';
import { Locations } from './screens/Locations';
import { Preview } from './screens/Preview';
import { Session } from './screens/Session';
import { Settings } from './screens/Settings';
import { Summary } from './screens/Summary';
import { Today } from './screens/Today';

const SCREENS: Record<RouteName, () => preact.JSX.Element | null> = {
  today: Today,
  settings: Settings,
  levels: Levels,
  locations: Locations,
  knee: KneeCheck,
  preview: Preview,
  session: Session,
  summary: Summary,
};

/** Écrans « de passage » de la séance : plein écran, sans navigation. */
const FOCUS: RouteName[] = ['knee', 'preview', 'session', 'summary'];

export function App() {
  const name = currentRoute.value.name;
  const Screen = SCREENS[name];
  const focus = FOCUS.includes(name);

  return (
    <>
      <Screen />
      {!focus && <UpdateBanner />}
      {!focus && <Nav />}
    </>
  );
}
