/**
 * Saisie d'un aliment à la main :
 *  - avec code-barres : produit inconnu d'Open Food Facts, scan hors ligne, fiche incomplète.
 *    Une seule fois par produit : le code est ensuite reconnu, même hors ligne ;
 *  - sans code-barres (« Créer un aliment ») : plat d'une enseigne, produit en vrac… Les
 *    valeurs se recopient pour 100 g (étiquette) ou pour une pièce (site d'une enseigne :
 *    « 1 wrap = 520 kcal »).
 */
import { useState } from 'preact/hooks';
import { formatAmount, type Food, type Portion } from '../../domain/nutrition';
import { saveFood } from '../../data/foodRepo';
import { barcodeFoodId } from '../../data/openFoodFacts';
import { track } from '../../data/usage';
import { Sheet } from '../components/Sheet';
import { parseDecimal } from '../format';
import { NumberField } from './common';

type Reason = 'not-found' | 'offline' | 'incomplete' | 'edit' | 'create';

interface Props {
  /** Absent : aliment sans code-barres. */
  barcode?: string;
  /** Fiche existante à compléter ou corriger. */
  initial?: Food;
  /** Nom pré-rempli (la recherche qui n'a rien donné). */
  initialName?: string;
  /** Pourquoi on demande la saisie (affiché en tête). */
  reason: Reason;
  onClose: () => void;
  onSaved: (food: Food) => void;
}

const REASON_TEXT: Record<Reason, string> = {
  'not-found': 'Produit inconnu de la base Open Food Facts.',
  offline: 'Pas de réseau : la base en ligne est injoignable.',
  incomplete: 'La fiche de ce produit est incomplète.',
  edit: 'Corrige les valeurs si elles ne correspondent pas au paquet.',
  create: 'Recopie les valeurs une fois : l’aliment se renote ensuite en deux gestes.',
};

/** Au-delà, ce sont des kJ (ou une faute de frappe) : aucun aliment ne dépasse 900 kcal/100 g. */
const MAX_KCAL_100 = 900;
/** Une pièce au-delà de 3 000 kcal : sûrement une erreur de saisie. */
const MAX_KCAL_PIECE = 3000;

/** Portions d'un produit saisi à la main : portion du fabricant, ½ paquet et paquet, 100 g. */
function labelPortions(pack: number | undefined, serving: number | undefined): Portion[] {
  const out: Portion[] = [];
  if (serving) out.push({ label: `1 portion (${formatAmount(serving)} g)`, amount: serving });
  if (pack && (!serving || pack > serving * 1.2)) {
    out.push({ label: `½ paquet (${formatAmount(pack / 2)} g)`, amount: pack / 2 });
    out.push({ label: `1 paquet (${formatAmount(pack)} g)`, amount: pack });
  }
  out.push({ label: '100 g', amount: 100 });
  return out;
}

