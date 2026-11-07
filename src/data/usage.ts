/**
 * Journal d'usage (« mouchard ») : enregistre localement ce qui se passe dans l'appli, pour
 * repérer ce qui gêne à l'usage réel (écran où l'on reste longtemps, exercice souvent remplacé,
 * repos raccourcis ou rallongés, erreurs JavaScript…).
 *
 * - Rien ne quitte le téléphone : le journal n'en sort que dans un export choisi par l'utilisateur.
 * - L'écriture ne doit JAMAIS gêner l'appli : pas d'attente, aucune erreur remontée.
 * - Les événements de plus de 180 jours sont effacés au démarrage.
 *
 * Types d'événements (champ `type`, données dans `data`) :
 *   app-open       démarrage : version, mode installé, taille d'écran
 *   viewport       hauteurs mesurées après le rendu (diagnostic du défilement après mise à jour)
 *   screen         écran quitté : nom et durée passée dessus (ms)
 *   hidden/visible appli passée en arrière-plan / revenue
 *   level          niveau changé : mouvement, ancien, nouveau
 *   sheet          fiche d'exercice ouverte : variante, écran d'origine
 *   demo           lien vidéo ouvert : variante
 *   swap           exercice remplacé : ancienne et nouvelle variante, écran
 *   session-start  séance lancée : lieu, durée, genou, nombre d'étapes
 *   set            série validée : variante, valeur, pré-rempli, objectif, ressenti, durée de la série
 *   set-skip       série sautée
 *   block-skip     bloc passé
 *   timer          chrono d'exercice : objectif, temps tenu, arrêt avant l'objectif ou non
 *   rest-adjust    ±15 s pendant un repos
 *   rest-end       fin de repos : prévue, réelle, fin naturelle ou « Passer »
 *   session-quit   sortie de la séance en cours (croix)
 *   session-end    séance terminée : durée, séries
 *   session-feel   ressenti global donné au bilan
 *   update         mise à jour de l'appli acceptée ou reportée
 *   export         export des données
 *   error          erreur JavaScript non interceptée
 */
import { db, type CranDB } from './db';

/** Durée de conservation du journal. */
export const EVENT_MAX_AGE_DAYS = 180;

/** Enregistre un événement, sans attendre ni jamais échouer. */
export function track(type: string, data?: Record<string, unknown>, database: CranDB = db): void {
  try {
    void database.events.add({ at: Date.now(), type, ...(data ? { data } : {}) }).catch(() => undefined);
  } catch {
    // Base indisponible : tant pis pour cet événement, l'appli continue.
  }
}

/** Efface les événements plus vieux que la durée de conservation. Renvoie le nombre effacé. */
export async function pruneEvents(now: number, database: CranDB = db): Promise<number> {
  const limit = now - EVENT_MAX_AGE_DAYS * 24 * 3600 * 1000;
  return database.events.where('at').below(limit).delete();
}
