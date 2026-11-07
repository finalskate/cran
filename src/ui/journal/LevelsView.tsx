/**
 * Niveaux par mouvement, visualisés en échelle (SPEC §4.10) : vue « Niveaux » du Carnet.
 * Le niveau se choisit à la main, se teste (« Tester mon niveau », facultatif, J2), et monte
 * tout seul quand la double progression débloque la variante suivante.
 *
 * Toucher un niveau ouvre sa FICHE (consignes, vidéo, bientôt l'animation) : on peut regarder
 * n'importe quel exercice sans rien changer. Le niveau ne change qu'avec « Choisir ce niveau ».
 *
 * L'échelle se lit sans la couleur : ✓ = niveau acquis, badge « Ton niveau » = niveau actuel,
 * numéro gris = niveaux à venir.
 */
import { useState } from 'preact/hooks';
import { CATALOG } from '../../data/catalog';
import { track } from '../../data/usage';
import type { Movement } from '../../domain/types';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { PlacementSheet } from './PlacementSheet';
import { chooseLevel, levels, prefs } from '../state';

/** Mouvements à échelle (les exercices tournants de prévention n'ont qu'un niveau). */
const LADDERS = CATALOG.filter((m) => m.levels.length > 1);

export function LevelsView() {
  // Fiche ouverte : mouvement et index du niveau.
  const [open, setOpen] = useState<{ movement: Movement; level: number } | null>(null);
  const [testing, setTesting] = useState<Movement | null>(null);

  async function choose(m: Movement, i: number) {
    const heavy = m.levels[i]!.variants.some((v) => v.wristHeavy);
    if (heavy && prefs.value.wristRule) {
      const ok = confirm('Ce niveau charge beaucoup le poignet. À choisir seulement si ton poignet est indolore. Continuer ?');
      if (!ok) return;
    }
    track('level', { movementId: m.id, from: levels.value[m.id] ?? 0, to: i });
    await chooseLevel(m.id, i);
    setOpen(null);
  }

  return (
    <>
      <p class="muted" style={{ margin: 0 }}>
        Touche un exercice pour voir sa fiche. Deux séances au haut de la fourchette débloquent le niveau suivant ;
        en cas de doute, « Tester » te place en une série.
      </p>

      {LADDERS.map((m) => {
        const current = levels.value[m.id] ?? 0;
        return (
          <section key={m.id} class="card" aria-labelledby={`lvl-${m.id}`}>
            <div class="row">
              <h2 id={`lvl-${m.id}`} class="card__title">
                {m.name}
              </h2>
              <span class="muted num">
                {current + 1} / {m.levels.length}
              </span>
            </div>
            {m.note && (
              <p class="muted" style={{ margin: 0, fontSize: '14px' }}>
                {m.note}
              </p>
            )}
            {/* Un vrai bouton (bordé, icône) : en simple lien, il passait pour une étiquette. */}
            <button type="button" class="btn btn--small level-test" onClick={() => setTesting(m)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2 2M10 2h4" />
              </svg>
              Tester mon niveau
            </button>
            <ol class="ladder">
              {m.levels.map((level, i) => {
                const heavy = level.variants.some((v) => v.wristHeavy);
                const state = i < current ? 'done' : i === current ? 'current' : 'next';
                return (
                  <li key={i}>
                    <button
                      type="button"
                      class={`ladder__step ladder__step--${state}`}
                      aria-current={state === 'current' ? 'step' : undefined}
                      onClick={() => setOpen({ movement: m, level: i })}
                    >
                      <span class="ladder__num num" aria-hidden={state === 'done' ? 'true' : undefined}>
                        {state === 'done' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span class="ladder__names">
                        {state === 'done' && <span class="visually-hidden">Acquis : </span>}
                        {level.variants.map((v) => v.name).join(' · ')}
                        {heavy ? ' ⚠ poignet' : ''}
                      </span>
                      {state === 'current' && <span class="ladder__badge">Ton niveau</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {open && (
        <ExerciseSheet
          open
          from="levels"
          onClose={() => setOpen(null)}
          variants={open.movement.levels[open.level]!.variants}
          kicker={`${open.movement.name} · niveau ${open.level + 1} / ${open.movement.levels.length}`}
          footer={
            (levels.value[open.movement.id] ?? 0) === open.level ? (
              <p class="muted" style={{ margin: 0, textAlign: 'center' }}>
                C’est ton niveau actuel.
              </p>
            ) : (
              <button type="button" class="cta" onClick={() => void choose(open.movement, open.level)}>
                <span class="cta__title">Choisir ce niveau</span>
              </button>
            )
          }
        />
      )}
      {testing && <PlacementSheet movement={testing} onClose={() => setTesting(null)} />}
    </>
  );
}
