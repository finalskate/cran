/**
 * Racine de l'interface : choisit l'écran selon la route, ajoute la navigation et le bandeau de mise à jour.
 * Pendant la séance, ni barre de navigation ni bandeau : rien ne doit gêner (ni recharger l'appli).
 * Le panneau « Signaler » (remarques d'usage) est monté ici une fois pour toutes les pages ; le
 * raccourci Android (appui long sur l'icône) ouvre l'appli sur `#/?remarque`, qui l'affiche.
 */
import { useEffect } from 'preact/hooks';
import type { RouteName } from '../domain/route';
import { Nav } from './components/Nav';
import { RemarkSheet } from './components/RemarkSheet';
import { UpdateBanner } from './components/UpdateBanner';
import { openRemark } from './remarksState';
import { currentRoute } from './router';
import { Figures } from './screens/Figures';
import { Food } from './screens/Food';
import { Journal } from './screens/Journal';
import { KneeCheck } from './screens/KneeCheck';
import { Locations } from './screens/Locations';
import { Photos } from './screens/Photos';
import { Preview } from './screens/Preview';
import { Profile } from './screens/Profile';
import { Session } from './screens/Session';
import { Settings } from './screens/Settings';
import { Summary } from './screens/Summary';
import { Today } from './screens/Today';
import { WeekReview } from './screens/WeekReview';

const SCREENS: Record<RouteName, () => preact.JSX.Element | null> = {
  today: Today,
  settings: Settings,
  journal: Journal,
  levels: Journal,
  body: Journal,
  photos: Photos,
  locations: Locations,
  knee: KneeCheck,
  preview: Preview,
  session: Session,
  summary: Summary,
  'week-review': WeekReview,
  food: Food,
  profile: Profile,
  figures: Figures,
};

/** Écrans « de passage » de la séance : plein écran, sans navigation. */
const FOCUS: RouteName[] = ['knee', 'preview', 'session', 'summary'];

/** Paramètre du raccourci Android « Signaler » (voir `shortcuts` dans vite.config.ts). */
const REMARK_PARAM = /[?&]remarque(?![a-z])/;

/** Ouvre le panneau si l'URL vient du raccourci, puis retire le paramètre (un retour arrière ne le rouvre pas). */
function openFromShortcut(): void {
  if (!REMARK_PARAM.test(location.hash)) return;
  history.replaceState(null, '', location.hash.replace(/\?.*$/, ''));
  void openRemark('shortcut');
}

export function App() {
  const name = currentRoute.value.name;
  const Screen = SCREENS[name];
  const focus = FOCUS.includes(name);

  // Au lancement, et quand l'appli déjà ouverte reçoit le raccourci (changement de hash).
  useEffect(() => {
    openFromShortcut();
    addEventListener('hashchange', openFromShortcut);
    return () => removeEventListener('hashchange', openFromShortcut);
  }, []);

  return (
    <>
      <Screen />
      {!focus && <UpdateBanner />}
      {!focus && <Nav />}
      <RemarkSheet />
    </>
  );
}
