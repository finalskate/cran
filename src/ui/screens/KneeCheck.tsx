/**
 * Score genou avant la séance (SPEC §4.6) : un geste, 0 pré-sélectionné. Le côté est facultatif.
 * Le score module la séance : 3–4 sans exercices à fort impact, ≥ 5 haut du corps et prévention.
 * Genou « plus mal » ce matin (J2) : la séance ménage les jambes quel que soit le score.
 * Règle kiné (SPEC §4.6) : après 3 scores ≥ 3 en 7 jours, un message sobre, sans diagnostic.
 */
import { useState } from 'preact/hooks';
import { kineAlert, morningWorseToday } from '../../domain/recovery';
import { go } from '../router';
import { draftPlan, locations, prefs } from '../state';
import { makePlan } from '../planner';
import { kneeLogs, logKnee } from '../training';

type Side = 'left' | 'right' | 'both';

const SIDES: { value: Side; label: string }[] = [
  { value: 'left', label: 'Gauche' },
  { value: 'right', label: 'Droit' },
  { value: 'both', label: 'Les deux' },
];

/** Ce que le score change, en clair. */
function explain(score: number): string {
  if (score >= 5) return 'Séance du haut du corps et prévention. Pas de course conseillée aujourd’hui.';
  if (score >= 3) return 'Pas d’exercices à fort impact (pistol, sauts). L’isométrie est gardée.';
  return 'Séance normale.';
}

export function KneeCheck() {
  const [score, setScore] = useState(0);
  const [side, setSide] = useState<Side | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function next() {
    setBusy(true);
    const location = locations.value.find((l) => l.id === prefs.value.lastLocationId) ?? locations.value[0]!;
    await logKnee({ date: new Date().toISOString(), score, context: 'session', ...(side ? { side } : {}) });
    draftPlan.value = await makePlan(location, prefs.value.lastDuration, score);
    go('preview', true);
  }

  return (
    <main class="screen screen--calm screen--focus">
      <header class="screen-header">
        <span class="screen-header__kicker">Avant de commencer</span>
        <h1 class="screen-header__title">Ton genou aujourd’hui ?</h1>
      </header>

      <section class="card" aria-labelledby="knee-label">
        <span id="knee-label" class="card__label">
          Douleur de 0 (aucune) à 10
        </span>
        <div class="score-grid" role="radiogroup" aria-labelledby="knee-label">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              class={`score score--${n >= 5 ? 'high' : n >= 3 ? 'mid' : 'low'}`}
              onClick={() => setScore(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p class="muted" style={{ margin: 0 }}>
          {explain(score)}
        </p>
      </section>

      {morningWorseToday(kneeLogs.value, new Date()) && (
        <p class="muted empty-note">Ce matin, ton genou allait moins bien : la séance ménagera les jambes.</p>
      )}

      {kineAlert(kneeLogs.value, new Date()) && (
        <section class="card" aria-label="Conseil">
          <span class="card__label">Ton genou cette semaine</span>
          <p style={{ margin: 0 }}>
            Plusieurs scores de 3 ou plus ces 7 derniers jours. Un avis de kiné aiderait à adapter la reprise : ce n’est
            pas une alerte, juste le bon moment pour en parler.
          </p>
        </section>
      )}

      {score > 0 && (
        <section class="card" aria-labelledby="side-label">
          <span id="side-label" class="card__label">
            Côté (facultatif)
          </span>
          <div class="segmented" role="group" aria-labelledby="side-label">
            {SIDES.map((s) => (
              <button
                key={s.value}
                class="btn"
                type="button"
                aria-pressed={side === s.value}
                onClick={() => setSide(side === s.value ? undefined : s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div class="bottom-zone">
        <button class="cta" type="button" disabled={busy} onClick={() => void next()}>
          <span class="cta__title">Voir la séance</span>
        </button>
      </div>
    </main>
  );
}
