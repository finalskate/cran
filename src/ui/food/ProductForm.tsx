/**
 * Saisie d'un produit depuis son étiquette : produit inconnu d'Open Food Facts, scan hors
 * ligne, ou fiche incomplète. Une seule fois par produit : le code-barres est ensuite reconnu,
 * même hors ligne.
 */
import { useState } from 'preact/hooks';
import { formatAmount, type Food, type Portion } from '../../domain/nutrition';
import { saveFood } from '../../data/foodRepo';
import { barcodeFoodId } from '../../data/openFoodFacts';
import { Sheet } from '../components/Sheet';
import { parseDecimal } from '../format';
import { NumberField } from './common';

interface Props {
  barcode: string;
  /** Fiche existante à compléter ou corriger. */
  initial?: Food;
  /** Pourquoi on demande la saisie (affiché en tête). */
  reason: 'not-found' | 'offline' | 'incomplete' | 'edit';
  onClose: () => void;
  onSaved: (food: Food) => void;
}

const REASON_TEXT: Record<Props['reason'], string> = {
  'not-found': 'Produit inconnu de la base Open Food Facts.',
  offline: 'Pas de réseau : la base en ligne est injoignable.',
  incomplete: 'La fiche de ce produit est incomplète.',
  edit: 'Corrige les valeurs si elles ne correspondent pas au paquet.',
};

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

export function ProductForm({ barcode, initial, reason, onClose, onSaved }: Props) {
  const pack0 = initial?.portions.find((p) => p.label.startsWith('1 paquet'))?.amount;
  const serving0 = initial?.portions.find((p) => p.label.startsWith('1 portion'))?.amount;
  const [name, setName] = useState(initial && !initial.name.startsWith('Produit ') ? initial.name : '');
  const [kcal, setKcal] = useState(initial?.per100 ? String(initial.per100.kcal) : '');
  const [protein, setProtein] = useState(initial?.per100 ? formatAmount(initial.per100.protein) : '');
  const [pack, setPack] = useState(pack0 ? formatAmount(pack0) : '');
  const [serving, setServing] = useState(serving0 ? formatAmount(serving0) : '');

  const kcalN = parseDecimal(kcal);
  const valid = name.trim() !== '' && kcalN !== undefined && kcalN <= 900;

  async function save() {
    if (!valid) return;
    const food: Food = {
      ...(initial ?? { uses: 0, createdAt: new Date().toISOString() }),
      id: barcodeFoodId(barcode),
      // Une fiche Open Food Facts reste « off » si on ne fait que la compléter.
      source: initial?.source === 'off' ? 'off' : 'label',
      name: name.trim(),
      barcode,
      per100: { kcal: Math.round(kcalN!), protein: parseDecimal(protein) ?? 0 },
      unit: initial?.unit ?? 'g',
      portions: labelPortions(parseDecimal(pack), parseDecimal(serving)),
    } as Food;
    onSaved(await saveFood(food));
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Recopier l’étiquette"
      kicker={`Code ${barcode}`}
      footer={
        <button type="button" class="cta cta--compact" disabled={!valid} onClick={() => void save()}>
          <span class="cta__title">Enregistrer le produit</span>
        </button>
      }
    >
      <p class="muted sheet__lead">
        {REASON_TEXT[reason]} Sur le paquet, tableau « valeurs nutritionnelles », colonne <strong>pour 100 g</strong>.
      </p>
      <div class="field">
        <label for="pf-name">Nom</label>
        <input id="pf-name" type="text" value={name} placeholder="ex. Chips nature" onInput={(e) => setName(e.currentTarget.value)} />
      </div>
      <div class="field-pair">
        <NumberField id="pf-kcal" label="Énergie" suffix="kcal" value={kcal} onInput={setKcal} />
        <NumberField id="pf-prot" label="Protéines" suffix="g" value={protein} onInput={setProtein} />
      </div>
      <div class="field-pair">
        <NumberField id="pf-pack" label="Poids du paquet" suffix="g" value={pack} onInput={setPack} hint="facultatif" />
        <NumberField id="pf-serving" label="Une portion" suffix="g" value={serving} onInput={setServing} hint="facultatif" />
      </div>
      {kcalN !== undefined && kcalN > 900 && (
        <p class="muted">Plus de 900 kcal pour 100 g, c’est impossible : vérifie que ce sont bien des kcal et non des kJ.</p>
      )}
    </Sheet>
  );
}
