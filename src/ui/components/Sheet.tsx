/**
 * Panneau qui monte du bas de l'écran (fiche d'exercice, menu de la séance).
 *
 * Basé sur <dialog> en mode modal : le focus reste dans le panneau, le fond est inerte, et le
 * geste « retour » d'Android le ferme (événement `cancel`). Toucher le fond le ferme aussi.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Titre lu par les lecteurs d'écran et affiché en tête du panneau. */
  title: string;
  /** Surtitre facultatif (ex. « Niveau 6 / 7 »). */
  kicker?: string;
  children: ComponentChildren;
  /** Boutons collés en bas du panneau (zone du pouce). */
  footer?: ComponentChildren;
}

export function Sheet({ open, onClose, title, kicker, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // Le panneau suit `open` ; showModal() n'accepte pas d'être appelé deux fois.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      class="sheet"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Un clic dont la cible est le <dialog> lui-même tombe sur le fond (hors du contenu).
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div class="sheet__body">
          <div class="sheet__head">
            <div class="sheet__titles">
              {kicker && <span class="card__label accent">{kicker}</span>}
              {/* autofocus : à l'ouverture, le focus va sur le titre (lu par les lecteurs d'écran)
                  plutôt que sur « Fermer », qui apparaîtrait en surbrillance. */}
              <h2 class="sheet__title" tabIndex={-1} autofocus>
                {title}
              </h2>
            </div>
            <button type="button" class="icon-btn" aria-label="Fermer" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div class="sheet__content">{children}</div>
          {footer && <div class="sheet__footer">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
