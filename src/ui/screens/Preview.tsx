/**
 * Aperçu de la séance proposée : l'appli décide, l'utilisateur peut remplacer un exercice
 * (SPEC §2.1). « C'est parti » lance la séance.
 */
import { useEffect, useState } from 'preact/hooks';
import { startSession } from '../../domain/session';
import type { PlanItem } from '../../domain/types';
import { DemoLink } from '../components/DemoLink';
import { SwapPicker } from '../components/SwapPicker';
import { requestNotifyPermission, unlockAudio } from '../device/feedback';
import { formatTarget, HAND_LABEL } from '../format';
import { contextFor, describeItem } from '../planner';
import { go } from '../router';
import { draftPlan, locations, prefs, updateSession } from '../state';

export function Preview() {
  const plan = draftPlan.value;
  const [swapping, setSwapping] = useState<string | null>(null);

  // Arrivée directe sur l'URL (rechargement) : pas de plan en mémoire, retour à l'accueil.
  useEffect(() => {
    if (!plan) go('today', true);
  }, [plan]);
  if (!plan) return null;

  const location = locations.value.find((l) => l.id === plan.locationId)!;
  const ctx = contextFor(location, plan.kneeScore);

  function replace(b: number, i: number, item: PlanItem) {
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
    updateSession(startSession(plan!, Date.now()));
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
                  <span class="plan-item__name">{variant.name}</span>
                  <span class="muted plan-item__meta">
                    {item.guided
                      ? `${item.target.min} s`
                      : `${item.sets} × ${formatTarget(item.target, item.perSide)}`}
                    {item.handSupport ? ` · ${HAND_LABEL[item.handSupport]}` : ''}
                    {item.adapted ? ' · adapté au lieu' : ''}
                  </span>
                  {!item.guided && <DemoLink variant={variant} />}
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
