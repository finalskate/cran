/**
 * Saisie en une phrase (J5b) : « wrap poulet + petite frite + 2 tranches de jambon » devient
 * plusieurs aliments, chacun avec sa quantité. Fonctions pures, testées dans phrase.test.ts ; le
 * vocabulaire (séparateurs, nombres, tailles, contenants, synonymes) est une DONNÉE
 * (src/data/phraseWords.ts), la recherche de l'aliment se fait dans src/data/phraseMatch.ts.
 *
 * Lecture d'un morceau, dans l'ordre :
 *  1. une quantité en g / ml / cl (« 150 g de riz ») ;
 *  2. un multiplicateur (« x2 ») ;
 *  3. un nombre en tête, en chiffres ou en lettres (« 2 », « deux », « une demi ») ;
 *  4. les mots de taille, où qu'ils soient (« petite frite », « frite moyenne ») ;
 *  5. en tête, un contenant suivi de « de » (« 2 tranches de ») et les mots de liaison ;
 *  6. ce qui reste est l'aliment cherché, après les synonymes (« coca » → « cola »).
 * Rien n'est noté sans être montré : l'écran propose, on corrige d'un geste, puis on note.
 */
import { amountPortion, COUNT_MAX, COUNT_STEP, normalize, type Food, type Portion } from './nutrition';

export type PortionSize = 'small' | 'medium' | 'large';

export interface PhraseVocabulary {
  separators: readonly string[];
  numbers: Readonly<Record<string, number>>;
  sizes: Readonly<Record<string, PortionSize>>;
  sizeInLabel: Readonly<Record<PortionSize, RegExp>>;
  portionWords: readonly string[];
  fillers: readonly string[];
  synonyms: readonly (readonly [RegExp, string])[];
}

/** Un aliment lu dans la phrase. */
export interface PhrasePiece {
  /** Le morceau tel qu'il a été tapé (affiché si rien ne correspond). */
  text: string;
  /** Ce qu'on cherche : normalisé, quantités retirées, synonymes appliqués. */
  query: string;
  /** Nombre de portions (1 par défaut ; 0,5 pour « une demi »). */
  count: number;
  /** Un nombre a été donné (sinon `count` vaut 1 par défaut). */
  counted: boolean;
  /** Quantité en grammes (ou ml) si la phrase la donne. */
  amount?: number;
  size?: PortionSize;
  /** Contenant ou morceau (« tranche »), au singulier. */
  portionWord?: string;
}

