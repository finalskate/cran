/**
 * Saisie en une phrase (J5b) : pour chaque morceau lu (src/domain/phrase.ts), les aliments qui
 * peuvent correspondre, du plus probable au moins probable :
 *  1. mes aliments (déjà notés, scannés, créés) : ce que je mange souvent passe devant ;
 *  2. la table Ciqual embarquée, la version cuite d'abord (hors ligne).
 * Si la recherche entière ne trouve rien, elle est élargie en retirant un mot (queryVariants).
 * Testé dans phraseMatch.test.ts, sur la vraie table Ciqual.
 */
import { parsePiece, queryVariants, splitPhrase, type PhrasePiece } from '../domain/phrase';
import { searchFoods, type Food } from '../domain/nutrition';
import { ciqualToFood, searchCiqual, type CiqualIndex } from './ciqual';
import { PHRASE_VOCABULARY } from './phraseWords';

/** Mes aliments retenus au plus, puis aliments Ciqual, par morceau. */
const MAX_MINE = 3;
const MAX_CIQUAL = 6;

export interface PhraseMatch {
  piece: PhrasePiece;
  /** Aliments proposés, le premier est choisi d'office ; vide = rien trouvé. */
  candidates: Food[];
  /** Trouvé en retirant un mot de la recherche (à vérifier d'un coup d'œil). */
  loose: boolean;
}

export function matchPiece(piece: PhrasePiece, mine: readonly Food[], index: CiqualIndex, now: string): PhraseMatch {
  const stored = new Map(mine.map((f) => [f.id, f]));
  for (const [i, q] of queryVariants(piece.query).entries()) {
    const fromMine = searchFoods(mine, q).slice(0, MAX_MINE);
    const fromCiqual = searchCiqual(index, q, MAX_CIQUAL, { preferCooked: true })
      .map((row) => ciqualToFood(row, now))
      // Un aliment Ciqual déjà noté est repris tel que gardé (favori, usage).
      .map((f) => stored.get(f.id) ?? f)
      .filter((f) => !fromMine.some((m) => m.id === f.id));
    const candidates = [...fromMine, ...fromCiqual];
    if (candidates.length > 0) return { piece, candidates, loose: i > 0 };
  }
  return { piece, candidates: [], loose: false };
}

/** Toute la phrase : un résultat par morceau. */
export function matchPhrase(text: string, mine: readonly Food[], index: CiqualIndex, now: string): PhraseMatch[] {
  return splitPhrase(text, PHRASE_VOCABULARY).map((part) => matchPiece(parsePiece(part, PHRASE_VOCABULARY), mine, index, now));
}
