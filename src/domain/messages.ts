/**
 * Choix des messages d'encouragement (les textes sont des données : src/data/messages.ts).
 * Fonctions pures.
 *
 * « Aléatoire » mais reproductible : le tirage dépend d'une graine (le jour, la séance…), pas de
 * Math.random. Un écran qui se redessine (le chrono du repos, chaque seconde) garde donc le même
 * message, et l'accueil garde le sien toute la journée.
 *
 * Les messages sont servis par tours : chaque tour est un ordre mélangé de toute la liste, si bien
 * qu'aucun ne revient avant que les autres soient passés, et jamais deux fois de suite.
 */
import { daysBetween } from './days';

/** Hachage FNV-1a 32 bits d'une chaîne : transforme une graine texte en nombre. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire mulberry32 : rapide, largement suffisant pour mélanger des phrases. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ordre mélangé (Fisher–Yates) des indices 0 … n − 1, toujours le même pour une graine donnée. */
export function shuffledOrder(n: number, seed: string): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const random = rng(hash(seed));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/** Ordre du tour `cycle` de la série `salt`, sans répéter le dernier message du tour précédent. */
function cycleOrder(n: number, salt: string, cycle: number): number[] {
  const order = shuffledOrder(n, `${salt}#${cycle}`);
  if (cycle > 0 && n > 1) {
    const previousLast = shuffledOrder(n, `${salt}#${cycle - 1}`)[n - 1];
    if (order[0] === previousLast) [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

/**
 * `n`-ième message de la série `salt` (n ≥ 0 : numéro du jour, de la séance, du repos…).
 * Deux séries de graines différentes défilent dans des ordres différents.
 */
export function nthMessage<T>(pool: readonly T[], n: number, salt: string): T {
  if (pool.length === 0) throw new Error('nthMessage : liste de messages vide');
  const k = Math.max(0, Math.floor(n));
  const cycle = Math.floor(k / pool.length);
  return pool[cycleOrder(pool.length, salt, cycle)[k % pool.length]!]!;
}

/** Jour de référence pour numéroter les jours (n'importe quelle date passée convient). */
const EPOCH = '2026-01-01';

/** Message du jour `day` (« 2026-11-14 ») : stable toute la journée, différent de la veille. */
export function dailyMessage<T>(pool: readonly T[], day: string, salt: string): T {
  return nthMessage(pool, daysBetween(EPOCH, day), salt);
}
