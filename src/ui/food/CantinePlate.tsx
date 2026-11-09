/**
 * Mode cantine (J5b, SPEC §4.8) : l'assiette type dessinée (½ légumes, ¼ protéines,
 * ¼ féculents, un fruit à côté), avec sa légende. `tips` : les repères en plus (Assiette).
 * En éloignement, on ne compte plus : c'est ce repère, et le bilan du soir, qui guident.
 */
import { CANTINE_PLATE } from '../../data/phases';

const COLOR: Record<(typeof CANTINE_PLATE.parts)[number]['key'], string> = {
  veg: 'var(--plate-veg)',
  protein: 'var(--plate-protein)',
  starch: 'var(--plate-starch)',
};

/** Rayon de l'assiette et centre, dans un repère de 64 × 56 (fruit en bas à droite). */
const R = 24;
const CX = 26;
const CY = 28;

/** Chemin d'une part de l'assiette, entre deux angles (en tours, 0 = en haut, sens horaire). */
function slice(from: number, to: number): string {
  const point = (t: number) => {
    const a = 2 * Math.PI * t - Math.PI / 2;
    return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY + R * Math.sin(a)).toFixed(2)}`;
  };
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${CX} ${CY} L ${point(from)} A ${R} ${R} 0 ${large} 1 ${point(to)} Z`;
}

export function CantinePlate({ tips = false }: { tips?: boolean }) {
  // Les parts se suivent dans l'ordre de la donnée, à partir du haut.
  let start = 0.5;
  const slices = CANTINE_PLATE.parts.map((part) => {
    const path = slice(start, start + part.share);
    start += part.share;
    return <path key={part.key} d={path} fill={COLOR[part.key]} stroke="var(--bg)" stroke-width="1.5" />;
  });
  return (
    <>
      <div class="cantine-plate">
        <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true">
          {slices}
          <circle cx="56" cy="46" r="7" fill="var(--plate-fruit)" />
        </svg>
        <div class="cantine-plate__legend">
          {CANTINE_PLATE.parts.map((part) => (
            <span key={part.key}>
              <span class="cantine-plate__dot" style={{ background: COLOR[part.key] }} />
              {part.share === 0.5 ? '½' : '¼'} {part.label.toLowerCase()}
            </span>
          ))}
          <span>
            <span class="cantine-plate__dot" style={{ background: 'var(--plate-fruit)' }} />
            {CANTINE_PLATE.dessert.toLowerCase()}
          </span>
        </div>
      </div>
      {tips && (
        <ul class="cantine-tips">
          {CANTINE_PLATE.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </>
  );
}
