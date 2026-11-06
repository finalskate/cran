/**
 * « Voir une démo » : recherche vidéo de l'exercice, ouverte dans le navigateur (SPEC §4.3).
 * Uniquement avec du réseau ; hors ligne, le lien est remplacé par une mention discrète.
 * En attendant les illustrations animées (J8), c'est le moyen de mettre une image sur un nom.
 */
import type { Variant } from '../../domain/types';

export function demoUrl(variant: Variant): string {
  const query = variant.videoQuery ?? `${variant.name} exercice`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function DemoLink({ variant }: { variant: Variant }) {
  if (!navigator.onLine) {
    return <span class="muted" style={{ fontSize: '13px' }}>Démo vidéo disponible avec du réseau</span>;
  }
  return (
    <a class="demo-link" href={demoUrl(variant)} target="_blank" rel="noopener noreferrer">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
      Voir une démo
    </a>
  );
}
