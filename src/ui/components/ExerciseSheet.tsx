/**
 * Fiche d'exercice : consignes, erreurs courantes, matériel et lien vidéo (SPEC §4.3).
 * Ouverte depuis l'écran Niveaux, l'aperçu et la séance : on peut la consulter à tout moment.
 * Le mannequin animé (J8) prendra place en tête de fiche.
 *
 * Un niveau peut avoir plusieurs variantes équivalentes (une par matériel) : elles sont toutes
 * présentées, la préférée en premier (l'appelant les ordonne).
 *
 * Retouche du 08/11 : repère de départ (charge du sac), élastique conseillé, et consigne
 * d'installation de l'ancrage de porte pour les sangles.
 */
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { EQUIPMENT, SETUP_NOTES } from '../../data/equipment';
import { track } from '../../data/usage';
import { bandLabels, startRank } from '../../domain/bands';
import type { Requirement, Variant } from '../../domain/types';
import { formatTarget } from '../format';
import { prefs } from '../state';
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

/** Variante aux sangles qui peut se faire avec l'ancrage de porte. */
function usesDoorAnchor(v: Variant): boolean {
  const tags = v.needs.flat();
  return tags.includes('straps') && tags.includes('anchor');
}

export function ExerciseSheet({ open, onClose, variants, kicker, from, footer }: Props) {
  const first = variants[0];

  useEffect(() => {
    if (open && first) track('sheet', { variantId: first.id, from });
  }, [open, first?.id]);

  if (!first) return null;
  const title = variants.length > 1 ? `${first.name} (ou équivalent)` : first.name;
  const labels = bandLabels(prefs.value.bands);

  return (
    <Sheet open={open} onClose={onClose} title={title} kicker={kicker} footer={footer}>
      {variants.length > 1 && (
        <p class="muted sheet__lead">Variantes équivalentes : l’appli propose celle que permet le matériel du lieu.</p>
      )}
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
          {v.band && <p class="fiche__hint">Élastique de départ : {labels[startRank(v.band, labels.length)]}{v.band.assist ? ' (il aide : plus léger = plus dur)' : ''}.</p>}
          {v.startHint && <p class="fiche__hint">{v.startHint}</p>}
          {usesDoorAnchor(v) && <p class="fiche__hint">{SETUP_NOTES.straps}</p>}
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
