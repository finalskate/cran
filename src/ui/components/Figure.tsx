/**
 * Mannequin animé d'une variante (SPEC §4.3, J8) : dessine en SVG les formes calculées par
 * src/domain/figure.ts, image par image.
 *
 *  - Membres du fond plus sombres que ceux de devant : la profondeur se lit sans ombre portée.
 *  - L'animation ne tourne que si la figure est visible à l'écran (batterie).
 *  - Mouvements réduits (réglage du téléphone ou « effets réduits ») : pas d'interpolation, les
 *    positions clés s'enchaînent toutes les 1,5 s.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { bounds, cycleDuration, floorArea, limbPath, scene, type Animation, type Shape } from '../../domain/figure';
import { prefs } from '../state';

/** Couleurs du corps : du membre le plus au fond au plus en avant. */
const FAR = [120, 98, 108];
const NEAR = [246, 234, 238];

/** Matériel : couleur par face (dessus, face avant, côté). */
const MATERIAL: Record<string, Record<string, string>> = {
  wood: { top: '#7a5b45', front: '#5e4434', side: '#4d372a' },
  wall: { top: '#3a2c35', front: '#30242c', side: '#2a1f27' },
  soft: { top: '#57474f', front: '#463840', side: '#3b2f36' },
};

function shade(t: number): string {
  const c = FAR.map((f, i) => Math.round(f + (NEAR[i]! - f) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function points(sh: Extract<Shape, { kind: 'poly' }>): string {
  return sh.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/** Instants des positions clés : la fin de chaque déplacement. */
export function keyTimes(anim: Animation): number[] {
  let t = 0;
  return anim.frames.map((k) => {
    t += k.move;
    const at = t;
    t += k.hold ?? 0;
    return at;
  });
}

function reducedMotion(): boolean {
  return prefs.value.fx === 'reduced' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

interface Props {
  anim: Animation;
  /** Texte pour les lecteurs d'écran (nom de l'exercice). */
  label: string;
  /** Hauteur à l'écran, en pixels. */
  height?: number;
  /** Image fixe à cet instant (secondes) au lieu de l'animation. */
  at?: number;
}

export function Figure({ anim, label, height = 170, at }: Props) {
  const box = useMemo(() => bounds(anim), [anim]);
  const floor = useMemo(() => floorArea(anim), [anim]);
  const [time, setTime] = useState(at ?? 0);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (at !== undefined) return;
    let raf = 0;
    let timer = 0;
    let visible = false;
    const start = performance.now();
    const reduced = reducedMotion();
    const keys = keyTimes(anim);
    let k = 0;
    const tick = () => {
      setTime((performance.now() - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (reduced) {
        setTime(keys[k % keys.length]!);
        timer = window.setInterval(() => setTime(keys[++k % keys.length]!), 1500);
      } else raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e!.isIntersecting && !visible) (visible = true), run();
      else if (!e!.isIntersecting && visible) (visible = false), stop();
    });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      stop();
    };
  }, [anim, at]);

  const sc = scene(anim, time % Math.max(cycleDuration(anim), 0.001), floor);
  const depths = sc.body.map((s) => s.depth);
  const dMin = Math.min(...depths);
  const dMax = Math.max(...depths);
  const tone = (d: number) => shade(dMax - dMin > 1e-3 ? 0.15 + (0.85 * (d - dMin)) / (dMax - dMin) : 1);

  return (
    <svg
      ref={ref}
      class="figure"
      role="img"
      aria-label={`Animation : ${label}`}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      style={{ height: `${height}px` }}
      preserveAspectRatio="xMidYMid meet"
    >
      <polygon class="figure__floor" points={points(sc.floor as Extract<Shape, { kind: 'poly' }>)} />
      {sc.props.map((sh, i) =>
        sh.kind === 'poly' ? (
          <polygon key={i} points={points(sh)} fill={MATERIAL[sh.material]?.[sh.tone] ?? '#444'} stroke="rgba(255,255,255,0.10)" stroke-width="0.5" stroke-linejoin="round" />
        ) : sh.kind === 'limb' ? (
          <path key={i} d={limbPath(sh.a, sh.b, sh.ra, sh.rb)} class={`figure__${sh.part === 'cord' ? sh.tone : sh.part}`} />
        ) : null,
      )}
      {sc.body.map((sh, i) => {
        const fill = tone(sh.depth);
        // Liseré couleur du fond : un membre se détache de celui qu'il recouvre.
        if (sh.kind === 'limb') return <path key={i} d={limbPath(sh.a, sh.b, sh.ra, sh.rb)} fill={fill} class="figure__part" />;
        if (sh.kind === 'disc') return <circle key={i} cx={sh.c.x} cy={sh.c.y} r={sh.r} fill={fill} class="figure__part" />;
        return <polygon key={i} points={points(sh)} fill={fill} />;
      })}
    </svg>
  );
}
