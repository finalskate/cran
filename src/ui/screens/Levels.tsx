/**
 * Niveaux par mouvement, visualisés en échelle (SPEC §4.10) ; choix manuel au J1,
 * en attendant le test de placement (J2). Toucher un niveau le sélectionne.
 */
import { CATALOG } from '../../data/catalog';
import { chooseLevel, levels, prefs } from '../state';

/** Mouvements à échelle (les exercices tournants de prévention n'ont qu'un niveau). */
const LADDERS = CATALOG.filter((m) => m.levels.length > 1);

export function Levels() {
  return (
    <main class="screen screen--calm">
      <header class="screen-header">
        <span class="screen-header__kicker">Où j’en suis</span>
        <h1 class="screen-header__title">Niveaux</h1>
      </header>

      <p class="muted" style={{ margin: 0 }}>
        Choisis le niveau où tu fais confortablement le bas de la fourchette. Selon le lieu, l’appli
        propose la variante équivalente.
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
            <ol class="ladder">
              {m.levels.map((level, i) => {
                const heavy = level.variants.some((v) => v.wristHeavy);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      class={`ladder__step ${i < current ? 'ladder__step--done' : ''}`}
                      aria-pressed={i === current}
                      onClick={() => {
                        if (heavy && prefs.value.wristRule && i !== current) {
                          const ok = confirm(
                            'Ce niveau charge beaucoup le poignet. À choisir seulement si ton poignet est indolore. Continuer ?',
                          );
                          if (!ok) return;
                        }
                        void chooseLevel(m.id, i);
                      }}
                    >
                      <span class="ladder__num num">{i + 1}</span>
                      <span class="ladder__names">
                        {level.variants.map((v) => v.name).join(' · ')}
                        {heavy ? ' ⚠ poignet' : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
