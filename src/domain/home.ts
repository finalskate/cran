/**
 * Accueil repensé (retour du 21/11 : « l'accueil est souvent surchargé », les cartes
 * s'empilaient dans l'ordre où elles avaient été codées, toutes avec le même poids visuel).
 *
 * L'accueil a désormais trois niveaux :
 *  - « Maintenant » : au plus MAX_NOW cartes d'action, les plus urgentes selon le moment ;
 *  - « Ta journée » : un bloc fixe (semaine, prévu, repas, poids), toujours au même endroit ;
 *  - « Plus tard · n » : tout le reste, replié, et ce que l'utilisateur a mis de côté.
 *
 * Ce module décide quelle carte va où. Chaque carte candidate déclare son identifiant (qui fixe
 * sa priorité, HOME_PRIORITY) et la clé de son occurrence : mettre de côté (balayer, ou
 * « Plus tard ») vaut pour CETTE occurrence seulement. La clé contient le jour ou le créneau
 * (« morning:2026-11-21 ») : le lendemain, la carte revient d'elle-même, et une carte dont le
 * créneau est fini disparaît du tiroir avec lui. Rien n'est jamais perdu en silence.
 *
 * Une nouvelle carte d'accueil = un membre de HomeCardId + sa priorité ici (le compilateur le
 * réclame), pas un bloc de plus empilé dans Today.tsx.
 *
 * Contient aussi les textes d'aide qui s'effacent : utiles la première semaine, du bruit ensuite.
 */

/** Cartes que l'accueil sait afficher. */
export type HomeCardId =
  | 'resume' // séance en cours à reprendre
  | 'first-levels' // première fois : choisir ses niveaux
  | 'morning' // ta nuit + pesée du matin
  | 'knee' // genou du lendemain
  | 'run' // la course (ou le vélo) prévue aujourd'hui
  | 'evening-review' // bilan du soir
  | 'week-review' // bilan du dimanche
  | 'phase' // une nouvelle phase commence
  | 'pause' // mode pause en cours
  | 'pushup-test' // test pompes du mois
  | 'cardio' // prochaine sortie, les jours sans cardio prévu
  | 'backup' // rappel de sauvegarde
  | 'second-session'; // une 2e séance, une fois celle du jour faite

/**
 * Priorité de chaque carte : plus le nombre est petit, plus elle passe devant.
 * `null` : jamais dans « Maintenant », directement dans « Plus tard » (utile, mais jamais urgent).
 */
export const HOME_PRIORITY: Readonly<Record<HomeCardId, number | null>> = {
  resume: 0,
  'first-levels': 10,
  morning: 20,
  knee: 25,
  run: 30,
  'evening-review': 35,
  'week-review': 40,
  phase: 45,
  pause: 50,
  'pushup-test': 60,
  cardio: null,
  backup: null,
  'second-session': null,
};

/** Cartes qu'on ne peut pas mettre de côté (une séance en cours se reprend ou s'abandonne). */
const NOT_DEFERRABLE: ReadonlySet<HomeCardId> = new Set(['resume']);

/** Au plus deux cartes d'action à la fois : au-delà, plus rien ne ressort. */
export const MAX_NOW = 2;

/** Nombre de clés mises de côté gardées (les plus anciennes, périmées, sont oubliées). */
export const DEFERRED_KEEP = 40;

export interface HomeCandidate {
  id: HomeCardId;
  /** Clé de l'occurrence, ex. « morning:2026-11-21 » (voir l'en-tête). */
  key: string;
}

export interface HomeFeed {
  now: HomeCandidate[];
  later: HomeCandidate[];
}

export function canDefer(id: HomeCardId): boolean {
  return !NOT_DEFERRABLE.has(id) && HOME_PRIORITY[id] !== null;
}

/**
 * Répartit les cartes candidates entre « Maintenant » et « Plus tard ».
 *  - triées par priorité (à priorité égale, l'ordre d'arrivée) ;
 *  - une carte mise de côté (`deferred` contient sa clé) va dans « Plus tard » ;
 *  - une carte sans priorité aussi ;
 *  - les autres remplissent « Maintenant » jusqu'à `max`, le surplus va dans « Plus tard ».
 * « Plus tard » garde le même ordre de priorité, les cartes sans priorité à la fin.
 */
export function homeFeed(candidates: readonly HomeCandidate[], deferred: readonly string[], max = MAX_NOW): HomeFeed {
  const rank = (c: HomeCandidate) => HOME_PRIORITY[c.id] ?? Number.POSITIVE_INFINITY;
  const sorted = candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c);
  const set = new Set(deferred);
  const feed: HomeFeed = { now: [], later: [] };
  for (const c of sorted) {
    const putAside = HOME_PRIORITY[c.id] === null || (canDefer(c.id) && set.has(c.key));
    if (!putAside && feed.now.length < max) feed.now.push(c);
    else feed.later.push(c);
  }
  return feed;
}

/** Met une occurrence de côté (sans doublon), en oubliant les plus anciennes au-delà de DEFERRED_KEEP. */
export function deferKey(deferred: readonly string[], key: string): string[] {
  return [...deferred.filter((k) => k !== key), key].slice(-DEFERRED_KEEP);
}

/** Annule une mise de côté (« Annuler » juste après le geste). */
export function undeferKey(deferred: readonly string[], key: string): string[] {
  return deferred.filter((k) => k !== key);
}

// ─── Textes d'aide qui s'effacent ───

/** Un texte d'aide se montre les HINT_DAYS premiers jours où il apparaît, puis se tait. */
export const HINT_DAYS = 5;

/** Pour chaque texte d'aide : nombre de jours où il a été montré, et le dernier. */
export type HintsSeen = Readonly<Record<string, { days: number; last: string }>>;

/** Le texte d'aide `id` est-il encore utile aujourd'hui ? (Toute la journée de son dernier affichage.) */
export function hintVisible(seen: HintsSeen, id: string, today: string, max = HINT_DAYS): boolean {
  const s = seen[id];
  if (!s) return true;
  return s.last === today ? s.days <= max : s.days < max;
}

/** Note qu'un texte d'aide a été montré aujourd'hui (une fois par jour au plus). */
export function markHint(seen: HintsSeen, id: string, today: string): HintsSeen {
  const s = seen[id];
  if (s?.last === today) return seen;
  return { ...seen, [id]: { days: (s?.days ?? 0) + 1, last: today } };
}
