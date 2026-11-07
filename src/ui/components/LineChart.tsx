/**
 * Courbe simple en SVG (SPEC §3.1 : pas de bibliothèque, quelques dizaines de lignes suffisent).
 *
 * - `value` : la mesure du jour (pesée), en petits points discrets ;
 * - `line` : la courbe à suivre (tendance lissée). Sans `line`, la courbe relie les valeurs ;
 * - une interruption (`gapBefore`) coupe la courbe : le trou est traversé en pointillés, pour
 *   rester lisible avec des données espacées sans faire croire à des mesures inexistantes ;
 * - toucher la courbe sélectionne le point le plus proche ; `describe` donne la légende affichée
 *   sous le graphique (lue par les lecteurs d'écran).
 */
import { useState } from 'preact/hooks';
import { dayTicks, nearestIndex, splitAtGaps, valueAxis } from '../../domain/chart';
import { daysBetween } from '../../domain/days';
import { formatTinyDate } from '../format';

export interface LinePoint {
  day: string;
  value: number;
  line?: number;
  gapBefore: boolean;
}

interface Props {
  points: readonly LinePoint[];
  /** Période affichée, bornes incluses. */
  from: string;
  to: string;
  /** Amplitude verticale minimale (ex. 2 kg) : une petite variation ne doit pas ressembler à une chute. */
  minRange: number;
  /** Texte d'une graduation verticale. */
  tick: (v: number) => string;
  /** Légende du point touché. */
  describe: (p: LinePoint) => string;
  /** Résumé lu par les lecteurs d'écran. */
  label: string;
  /** Teinte : orange (poids) ou rose (tour de taille). */
  tone?: 'accent' | 'accent-2';
  height?: number;
  /** Petits points des mesures brutes (vrai par défaut). */
  dots?: boolean;
  onSelect?: () => void;
}

const W = 340;
const PAD = { left: 30, right: 10, top: 10, bottom: 22 };

export function LineChart({ points, from, to, minRange, tick, describe, label, tone = 'accent', height = 170, dots = true, onSelect }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const visible = points.filter((p) => p.day >= from && p.day <= to);
  const span = Math.max(1, daysBetween(from, to));
  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const axis = valueAxis(
    visible.flatMap((p) => (p.line === undefined ? [p.value] : [p.value, p.line])),
    minRange,
  );
  const x = (day: string) => PAD.left + (daysBetween(from, day) / span) * plotW;
  const y = (v: number) => PAD.top + ((axis.max - v) / (axis.max - axis.min)) * plotH;
  const lineOf = (p: LinePoint) => p.line ?? p.value;
  const xy = (p: LinePoint) => `${x(p.day).toFixed(1)},${y(lineOf(p)).toFixed(1)}`;

  const segments = splitAtGaps(visible);
  const last = visible.at(-1);
  const current = visible.find((p) => p.day === selected) ?? null;

  function pick(e: PointerEvent) {
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const i = nearestIndex(
      visible.map((p) => x(p.day)),
      sx,
    );
    if (i >= 0) {
      setSelected(visible[i]!.day);
      onSelect?.();
    }
  }

  return (
    <figure class={`chart chart--${tone}`}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} onPointerDown={pick}>
        {axis.ticks.map((t) => (
          <g key={t}>
            <line class="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text class="chart__tick" x={PAD.left - 6} y={y(t) + 4} text-anchor="end">
              {tick(t)}
            </text>
          </g>
        ))}
        {dayTicks(from, to).map((d) => (
          <text key={d} class="chart__tick" x={x(d)} y={height - 6} text-anchor="middle">
            {formatTinyDate(d)}
          </text>
        ))}

        {/* Trous de plus de GAP_DAYS jours : zone grisée + pointillés entre les deux tronçons. */}
        {segments.slice(1).map((seg, i) => {
          const before = segments[i]!.at(-1)!;
          return (
            <g key={seg[0]!.day}>
              <rect class="chart__gap" x={x(before.day)} y={PAD.top} width={x(seg[0]!.day) - x(before.day)} height={plotH} />
              <polyline class="chart__line chart__line--gap" points={`${xy(before)} ${xy(seg[0]!)}`} />
            </g>
          );
        })}

        {dots && visible.map((p) => <circle key={p.day} class="chart__dot" cx={x(p.day)} cy={y(p.value)} r="2.5" />)}
        {segments.map((seg) =>
          seg.length > 1 ? <polyline key={seg[0]!.day} class="chart__line" points={seg.map(xy).join(' ')} /> : null,
        )}
        {last && <circle class="chart__last" cx={x(last.day)} cy={y(lineOf(last))} r="5" />}

        {current && (
          <g>
            <line class="chart__cursor" x1={x(current.day)} x2={x(current.day)} y1={PAD.top} y2={PAD.top + plotH} />
            <circle class="chart__picked" cx={x(current.day)} cy={y(lineOf(current))} r="5" />
          </g>
        )}
      </svg>
      <figcaption class="chart__caption muted" aria-live="polite">
        {current ? describe(current) : 'Touche la courbe pour lire une valeur.'}
      </figcaption>
    </figure>
  );
}
