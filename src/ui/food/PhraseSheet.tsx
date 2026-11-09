/**
 * Saisie en une phrase (J5b) : « wrap poulet + petite frite + coca zéro » devient une liste
 * d'aliments proposés, chacun avec sa portion. Rien n'est noté sans être vu : toucher une ligne
 * permet de changer d'aliment (les autres résultats), de portion ou de nombre, ou de la retirer.
 * Puis le repas, et « Ajouter » note tout d'un coup. Hors ligne : mes aliments + table Ciqual.
 *
 * Un aliment de la table n'entre dans la base locale (récents, favoris) qu'au moment où il est noté.
 */
import { useEffect, useState } from 'preact/hooks';
import { choosePortion, type PhrasePiece } from '../../domain/phrase';
import { amountPortion, formatCount, mealForTime, portionNutrients, type Food, type Meal, type Portion } from '../../domain/nutrition';
import { loadCiqual } from '../../data/ciqual';
import { listFoods, saveFood } from '../../data/foodRepo';
import { matchPhrase } from '../../data/phraseMatch';
import { PHRASE_VOCABULARY } from '../../data/phraseWords';
import { track } from '../../data/usage';
import { Sheet } from '../components/Sheet';
import { Stepper } from '../components/Stepper';
import { logEntry } from '../foodState';
import { formatInt } from '../format';
import { isPastDay, makeEntry, MealPicker, NutrientsLine } from './common';

interface Props {
  text: string;
  day: string;
  onClose: () => void;
}

/** Une ligne proposée : le morceau de phrase, les aliments possibles et le choix en cours. */
interface Line {
  piece: PhrasePiece;
  candidates: Food[];
  /** Trouvé en élargissant la recherche : « à vérifier ». */
  loose: boolean;
  food: Food | null;
  portion: Portion | null;
  count: number;
  /** Changé à la main (journal d'usage : la lecture automatique était-elle juste ?). */
  edited: boolean;
}

/** Autres aliments proposés quand on touche une ligne (sous la portion : c'est elle qu'on corrige le plus). */
const MAX_CHOICES = 4;

function pick(piece: PhrasePiece, food: Food | null): Pick<Line, 'food' | 'portion' | 'count'> {
  const chosen = food ? choosePortion(food, piece, PHRASE_VOCABULARY) : null;
  return { food: chosen ? food : null, portion: chosen?.portion ?? null, count: chosen?.count ?? 1 };
}

function lineNutrients(line: Line) {
  if (!line.food || !line.portion) return { kcal: 0, protein: 0 };
  const unit = portionNutrients(line.food, line.portion);
  return { kcal: unit.kcal * line.count, protein: unit.protein * line.count };
}

export function PhraseSheet({ text, day, onClose }: Props) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [stored, setStored] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [meal, setMeal] = useState<Meal>(mealForTime(new Date()));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void Promise.all([listFoods(), loadCiqual()]).then(([mine, index]) => {
      if (!alive) return;
      setStored(new Set(mine.map((f) => f.id)));
      const matches = matchPhrase(text, mine, index, new Date().toISOString());
      setLines(matches.map((m) => ({ ...m, ...pick(m.piece, m.candidates[0] ?? null), edited: false })));
    });
    return () => {
      alive = false;
    };
  }, [text]);

  const valid = (lines ?? []).filter((l) => l.food && l.portion);
  const total = valid.reduce(
    (acc, l) => {
      const n = lineNutrients(l);
      return { kcal: acc.kcal + n.kcal, protein: acc.protein + n.protein };
    },
    { kcal: 0, protein: 0 },
  );

  function update(i: number, change: Partial<Line>) {
    setLines((prev) => prev && prev.map((l, j) => (j === i ? { ...l, ...change, edited: true } : l)));
  }

  function remove(i: number) {
    setLines((prev) => prev && prev.filter((_, j) => j !== i));
    setEditing(null);
  }

  async function add() {
    if (!lines) return;
    setBusy(true);
    for (const l of valid) {
      if (!stored.has(l.food!.id)) await saveFood(l.food!);
      await logEntry(makeEntry(day, meal, l.food!.name, l.portion!.label, l.count, portionNutrients(l.food!, l.portion!), 'phrase', l.food!.id));
      track('food-add', { method: 'phrase', meal, past: isPastDay(day), source: l.food!.source });
    }
    track('food-phrase', {
      pieces: lines.length,
      added: valid.length,
      edited: lines.filter((l) => l.edited).length,
      loose: lines.filter((l) => l.loose).length,
    });
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="En une phrase"
      kicker={text}
      footer={
        <button type="button" class="cta cta--compact" disabled={busy || valid.length === 0} onClick={() => void add()}>
          <span class="cta__title">{valid.length > 1 ? `Ajouter les ${valid.length}` : 'Ajouter'}</span>
        </button>
      }
    >
      {!lines && <p class="muted">Recherche…</p>}
      {lines && (
        <>
          <p class="muted" style={{ margin: 0 }}>
            Touche une ligne pour changer l’aliment, la portion ou le nombre.
          </p>
          <div class="food-list" aria-label="Aliments proposés">
            {lines.map((l, i) => (
              <PhraseLine
                key={i}
                line={l}
                open={editing === i}
                onToggle={() => setEditing(editing === i ? null : i)}
                onFood={(food) => update(i, pick(l.piece, food))}
                onPortion={(portion) => update(i, { portion })}
                onCount={(count) => update(i, { count })}
                onRemove={() => remove(i)}
              />
            ))}
          </div>
          {lines.some((l) => !l.food) && (
            <p class="muted" style={{ margin: 0 }}>
              Ce qui n’est pas trouvé n’est pas noté : ajoute-le à part (recherche, ou « Créer »).
            </p>
          )}
          <MealPicker value={meal} onChange={setMeal} />
          <NutrientsLine value={total} />
        </>
      )}
    </Sheet>
  );
}

