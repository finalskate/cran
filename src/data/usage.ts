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
 *   profile        profil enregistré : cible calculée, plancher appliqué ou non (pas les mensurations)
 *   food-add       aliment noté : méthode (scan, liste, main, libre), repas, jour passé ou non, provenance
 *   food-search    recherche en ligne par nom : résultat (trouvé, hors ligne, saturé), nombre (pas les mots)
 *   food-create    aliment créé sans code-barres : valeurs pour 100 g ou par pièce
 *   food-edit      entrée modifiée ou supprimée
 *   scan           code-barres lu : caméra ou saisie, résultat (connu, trouvé, inconnu, hors ligne)
 *   combo          repas type enregistré : nombre d'entrées
 *   weigh          pesée notée : matin ou non (pas le poids, qui est déjà dans sa table)
 *   day-count      journée comptée ou mise de côté à la main pour l'ajustement
 *   adjust         ajustement de cible proposé, accepté ou refusé : ancienne et nouvelle cible
 *   weigh-result   écran après la pesée : sens de la tendance (pas le poids)
 *   weight-delete  pesée supprimée depuis l'historique
 *   waist          tour de taille noté ou invitation repoussée (pas la valeur)
 *   goals          objectifs de poids enregistrés : nombre d'étapes (pas les valeurs)
 *   measure        tour de bras ou de poitrine noté ou supprimé : type (pas la valeur)
 *   photo          photo de progression prise : pose, mode (retardateur, miroir), caméra ou fichier, retardateur
 *   photo-delete   photos d'un mois supprimées
 *   photo-reveal   photo dévoilée (floutage)
 *   chart          période de la courbe changée, point touché
 *   level-up       niveau débloqué par la double progression : mouvement, ancien, nouveau
 *   level-stay     « Rester encore à ce niveau » après un déblocage
 *   step-back      retour en arrière accepté (deux séances sous la fourchette)
 *   placement      série du test de placement : niveau testé, valeur, suite (monter, descendre, placé)
 *   focus          priorité d'entraînement changée (équilibrée, haut du corps)
 *   protein-ideas  idées de protéines ouvertes, ou une idée choisie (laquelle)
 *   review         bilan du soir noté : d'où (soir, rattrapage, Assiette), écart, déclencheur, protéines (auto ?), légumes
 *   plan           plan « si… alors… » ajouté, modifié ou supprimé : nombre de plans (pas le texte)
 *   imposed        séance imposée notée : type, jambes, intensité, durée
 *   knee-morning   genou du lendemain : plus mal ou non
 *   workout-delete séance supprimée du carnet
 *   activity-delete séance imposée supprimée
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
