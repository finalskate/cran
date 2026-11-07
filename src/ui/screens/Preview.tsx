/**
 * Aperçu de la séance proposée : l'appli décide, l'utilisateur peut remplacer un exercice
 * (SPEC §2.1). « C'est parti » lance la séance.
 * Toucher le nom d'un exercice ouvre sa fiche. Si la séance précédente a reçu un ressenti
 * global, il est rappelé en tête (« la dernière fois, c'était trop dur »).
 */
import { useEffect, useState } from 'preact/hooks';
import { startSession } from '../../domain/session';
import type { PlanItem } from '../../domain/types';
import { track } from '../../data/usage';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { SwapPicker } from '../components/SwapPicker';
import { requestNotifyPermission, unlockAudio } from '../device/feedback';
import { CATEGORY_LABEL, formatLongDate, formatTarget, HAND_LABEL, SESSION_FEEL_LABEL } from '../format';
import { contextFor, describeItem } from '../planner';
import { go } from '../router';
import { draftPlan, locations, prefs, updateSession } from '../state';

/** Conseil associé au ressenti de la séance précédente. Le niveau ne change pas pour autant. */
const RECALL_TIP = {
  'too-hard': 'Le niveau ne bouge pas : prends ton temps et rallonge les repos si besoin (+15 s).',
  right: 'Même recette aujourd’hui.',
  'too-easy': 'Vise le haut de la fourchette à chaque série : c’est ce qui fait monter d’un cran.',
} as const;

export function Preview() {
  const plan = draftPlan.value;
  const [swapping, setSwapping] = useState<string | null>(null);
  const [fiche, setFiche] = useState<PlanItem | null>(null);

  // Arrivée directe sur l'URL (rechargement) : pas de plan en mémoire, retour à l'accueil.
  useEffect(() => {
    if (!plan) go('today', true);
  }, [plan]);
  if (!plan) return null;

  const location = locations.value.find((l) => l.id === plan.locationId)!;
  const ctx = contextFor(location, plan.kneeScore);

  function replace(b: number, i: number, item: PlanItem) {
    track('swap', { from: plan!.blocks[b]!.items[i]!.variantId, to: item.variantId, where: 'preview' });
    const blocks = plan!.blocks.map((block, bi) =>
      bi !== b ? block : { ...block, items: block.items.map((it, ii) => (ii === i ? item : it)) },
    );
    draftPlan.value = { ...plan!, blocks };
    setSwapping(null);
  }

  async function start() {
    // Geste de l'utilisateur : on en profite pour autoriser le son (et la notification si activée).
    unlockAudio();
    if (prefs.value.watchNotify) await requestNotifyPermission();
    const state = startSession(plan!, Date.now());
    track('session-start', {
      locationId: plan!.locationId,
      duration: plan!.duration,
      knee: plan!.kneeScore,
      steps: state.steps.length,
      estimatedMinutes: plan!.estimatedMinutes,
    });
    updateSession(state);
    draftPlan.value = null;
    go('session', true);
  }

  return (
    <main class="screen screen--calm screen--focus">
      <header class="screen-header">
        <span class="screen-header__kicker">
          {location.name} · ≈ {plan.estimatedMinutes} min · genou {plan.kneeScore}/10
        </span>
        <h1 class="screen-header__title">Ta séance</h1>
      </header>

      {plan.recall && (
        <section class="card recall" aria-label="La dernière fois">
          <span class="card__label">
            La dernière fois · {formatLongDate(new Date(plan.recall.startedAt))}
            {plan.recall.locationId !== plan.locationId
              ? ` · ${locations.value.find((l) => l.id === plan.recall!.locationId)?.name ?? ''}`
              : ''}
          </span>
          <span class="card__title">
            Séance jugée « {SESSION_FEEL_LABEL[plan.recall.feel].toLowerCase()} »
          </span>
          <span class="muted" style={{ fontSize: '14px' }}>
            {RECALL_TIP[plan.recall.feel]}
          </span>
        </section>
      )}

      {plan.blocks.map((block, b) => (
        <section key={b} class="card" aria-label={block.title}>
          <div class="row">
            <span class="card__label">{block.title}</span>
            {block.optional && <span class="muted" style={{ fontSize: '13px' }}>facultatif</span>}
          </div>
          {block.items.map((item, i) => {
            const { variant } = describeItem(item);
            const key = `${b}.${i}`;
            return (
              <div key={key} class="plan-item">
                <div class="plan-item__main">
                  <button type="button" class="plan-item__name plan-item__fiche" onClick={() => setFiche(item)}>
                    {variant.name}
                  </button>
                  <span class="muted plan-item__meta">
                    {item.guided
                      ? `${item.target.min} s`
                      : `${item.sets} × ${formatTarget(item.target, item.perSide)}`}
                    {item.handSupport ? ` · ${HAND_LABEL[item.handSupport]}` : ''}
                    {item.adapted ? ' · adapté au lieu' : ''}
                  </span>
                </div>
                {!item.guided && swapping !== key && (
                  <button type="button" class="btn btn--small" onClick={() => setSwapping(key)}>
                    Remplacer
                  </button>
                )}
                {swapping === key && (
                  <SwapPicker
                    item={item}
                    plan={plan}
                    ctx={ctx}
                    onPick={(it) => replace(b, i, it)}
                    onCancel={() => setSwapping(null)}
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}

      {fiche && (
        <ExerciseSheet
          open
          from="preview"
          onClose={() => setFiche(null)}
          variants={[describeItem(fiche).variant]}
          kicker={CATEGORY_LABEL[describeItem(fiche).movement.category]}
        />
      )}

      <div class="bottom-zone">
        <button class="cta" type="button" onClick={() => void start()}>
          <span class="cta__title">C’est parti</span>
          <span class="cta__sub">
            {prefs.value.watchReminder ? 'Lance « Musculation » sur ta montre' : 'L’écran restera allumé'}
          </span>
        </button>
      </div>
    </main>
  );
}
