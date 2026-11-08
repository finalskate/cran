/**
 * Choix d'un exercice de remplacement (SPEC §4.4) : équivalents du même mouvement,
 * puis autres mouvements de la même famille. Seul ce qui est faisable sur le lieu est proposé.
 * Une variante ÉQUIVALENTE choisie ici est retenue pour les séances suivantes (rememberVariant).
 */
import type { Context } from '../../domain/availability';
import type { Plan, PlanItem } from '../../domain/types';
import { itemFromSwap, rememberVariant, swapOptions } from '../planner';

interface Props {
  item: PlanItem;
  plan: Plan;
  ctx: Context;
  onPick: (item: PlanItem) => void;
  onCancel: () => void;
}

export function SwapPicker({ item, plan, ctx, onPick, onCancel }: Props) {
  const options = swapOptions(item, plan, ctx);

  return (
    <div class="swap" role="group" aria-label="Remplacer l'exercice">
      {options.length === 0 && <p class="muted">Aucune autre option faisable ici.</p>}
      {options.map((opt) => (
        <button
          key={`${opt.movement.id}-${opt.resolved.variant.id}`}
          type="button"
          class="swap__option"
          onClick={() => {
            if (opt.sameMovement && !opt.resolved.adapted) void rememberVariant(opt.movement.id, opt.resolved.variant.id);
            onPick(itemFromSwap(opt, item, ctx));
          }}
        >
          <span>{opt.resolved.variant.name}</span>
          <span class="muted swap__meta">
            {opt.sameMovement ? (opt.resolved.adapted ? 'Un niveau en dessous' : 'Équivalent, retenu pour la suite') : opt.movement.name}
            {opt.resolved.variant.substitute ? ' · substitut' : ''}
          </span>
        </button>
      ))}
      <button type="button" class="btn btn--small" onClick={onCancel}>
        Annuler
      </button>
    </div>
  );
}
