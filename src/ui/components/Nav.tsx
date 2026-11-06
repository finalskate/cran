/**
 * Barre de navigation du bas. Progrès et Assiette arrivent avec leurs jalons.
 */
import type { ComponentChildren } from 'preact';
import { routeHref, type RouteName } from '../../domain/route';
import { currentRoute } from '../router';

interface Item {
  route: RouteName;
  label: string;
  icon: ComponentChildren;
}

/** Icônes au trait, en `currentColor` pour suivre l'état actif. */
const ITEMS: Item[] = [
  {
    route: 'today',
    label: "Aujourd'hui",
    icon: <path d="M4 11l8-7 8 7v9H4z" />,
  },
  {
    route: 'levels',
    label: 'Niveaux',
    icon: <path d="M4 20h4v-5h4v-5h4V5h4" />,
  },
  {
    route: 'settings',
    label: 'Réglages',
    icon: (
      <>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
  },
];

export function Nav() {
  return (
    <nav class="nav" aria-label="Navigation principale">
      {ITEMS.map((item) => (
        <a
          key={item.route}
          class="nav__item"
          href={routeHref(item.route)}
          aria-current={currentRoute.value.name === item.route ? 'page' : undefined}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            {item.icon}
          </svg>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