export function ProductForm({ barcode, initial, initialName, reason, onClose, onSaved }: Props) {
  const pack0 = initial?.portions.find((p) => p.label.startsWith('1 paquet'))?.amount;
  const serving0 = initial?.portions.find((p) => p.label.startsWith('1 portion'))?.amount;
  const [name, setName] = useState(initial && !initial.name.startsWith('Produit ') ? initial.name : (initialName ?? ''));
  // Sans code-barres, on peut décrire l'aliment par pièce plutôt que pour 100 g.
  const [mode, setMode] = useState<'per100' | 'piece'>('per100');
  const [kcal, setKcal] = useState(initial?.per100 ? String(initial.per100.kcal) : '');
  const [protein, setProtein] = useState(initial?.per100 ? formatAmount(initial.per100.protein) : '');
  const [pack, setPack] = useState(pack0 ? formatAmount(pack0) : '');
  const [serving, setServing] = useState(serving0 ? formatAmount(serving0) : '');
  const [piece, setPiece] = useState('');

  const perPiece = !barcode && mode === 'piece';
  const kcalN = parseDecimal(kcal);
  const maxKcal = perPiece ? MAX_KCAL_PIECE : MAX_KCAL_100;
  const valid = name.trim() !== '' && kcalN !== undefined && kcalN > 0 && kcalN <= maxKcal;

  async function save() {
    if (!valid) return;
    const proteinN = parseDecimal(protein) ?? 0;
    const base = initial ?? { uses: 0, createdAt: new Date().toISOString() };
    const food: Food = perPiece
      ? {
          ...base,
          id: `perso:${crypto.randomUUID()}`,
          source: 'custom',
          name: name.trim(),
          portions: [{ label: piece.trim() || '1 pièce', kcal: Math.round(kcalN!), protein: Math.round(proteinN) }],
        }
      : ({
          ...base,
          id: barcode ? barcodeFoodId(barcode) : (initial?.id ?? `perso:${crypto.randomUUID()}`),
          // Une fiche Open Food Facts reste « off » si on ne fait que la compléter.
          source: initial?.source === 'off' ? 'off' : barcode ? 'label' : 'custom',
          name: name.trim(),
          ...(barcode ? { barcode } : {}),
          per100: { kcal: Math.round(kcalN!), protein: proteinN },
          unit: initial?.unit ?? 'g',
          portions: labelPortions(parseDecimal(pack), parseDecimal(serving)),
        } as Food);
    if (!barcode) track('food-create', { mode });
    onSaved(await saveFood(food));
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={barcode ? 'Recopier l’étiquette' : 'Créer un aliment'}
      kicker={barcode ? `Code ${barcode}` : undefined}
      footer={
        <button type="button" class="cta cta--compact" disabled={!valid} onClick={() => void save()}>
          <span class="cta__title">{barcode ? 'Enregistrer le produit' : 'Créer'}</span>
        </button>
      }
    >
      <p class="muted sheet__lead">
        {REASON_TEXT[reason]}{' '}
        {perPiece ? (
          <>Valeurs pour <strong>une pièce</strong> (site ou appli de l’enseigne, emballage).</>
        ) : (
          <>
            Sur le paquet, tableau « valeurs nutritionnelles », colonne <strong>pour 100 g</strong>.
          </>
        )}
      </p>
      <div class="field">
        <label for="pf-name">Nom</label>
        <input id="pf-name" type="text" value={name} placeholder="ex. Chips nature" onInput={(e) => setName(e.currentTarget.value)} />
      </div>
      {!barcode && (
        <div class="segmented segmented--tight" role="radiogroup" aria-label="Valeurs données">
          <button type="button" class="btn btn--small" role="radio" aria-checked={mode === 'per100'} onClick={() => setMode('per100')}>
            Pour 100 g
          </button>
          <button type="button" class="btn btn--small" role="radio" aria-checked={mode === 'piece'} onClick={() => setMode('piece')}>
            Pour une pièce
          </button>
        </div>
      )}
      <div class="field-pair">
        <NumberField id="pf-kcal" label="Énergie" suffix="kcal" value={kcal} onInput={setKcal} />
        <NumberField id="pf-prot" label="Protéines" suffix="g" value={protein} onInput={setProtein} />
      </div>
      {perPiece ? (
        <div class="field">
          <label for="pf-piece">Une pièce, c’est</label>
          <input id="pf-piece" type="text" value={piece} placeholder="ex. 1 wrap, 1 menu, 1 cornet moyen" onInput={(e) => setPiece(e.currentTarget.value)} />
        </div>
      ) : (
        <div class="field-pair">
          <NumberField id="pf-pack" label="Poids du paquet" suffix="g" value={pack} onInput={setPack} hint="facultatif" />
          <NumberField id="pf-serving" label="Une portion" suffix="g" value={serving} onInput={setServing} hint="facultatif" />
        </div>
      )}
      {kcalN !== undefined && kcalN > maxKcal && (
        <p class="muted">
          {perPiece
            ? `Plus de ${maxKcal} kcal pour une pièce : vérifie la saisie.`
            : `Plus de ${maxKcal} kcal pour 100 g, c’est impossible : vérifie que ce sont bien des kcal et non des kJ.`}
        </p>
      )}
    </Sheet>
  );
}