interface LineProps {
  line: Line;
  open: boolean;
  onToggle: () => void;
  onFood: (food: Food) => void;
  onPortion: (portion: Portion) => void;
  onCount: (count: number) => void;
  onRemove: () => void;
}

function PhraseLine({ line, open, onToggle, onFood, onPortion, onCount, onRemove }: LineProps) {
  const { food, portion, count } = line;
  const kcal = Math.round(lineNutrients(line).kcal);
  // Portions de l'aliment, plus la quantité dite dans la phrase (« 150 g ») si elle n'y est pas.
  const portions = food
    ? [...(portion && !food.portions.some((p) => p.label === portion.label) ? [portion] : []), ...food.portions]
    : [];
  if (food?.per100 && portions.length === 0) portions.push(amountPortion(food, 100));

  return (
    <div class={`phrase-line${open ? ' phrase-line--open' : ''}`}>
      <button type="button" class="food-row" aria-expanded={open} onClick={onToggle}>
        <span class="food-row__main">
          <span class="food-row__name">{food ? food.name : `« ${line.piece.text} »`}</span>
          <span class="muted food-row__meta">
            {food && portion
              ? `${count !== 1 ? `${formatCount(count)} × ` : ''}${portion.label}${line.loose ? ' · à vérifier' : ''}`
              : 'Pas trouvé'}
          </span>
        </span>
        {food && <span class="num muted">{formatInt(kcal)} kcal</span>}
      </button>
      {open && (
        <div class="phrase-edit">
          {food && portions.length > 1 && (
            <div class="choice-list" role="radiogroup" aria-label="Portion">
              {portions.map((p) => (
                <button key={p.label} type="button" class="choice" role="radio" aria-checked={portion?.label === p.label} onClick={() => onPortion(p)}>
                  <span>{p.label}</span>
                  <span class="muted num">{Math.round(portionNutrients(food, p).kcal)} kcal</span>
                </button>
              ))}
            </div>
          )}
          {food && (
            <div class="row">
              <span>Combien</span>
              <Stepper label="Nombre de portions" value={count} onChange={onCount} step={0.5} min={0.5} max={20} format={formatCount} />
            </div>
          )}
          {line.candidates.length > (food ? 1 : 0) && (
            <div class="choice-list" aria-label="Autres aliments">
              <span class="card__label">Ou plutôt</span>
              {line.candidates
                .filter((c) => c.id !== food?.id)
                .slice(0, MAX_CHOICES)
                .map((c) => (
                  <button key={c.id} type="button" class="choice" onClick={() => onFood(c)}>
                    <span>{c.name}</span>
                  </button>
                ))}
            </div>
          )}
          <button type="button" class="btn btn--small btn--quiet" onClick={onRemove}>
            Retirer cette ligne
          </button>
        </div>
      )}
    </div>
  );
}
