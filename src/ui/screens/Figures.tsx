/**
 * Revue des animations (J8) : toutes les figures du catalogue côte à côte, avec leurs consignes,
 * pour repérer d'un coup d'œil une posture fausse. Écran sans lien dans la navigation : on y
 * vient par #/mannequin.
 */
import { CATALOG, COOLDOWN, WARMUP } from '../../data/catalog';
import type { Variant } from '../../domain/types';
import { FIGURES } from '../../data/figures';
import { Figure, keyTimes } from '../components/Figure';

/** Variante retrouvée dans le catalogue (échauffement et retour au calme compris). */
function variantOf(id: string): Variant | undefined {
  for (const m of [...CATALOG, WARMUP, COOLDOWN]) {
    for (const v of [...m.levels.flatMap((l) => l.variants), ...(m.substitutes ?? [])]) if (v.id === id) return v;
  }
  return undefined;
}

export function Figures() {
  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Revue</span>
        <h1 class="screen-header__title">Mannequin</h1>
      </header>
      <p class="muted">{Object.keys(FIGURES).length} animations. Dis-moi celles dont la posture ou le mouvement est faux.</p>
      {Object.entries(FIGURES).map(([id, anim]) => {
        const v = variantOf(id);
        const name = v?.name ?? id;
        return (
          <section key={id} class="card" aria-label={name}>
            <span class="card__title">{name}</span>
            <Figure anim={anim} label={name} height={220} />
            <div class="figure-keys">
              {keyTimes(anim).map((t) => (
                <Figure key={t} anim={anim} label={`${name}, position clé`} height={90} at={t} />
              ))}
            </div>
            {v && (
              <ul class="fiche__list">
                {v.cues.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
