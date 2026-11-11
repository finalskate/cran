/**
 * Aperçu de la séance proposée : l'appli décide, l'utilisateur peut remplacer un exercice
 * (SPEC §2.1). « C'est parti » lance la séance.
 * Toucher le nom d'un exercice ouvre sa fiche. Si la séance précédente a reçu un ressenti
 * global, il est rappelé en tête (« la dernière fois, c'était trop dur »).
 * Carte « À préparer » : le matériel de la séance, dans l'ordre d'utilisation. « Pas là ? » refait
 * la séance sans ce matériel, pour cette séance seulement (le lieu ne change pas, cf. gear.ts).
 */
import { useEffect, useState } from 'preact/hooks';
import { handSupport, isAvailable } from '../../domain/availability';
import { gearNeeds, toggleMissing, withoutEquipment, type GearNeed } from '../../domain/gear';
import { startSession } from '../../domain/session';
import type { EquipmentTag, PlanItem } from '../../domain/types';
import { EQUIPMENT } from '../../data/equipment';
import { track } from '../../data/usage';
import { ExerciseSheet } from '../components/ExerciseSheet';
import { SwapPicker } from '../components/SwapPicker';
import { requestNotifyPermission, unlockAudio } from '../device/feedback';
import { CATEGORY_LABEL, formatLongDate, formatTarget, HAND_LABEL, SESSION_FEEL_LABEL } from '../format';
import { contextFor, describeItem, makePlan } from '../planner';
import { go } from '../router';
import { draftPlan, locations, prefs, updateSession } from '../state';
import { RemarkButton } from '../components/RemarkSheet';

/** Conseil associé au ressenti de la séance précédente. Le niveau ne change pas pour autant. */
const RECALL_TIP = {
  'too-hard': 'Le niveau ne bouge pas, une série de moins sur les blocs principaux. Rallonge les repos si besoin (+15 s).',
  right: 'Même recette aujourd’hui.',
  'too-easy': 'Une série de plus sur les blocs principaux. Vise le haut de la fourchette : c’est ce qui débloque le niveau suivant.',
} as const;

const equipmentLabel = (tag: EquipmentTag) => EQUIPMENT.find((e) => e.tag === tag)?.label ?? tag;

/** Nom d'un matériel à préparer ; pour les élastiques, ceux qui sont prévus (« Élastique 20 kg »). */
function gearName(need: GearNeed): string {
  if (need.tag !== 'bands' || !need.bands?.length) return equipmentLabel(need.tag);
  return `${need.bands.length > 1 ? 'Élastiques' : 'Élastique'} ${need.bands.join(', ')}`;
}

/** Un remplacement fait dans l'aperçu : retenu pour être réappliqué si la séance est refaite. */
interface Swap {
  from: string;
  to: PlanItem;
}

export function Preview() {
  const plan = draftPlan.value;
  const [swapping, setSwapping] = useState<string | null>(null);
  const [fiche, setFiche] = useState<PlanItem | null>(null);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [adapting, setAdapting] = useState(false);

  // Arrivée directe sur l'URL (rechargement) : pas de plan en mémoire, retour à l'accueil.
  useEffect(() => {
    if (!plan) go('today', true);
  }, [plan]);
  if (!plan) return null;

  const location = locations.value.find((l) => l.id === plan.locationId)!;
  const missing = plan.missing ?? [];
  const ctx = contextFor(withoutEquipment(location, missing), plan.kneeScore);
  const needs = gearNeeds(
    plan.blocks.flatMap((b) => b.items).map((item) => ({ variant: describeItem(item).variant, handSupport: item.handSupport, band: item.band })),
    ctx.location,
  );

  function replace(b: number, i: number, item: PlanItem) {
    const from = plan!.blocks[b]!.items[i]!.variantId;
    track('swap', { from, to: item.variantId, where: 'preview' });
    // Un exercice déjà remplacé garde son origine : A → B puis B → C se retient comme A → C.
    const earlier = swaps.find((s) => s.to.variantId === from);
    setSwaps([...swaps.filter((s) => s !== earlier), { from: earlier?.from ?? from, to: item }]);
    const blocks = plan!.blocks.map((block, bi) =>
      bi !== b ? block : { ...block, items: block.items.map((it, ii) => (ii === i ? item : it)) },
    );
    draftPlan.value = { ...plan!, blocks };
    setSwapping(null);
  }

  /**
   * Matériel absent (ou revenu) : la séance est refaite par le moteur sans lui. Les remplacements
   * faits dans l'aperçu sont gardés s'ils restent faisables (même support des mains compris).
   */
  async function toggleGear(tag: EquipmentTag) {
    if (adapting) return;
    setAdapting(true);
    const next = toggleMissing(missing, tag);
    track('gear-missing', { tag, missing: !missing.includes(tag), count: next.length, locationId: plan!.locationId });
    const today = withoutEquipment(location, next);
    const fresh = await makePlan(today, plan!.duration, plan!.kneeScore);
    const freshCtx = contextFor(today, fresh.kneeScore);
    const keep = (item: PlanItem): PlanItem => {
      const swap = swaps.find((s) => s.from === item.variantId);
      if (!swap) return item;
      const variant = describeItem(swap.to).variant;
      const ok = isAvailable(variant, freshCtx) && (swap.to.handSupport ?? null) === (handSupport(variant, freshCtx) ?? null);
      return ok ? swap.to : item;
    };
    draftPlan.value = {
      ...fresh,
      blocks: fresh.blocks.map((b) => ({ ...b, items: b.items.map(keep) })),
      ...(next.length > 0 ? { missing: next } : {}),
    };
    setAdapting(false);
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
        <RemarkButton />
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

      {plan.notes && plan.notes.length > 0 && (
        <section class="card plan-notes" aria-label="Adaptations du jour">
          <span class="card__label">Aujourd’hui</span>
          {plan.notes.map((n) => (
            <p key={n} class="muted">
              {n}
            </p>
          ))}
        </section>
      )}

      <section class="card" aria-label="À préparer" aria-busy={adapting}>
        <span class="card__label">À préparer</span>
        {needs.length === 0 && missing.length === 0 && (
          <p class="muted gear-hint">Rien à préparer : un peu de place au sol suffit.</p>
        )}
        {needs.map((need) => (
          <div key={need.tag} class="plan-item">
            <div class="plan-item__main">
              <span class="plan-item__name">{gearName(need)}</span>
              <span class="muted plan-item__meta">
                {need.setup && <span class="gear-setup">À installer avant · </span>}
                {need.uses.join(' · ')}
              </span>
            </div>
            <button type="button" class="btn btn--small" disabled={adapting} onClick={() => void toggleGear(need.tag)}>
              Pas là ?
            </button>
          </div>
        ))}
        {missing.map((tag) => (
          <div key={tag} class="plan-item gear-missing">
            <div class="plan-item__main">
              <span class="plan-item__name">{equipmentLabel(tag)}</span>
              <span class="muted plan-item__meta">Pas sous la main · séance adaptée</span>
            </div>
            <button type="button" class="btn btn--small" disabled={adapting} onClick={() => void toggleGear(tag)}>
              Il est là
            </button>
          </div>
        ))}
        {needs.length > 0 && missing.length === 0 && (
          <p class="muted gear-hint">Un matériel n’est pas sous la main ? Touche « Pas là ? », la séance s’adapte.</p>
        )}
      </section>

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