/** Morceaux de la phrase. Une virgule entre deux chiffres (« 1,5 ») ne sépare pas. */
export function splitPhrase(text: string, vocab: PhraseVocabulary): string[] {
  const words = vocab.separators.join('|');
  return text
    .split(new RegExp(`[+;\\n]|,(?!\\d)|\\s(?:${words})\\s`, 'i'))
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** La recherche est-elle une phrase de plusieurs aliments ? */
export function looksLikePhrase(text: string, vocab: PhraseVocabulary): boolean {
  return splitPhrase(text, vocab).filter((p) => normalize(p).length >= 2).length >= 2;
}

const UNIT_FACTOR: Readonly<Record<string, number>> = { kg: 1000, g: 1, gr: 1, gramme: 1, grammes: 1, l: 1000, cl: 10, ml: 1 };

function parseNumber(text: string): number | null {
  const frac = /^(\d+)\/(\d+)$/.exec(text);
  if (frac) return Number(frac[2]) > 0 ? Number(frac[1]) / Number(frac[2]) : null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** « tranches » → « tranche », « morceaux » → « morceau ». */
function singular(word: string): string {
  return word.replace(/(?<=..)[sx]$/, '');
}

export function parsePiece(text: string, vocab: PhraseVocabulary): PhrasePiece {
  let t = normalize(text).replace(/½/g, ' demi ').replace(/¼/g, ' quart ');
  let count = 1;
  let counted = false;
  let amount: number | undefined;

  // 1. Quantité en g, ml, cl…
  const qty = /(\d+(?:[.,]\d+)?)\s*(kg|grammes?|gr|g|cl|ml|l)\b/.exec(t);
  if (qty) {
    amount = Math.round(parseNumber(qty[1]!)! * UNIT_FACTOR[qty[2]!]!);
    t = t.replace(qty[0], ' ');
  }
  // 2. Multiplicateur « x2 » ou « 2x ».
  const times = /\bx\s*(\d+)\b|\b(\d+)\s*x\b/.exec(t);
  if (times) {
    count = Number(times[1] ?? times[2]);
    counted = true;
    t = t.replace(times[0], ' ');
  }

  const tokens = t.split(/[\s'’]+/).filter(Boolean);
  // 3. Nombres en tête : « 2 », « une demi » (le produit : 1 × 0,5), « trois quarts ».
  while (tokens.length > 1) {
    const value = parseNumber(tokens[0]!) ?? vocab.numbers[tokens[0]!];
    if (value === undefined || value === null) break;
    count = counted ? count * value : value;
    counted = true;
    tokens.shift();
  }
  // 4. Tailles, où qu'elles soient (« petite frite », « frite moyenne »), sauf si c'est le seul mot.
  let size: PortionSize | undefined;
  const rest = tokens.filter((w) => {
    const s = tokens.length > 1 ? vocab.sizes[w] : undefined;
    if (s) size = s;
    return !s;
  });
  // 5. En tête : contenant suivi de « de » (« tranches de »), et mots de liaison.
  let portionWord: string | undefined;
  while (rest.length > 1) {
    if (vocab.portionWords.includes(singular(rest[0]!)) && vocab.fillers.includes(rest[1]!)) portionWord = singular(rest.shift()!);
    else if (vocab.fillers.includes(rest[0]!)) rest.shift();
    else break;
  }

  // 6. Synonymes.
  let query = rest.join(' ');
  for (const [pattern, replacement] of vocab.synonyms) query = query.replace(pattern, replacement);

  return {
    text: text.trim(),
    query,
    count,
    counted,
    ...(amount ? { amount } : {}),
    ...(size ? { size } : {}),
    ...(portionWord ? { portionWord } : {}),
  };
}

/** Nombre de portions arrondi au pas de saisie (½), entre ½ et le maximum. */
function roundCount(n: number): number {
  return Math.min(COUNT_MAX, Math.max(COUNT_STEP, Math.round(n / COUNT_STEP) * COUNT_STEP));
}

/**
 * Portion et nombre pour un aliment trouvé, d'après ce que dit la phrase :
 *  - une quantité en g / ml : celle-ci ;
 *  - un contenant (« tranche ») : la portion qui le nomme ;
 *  - un nombre qui ouvre le libellé d'une portion (« 6 nuggets » → « 6 pièces ») : celle-ci, une fois ;
 *  - « une demi » : la portion « ½ … » s'il y en a une ;
 *  - une taille : la portion qui la nomme (« Petite frite ») ;
 *  - sinon la première portion proposée (la plus courante).
 * `null` si l'aliment n'a ni portion ni valeurs pour 100 g.
 */
export function choosePortion(food: Food, piece: PhrasePiece, vocab: PhraseVocabulary): { portion: Portion; count: number } | null {
  if (piece.amount && food.per100) return { portion: amountPortion(food, piece.amount), count: piece.counted ? roundCount(piece.count) : 1 };
  const portions = food.portions;
  if (portions.length === 0) return food.per100 ? { portion: amountPortion(food, 100), count: roundCount(piece.count) } : null;
  const labels = portions.map((p) => normalize(p.label));
  const indexes = labels.map((_, i) => i);

  // Contenant nommé, puis taille parmi ceux-là.
  let pool = piece.portionWord ? indexes.filter((i) => labels[i]!.includes(piece.portionWord!)) : indexes;
  if (pool.length === 0) pool = indexes;
  const sized = piece.size ? pool.filter((i) => vocab.sizeInLabel[piece.size!].test(labels[i]!)) : [];
  if (sized.length > 0) pool = sized;

  if (piece.counted && piece.count > 1 && Number.isInteger(piece.count)) {
    const exact = pool.find((i) => labels[i]!.startsWith(`${piece.count} `));
    if (exact !== undefined) return { portion: portions[exact]!, count: 1 };
  }
  if (piece.counted && piece.count < 1) {
    const mark = piece.count === 0.5 ? '½' : piece.count === 0.25 ? '¼' : null;
    const part = mark ? pool.find((i) => labels[i]!.includes(mark)) : undefined;
    if (part !== undefined) return { portion: portions[part]!, count: 1 };
  }
  return { portion: portions[pool[0]!]!, count: roundCount(piece.count) };
}

/**
 * Recherches à essayer, de la plus précise à la plus large : la recherche entière, puis sans
 * un de ses mots (le dernier d'abord : « wrap poulet bacon » → « wrap poulet »).
 */
export function queryVariants(query: string): string[] {
  const words = query.split(' ').filter(Boolean);
  const out = [words.join(' ')];
  if (words.length > 1) {
    for (let i = words.length - 1; i >= 0; i--) out.push(words.filter((_, j) => j !== i).join(' '));
  }
  return [...new Set(out)].filter(Boolean);
}
