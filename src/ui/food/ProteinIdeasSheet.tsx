/**
 * Idées de protéines (J3b) : quoi manger pour atteindre la cible de protéines, sans cuisiner
 * ou presque. La liste est une donnée (src/data/proteinIdeas.ts) ; les valeurs viennent de la
 * table Ciqual embarquée, donc disponibles hors ligne.
 *
 * Toucher une idée ouvre la feuille de portion habituelle, avec la portion de l'idée choisie
 * d'avance : un geste de plus pour noter.
 */
import { useEffect, useState } from 'preact/hooks';
import { ciqualToFood, loadCiqual, type CiqualRow } from '../../data/ciqual';
import { getFood } from '../../data/foodRepo';
import { PROTEIN_IDEAS, type ProteinIdea } from '../../data/proteinIdeas';
import { track } from '../../data/usage';
import { formatAmount, portionNutrients, type Food, type Portion } from '../../domain/nutrition';
import { Sheet } from '../components/Sheet';
import { formatInt } from '../format';

interface Idea {
  idea: ProteinIdea;
  food: Food;
  portion: Portion;
  protein: number;
  kcal: number;
}

/** Portion de l'idée, au format des portions Ciqual : « 1 filet (120 g) ». */
function ideaPortion(idea: ProteinIdea, unit: 'g' | 'ml'): Portion {
  return { label: `${idea.portion.label} (${formatAmount(idea.portion.amount)} ${unit})`, amount: idea.portion.amount };
}

/**
 * Met la portion de l'idée en tête. Si une portion de même quantité existe déjà (règles Ciqual :
 * « 2 œufs (100 g) »), c'est elle qui passe en tête, sans doublon.
 */
function withIdeaFirst(portions: readonly Portion[], idea: Portion): Portion[] {
  const same = portions.find((p) => p.amount === idea.amount && p.kcal === undefined);
  return same ? [same, ...portions.filter((p) => p !== same)] : [idea, ...portions];
}

/** Prépare les idées : aliment Ciqual, portion en tête, valeurs ; triées par protéines pour 100 kcal. */
function buildIdeas(rows: readonly CiqualRow[], now: string): Idea[] {
  const byCode = new Map(rows.map((r) => [r[0], r]));
  const out: Idea[] = [];
  for (const idea of PROTEIN_IDEAS) {
    const row = byCode.get(idea.code);
    if (!row) continue;
    const base = ciqualToFood(row, now);
    const portions = withIdeaFirst(base.portions, ideaPortion(idea, base.unit ?? 'g'));
    const portion = portions[0]!;
    const food = { ...base, portions };
    const n = portionNutrients(food, portion);
    out.push({ idea, food, portion, protein: n.protein, kcal: n.kcal });
  }
  return out.sort((a, b) => b.protein / Math.max(b.kcal, 1) - a.protein / Math.max(a.kcal, 1));
}

interface Props {
  /** Protéines qui restent pour atteindre la cible du jour (g), si elle est connue. */
  remaining: number | null;
  onClose: () => void;
  /** Ouvre la feuille de portion de l'aliment choisi. `unsaved` : pas encore dans la base locale. */
  onPick: (food: Food, unsaved: boolean) => void;
}

export function ProteinIdeasSheet({ remaining, onClose, onPick }: Props) {
  const [ideas, setIdeas] = useState<Idea[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadCiqual().then((index) => {
      if (alive) setIdeas(buildIdeas(index.rows, new Date().toISOString()));
    });
    return () => {
      alive = false;
    };
  }, []);

  async function pick(item: Idea) {
    track('protein-ideas', { pick: item.idea.code });
    // Déjà noté une fois : on reprend l'aliment local (favori, récents), avec la portion de l'idée en tête.
    const local = await getFood(item.food.id);
    if (local) {
      onPick({ ...local, portions: withIdeaFirst(local.portions, item.portion) }, false);
    } else {
      onPick(item.food, true);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Idées de protéines" kicker="Assiette">
      {remaining !== null && remaining > 0 && (
        <p class="sheet__lead">
          Encore <strong class="num">{formatInt(remaining)} g</strong> pour ta cible du jour.
        </p>
      )}
      <ul class="prose protein-tips">
        <li>Vise 30 à 40 g à chaque repas plutôt que tout le soir : midi, collation, soir.</li>
        <li>Sans petit-déjeuner, la collation compte double : skyr, œufs durs ou thon plutôt que gâteaux ou chips.</li>
        <li>À la cantine, commence par la viande ou le poisson, et prends un laitage en dessert.</li>
      </ul>
      {ideas === null ? (
        <p class="muted">Chargement…</p>
      ) : (
        <div class="protein-ideas">
          {ideas.map((item) => (
            <button key={item.idea.code} type="button" class="food-row" onClick={() => void pick(item)}>
              <span class="food-row__main">
                <span class="food-row__name">{item.idea.label}</span>
                <span class="muted food-row__meta">
                  {item.portion.label}
                  {item.idea.tip ? ` · ${item.idea.tip}` : ''}
                </span>
              </span>
              <span class="protein-ideas__values">
                <strong class="num accent">{formatInt(item.protein)} g</strong>
                <span class="muted num">{formatInt(item.kcal)} kcal</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p class="muted calc__note">Valeurs de la table Ciqual (Anses). Pour un produit emballé, le scan donne les valeurs exactes.</p>
    </Sheet>
  );
}
