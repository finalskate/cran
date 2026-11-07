/**
 * Géométrie des courbes simples (SPEC §4.10) : graduations « rondes », repères de dates,
 * découpage aux interruptions. Fonctions pures ; le dessin SVG est dans src/ui/components/.
 */
import { addDays, daysBetween } from './days';

/** Pas de graduation « rond » (1, 2 ou 5 × 10ⁿ) pour couvrir `range` en `maxTicks` intervalles au plus. */
export function niceStep(range: number, maxTicks = 4): number {
  const raw = Math.max(range, 1e-9) / maxTicks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Axe vertical : bornes arrondies au pas, avec une petite marge pour que la courbe ne touche
 * pas les bords, et une amplitude minimale (`minRange`) pour qu'une variation de 200 g ne
 * ressemble pas à une chute.
 */
export function valueAxis(values: readonly number[], minRange: number, maxTicks = 4): { min: number; max: number; ticks: number[] } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!Number.isFinite(lo)) return { min: 0, max: 1, ticks: [0, 1] };
  if (hi - lo < minRange) {
    const mid = (lo + hi) / 2;
    lo = mid - minRange / 2;
    hi = mid + minRange / 2;
  }
  const step = niceStep(hi - lo, maxTicks);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  // Arrondi : 0,1 + 0,2 ne fait pas exactement 0,3 en virgule flottante.
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min, max, ticks };
}

/**
 * Repères de dates entre deux jours : début de chaque mois sur une longue période, lundis
 * espacés de 1 ou 2 semaines sur une courte.
 */
export function dayTicks(from: string, to: string): string[] {
  const span = daysBetween(from, to);
  const ticks: string[] = [];
  if (span > 70) {
    // Premier du mois suivant `from`, puis chaque mois ; un mois sur deux au-delà de 8 mois.
    const every = span > 240 ? 2 : 1;
    let [y, m] = from.split('-').map(Number) as [number, number];
    for (;;) {
      m += every;
      if (m > 12) {
        m -= 12;
        y++;
      }
      const day = `${y}-${String(m).padStart(2, '0')}-01`;
      if (day > to) break;
      ticks.push(day);
    }
    return ticks;
  }
  const every = span > 35 ? 14 : 7;
  // Premier lundi après `from` (getDay : 0 = dimanche).
  const [y, m, d] = from.split('-').map(Number) as [number, number, number];
  const weekday = new Date(y, m - 1, d).getDay();
  let day = addDays(from, (8 - weekday) % 7 || 7);
  while (day < to) {
    ticks.push(day);
    day = addDays(day, every);
  }
  return ticks;
}

/** Coupe une suite de points en tronçons continus, aux points marqués `gapBefore`. */
export function splitAtGaps<T extends { gapBefore: boolean }>(points: readonly T[]): T[][] {
  const out: T[][] = [];
  for (const p of points) {
    if (out.length === 0 || p.gapBefore) out.push([p]);
    else out.at(-1)!.push(p);
  }
  return out;
}

/** Indice du point le plus proche d'une abscisse (toucher la courbe pour lire une valeur). */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = -1;
  let dist = Infinity;
  xs.forEach((v, i) => {
    const d = Math.abs(v - x);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}
