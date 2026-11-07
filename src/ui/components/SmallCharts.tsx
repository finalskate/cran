/**
 * Petites courbes SVG (SPEC §4.10) : tendance miniature, séances par semaine, niveau en escalier.
 * Purement visuelles : la valeur utile est toujours écrite à côté en clair.
 */
import { daysBetween } from '../../domain/days';
import type { WeekCount } from '../../domain/calendar';
import type { LevelStep } from '../../domain/progression';
import { formatTinyDate } from '../format';

/** Tendance miniature (accueil, carte tour de taille) : une ligne, un point au bout. */
export function Sparkline({ values, tone = 'accent' }: { values: readonly number[]; tone?: 'accent' | 'accent-2' }) {
  if (values.length < 2) return null;
  const W = 120;
  const H = 36;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // Amplitude minimale : une ligne presque plate reste presque plate.
  const range = Math.max(hi - lo, 1);
  const mid = (hi + lo) / 2;
  const pts = values.map((v, i) => [4 + (i / (values.length - 1)) * (W - 8), H / 2 - ((v - mid) / range) * (H - 10)] as const);
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg class={`sparkline chart--${tone}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline class="chart__line" points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} />
      <circle class="chart__last" cx={lx} cy={ly} r="4" />
    </svg>
  );
}

/** Séances par semaine : barres empilées renfo (orange) + imposées (rose). */
export function WeeksChart({ weeks }: { weeks: readonly WeekCount[] }) {
  const W = 340;
  const H = 120;
  const PAD = { left: 18, right: 4, top: 8, bottom: 20 };
  const max = Math.max(3, ...weeks.map((w) => w.renfo + w.imposed));
  const slot = (W - PAD.left - PAD.right) / weeks.length;
  const barW = Math.min(18, slot * 0.6);
  const plotH = H - PAD.top - PAD.bottom;
  const y = (n: number) => PAD.top + plotH - (n / max) * plotH;
  const total = weeks.reduce((s, w) => s + w.renfo + w.imposed, 0);
  return (
    <figure class="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Séances par semaine sur ${weeks.length} semaines : ${total} au total`}>
        {[0, max].map((t) => (
          <g key={t}>
            <line class="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text class="chart__tick" x={PAD.left - 5} y={y(t) + 4} text-anchor="end">
              {t}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          return (
            <g key={w.monday}>
              {w.renfo > 0 && <rect class="chart__bar" x={cx - barW / 2} y={y(w.renfo)} width={barW} height={y(0) - y(w.renfo)} rx="3" />}
              {w.imposed > 0 && (
                <rect
                  class="chart__bar chart__bar--alt"
                  x={cx - barW / 2}
                  y={y(w.renfo + w.imposed)}
                  width={barW}
                  height={y(w.renfo) - y(w.renfo + w.imposed)}
                  rx="3"
                />
              )}
              {/* Une date sur deux : la largeur d'un téléphone ne permet pas plus. */}
              {(weeks.length - 1 - i) % 2 === 0 && (
                <text class="chart__tick" x={cx} y={H - 5} text-anchor="middle">
                  {formatTinyDate(w.monday)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Niveau d'un mouvement dans le temps, en escalier (une marche par niveau débloqué). */
export function StepChart({ steps, today, levelCount, label }: { steps: readonly LevelStep[]; today: string; levelCount: number; label: string }) {
  if (steps.length === 0) return null;
  const W = 340;
  const H = 74;
  const PAD = { left: 26, right: 8, top: 8, bottom: 18 };
  const from = steps[0]!.day;
  const span = Math.max(1, daysBetween(from, today));
  const x = (day: string) => PAD.left + (daysBetween(from, day) / span) * (W - PAD.left - PAD.right);
  // Échelle verticale : toute l'échelle du mouvement (on voit le chemin qui reste).
  const y = (level: number) => PAD.top + (1 - level / Math.max(1, levelCount - 1)) * (H - PAD.top - PAD.bottom);
  let d = `M${x(from).toFixed(1)},${y(steps[0]!.level).toFixed(1)}`;
  for (const s of steps.slice(1)) d += ` H${x(s.day).toFixed(1)} V${y(s.level).toFixed(1)}`;
  d += ` H${x(today).toFixed(1)}`;
  const last = steps.at(-1)!;
  return (
    <figure class="chart chart--step">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[0, levelCount - 1].map((l) => (
          <g key={l}>
            <line class="chart__grid" x1={PAD.left} x2={W - PAD.right} y1={y(l)} y2={y(l)} />
            <text class="chart__tick" x={PAD.left - 5} y={y(l) + 4} text-anchor="end">
              {l + 1}
            </text>
          </g>
        ))}
        <text class="chart__tick" x={PAD.left} y={H - 4}>
          {formatTinyDate(from)}
        </text>
        <text class="chart__tick" x={W - PAD.right} y={H - 4} text-anchor="end">
          aujourd’hui
        </text>
        <path class="chart__line" d={d} />
        <circle class="chart__last" cx={x(today)} cy={y(last.level)} r="4" />
      </svg>
    </figure>
  );
}
