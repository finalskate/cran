/**
 * Racine de l'interface : choisit l'écran selon la route, ajoute la navigation et le bandeau de mise à jour.
 */
import { Nav } from './components/Nav';
import { UpdateBanner } from './components/UpdateBanner';
import { currentRoute } from './router';
import { Settings } from './screens/Settings';
import { Today } from './screens/Today';

export function App() {
  const route = currentRoute.value;

  return (
    <>
      {route.name === 'settings' ? <Settings /> : <Today />}
      <UpdateBanner />
      <Nav />
    </>
  );
}
