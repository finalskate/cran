/**
 * Fiche d'exercice : consignes, erreurs courantes, matériel et lien vidéo (SPEC §4.3).
 * Ouverte depuis l'écran Niveaux, l'aperçu et la séance : on peut la consulter à tout moment.
 * Le mannequin animé (J8) prendra place en tête de fiche.
 *
 * Un niveau peut avoir plusieurs variantes équivalentes (une par matériel) : elles sont toutes
 * présentées, la préférée en premier.
 */
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { EQUIPMENT } from '../../data/equipment';
import { track } from '../../data/usage';
import type { Requirement, Variant } from '../../domain/types';
import { formatTarget } from '../format';
import { DemoLink } from './DemoLink';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  variants: Variant[];
  kicker?: string;
  /** Écran d'origine, pour le journal d'usage. */
  from: string;
  footer?: ComponentChildren;
}

/** « Table solide ou banc » : une exigence peut accepter plusieurs matériels. */
function requirementLabel(req: Requirement): string {
  const tags = Array.isArray(req) ? req : [req];
  const labels = tags.map((t) => EQUIPMENT.find((e) => e.tag === t)?.label ?? t);
  return labels.join(' ou ');
}

export function ExerciseSheet({ open, onClose, variants, kicker, from, footer }: Props) {
  const first = variants[0];

  useEffect(() => {
    if (open && first) track('sheet', { variantId: first.id, from });
  }, [open, first?.id]);

  if (!first) return null;
  const title = variants.map((v) => v.name).join(' · ');

  return (
    <Sheet open={open} onClose={onClose} title={title} kicker={kicker} footer={footer}>
      {variants.map((v) => (
        <section key={v.id} class="fiche" aria-label={v.name}>
          {variants.length > 1 && <h3 class="fiche__name">{v.name}</h3>}
          <span class="muted fiche__meta">
            {formatTarget(v.target, v.perSide)}
            {v.needs.length > 0 ? ` · ${v.needs.map(requirementLabel).join(', ')}` : ''}
            {v.handsOnFloor ? ' · poignées ou poings selon le lieu' : ''}
            {v.substitute ? ' · substitut' : ''}
          </span>
          <ul class="fiche__list">
            {v.cues.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {v.mistakes.length > 0 && (
            <>
              <span class="card__label">Erreurs courantes</span>
              <ul class="fiche__list">
                {v.mistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
          <DemoLink variant={v} />
        </section>
      ))}
    </Sheet>
  );
}
