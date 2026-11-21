/**
 * Carte qu'on peut mettre de côté (accueil du 21/11) : balayer vers la gauche, ou toucher le
 * petit bouton « Plus tard » en haut à droite. Le geste n'est qu'un raccourci : il est
 * invisible, donc le bouton reste toujours là (et seul utilisable au clavier).
 *
 * Le balayage :
 *  - ne démarre que si le doigt part nettement à l'horizontale (sinon c'est un défilement, laissé
 *    au navigateur grâce à `touch-action: pan-y`) ;
 *  - ignore un départ collé au bord de l'écran, réservé au geste « retour » d'Android ;
 *  - n'aboutit qu'au-delà de SWIPE_RATIO de la largeur ; en deçà, la carte revient en place ;
 *  - ne déclenche pas le bouton ou le lien sous le doigt une fois parti (clic absorbé).
 */
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

/** Fraction de la largeur à dépasser pour mettre de côté. */
const SWIPE_RATIO = 0.35;
/** Déplacement (px) à partir duquel on décide : balayage ou défilement. */
const DECIDE_PX = 10;
/** Bande (px) au bord de l'écran laissée au geste « retour » du système. */
const EDGE_PX = 24;
/** Durée (ms) de la sortie de la carte, avant de la ranger. */
const LEAVE_MS = 180;

interface Props {
  /** Mettre de côté ; `gesture` dit comment (journal d'usage). */
  onDefer: (gesture: 'swipe' | 'button') => void;
  /** Libellé du bouton (par défaut « Plus tard »). */
  laterLabel?: string;
  children: ComponentChildren;
}

interface Drag {
  x: number;
  y: number;
  /** null : pas encore décidé ; true : balayage ; false : défilement (on laisse faire). */
  swiping: boolean | null;
}

export function SwipeCard({ onDefer, laterLabel = 'Plus tard', children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  // Vrai juste après un balayage : le clic qui suit le relâchement est absorbé.
  const swallowClick = useRef(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.clientX < EDGE_PX || e.clientX > window.innerWidth - EDGE_PX) return;
    // Un panneau ouvert depuis la carte (pesée, Garmin…) est dans son arbre : on n'y balaie pas.
    if ((e.target as Element | null)?.closest?.('dialog')) return;
    drag.current = { x: e.clientX, y: e.clientY, swiping: null };
    swallowClick.current = false;
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.swiping === false) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (d.swiping === null) {
      if (Math.abs(mx) > DECIDE_PX && Math.abs(mx) > Math.abs(my) * 1.5) {
        d.swiping = true;
        setDragging(true);
        ref.current?.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > DECIDE_PX) {
        d.swiping = false;
        return;
      } else {
        return;
      }
    }
    // Vers la gauche seulement ; vers la droite, la carte résiste (un quart du geste).
    setDx(mx < 0 ? mx : mx / 4);
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d?.swiping) return;
    swallowClick.current = true;
    setDragging(false);
    const width = ref.current?.offsetWidth ?? window.innerWidth;
    if (dx < -width * SWIPE_RATIO) {
      setDx(-width - 24);
      setTimeout(() => onDefer('swipe'), LEAVE_MS);
    } else {
      setDx(0);
    }
  }

  function onPointerCancel() {
    drag.current = null;
    setDragging(false);
    setDx(0);
  }

  function onClickCapture(e: MouseEvent) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  const width = ref.current?.offsetWidth ?? 1;
  // Le fond « Plus tard » apparaît à mesure que la carte s'en va.
  const reveal = Math.min(1, Math.max(0, -dx / (width * SWIPE_RATIO)));

  return (
    <div
      ref={ref}
      class="swipe-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={onClickCapture}
    >
      <div class="swipe-card__behind" style={{ opacity: reveal }} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
        {laterLabel}
      </div>
      <div class={`swipe-card__body${dragging ? ' swipe-card__body--dragging' : ''}`} style={{ transform: dx ? `translateX(${dx}px)` : undefined }}>
        {children}
        <button type="button" class="swipe-card__later" onClick={() => onDefer('button')}>
          {laterLabel}
        </button>
      </div>
    </div>
  );
}
