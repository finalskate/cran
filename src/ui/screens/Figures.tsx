/**
 * Revue des animations (J8) : toutes les figures du catalogue côte à côte, pour repérer d'un
 * coup d'œil une posture fausse. Écran sans lien dans la navigation : on y vient par #/mannequin.
 */
import { CATALOG } from '../../data/catalog';
import { FIGURES } from '../../data/figures';
import { Figure, keyTimes } from '../components/Figure';

/** Nom de la variante, retrouvé dans le catalogue. */
function variantName(id: string): string {
  for (const m of CATALOG) {
    for (const v of [...m.levels.flatMap((l) => l.variants), ...(m.substitutes ?? [])]) if (v.id === id) return v.name;
  }
  return id;
}

export function Figures() {
  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Revue</span>
        <h1 class="screen-header__title">Mannequin</h1>
      </header>
      <p class="muted">{Object.keys(FIGURES).length} animations. Dis-moi celles dont la posture ou le mouvement est faux.</p>
      {Object.entries(FIGURES).map(([id, anim]) => (
        <section key={id} class="card" aria-label={variantName(id)}>
          <span class="card__title">{variantName(id)}</span>
          <Figure anim={anim} label={variantName(id)} height={220} />
          <div class="figure-keys">
            {keyTimes(anim).map((t) => (
              <Figure key={t} anim={anim} label={`${variantName(id)}, position clé`} height={90} at={t} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
