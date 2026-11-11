/**
 * Remarques d'usage (retouche du 11/11) : ce qui ne convient pas, noté sur le moment, avec le
 * contexte relevé tout seul (écran, version, et en séance l'exercice et la série). Elles restent
 * sur le téléphone et partent dans l'export, où elles servent à améliorer l'appli.
 *
 * Fonctions pures, testées dans remarks.test.ts. Le stockage est dans src/data/remarksRepo.ts.
 */

/** Étiquettes facultatives, pour trier les remarques à la lecture de l'export. */
export type RemarkTag = 'bug' | 'unclear' | 'unfit' | 'idea';

export const REMARK_TAGS: readonly RemarkTag[] = ['bug', 'unclear', 'unfit', 'idea'];

/** Où en était la séance au moment de la remarque. */
export interface SessionContext {
  /** Effort ou repos. */
  phase: 'work' | 'rest';
  block: string;
  variantId: string;
  variantName: string;
  /** Série en cours (ou celle qui vient de finir, pendant le repos) sur le nombre prévu. */
  set: number;
  sets: number;
  locationId: string;
  duration: number;
  /** Minutes écoulées depuis le début de la séance. */
  minutes: number;
}

/** Contexte relevé à l'ouverture du panneau : l'utilisateur n'a rien à décrire. */
export interface RemarkContext {
  /** Écran (nom de route) d'où la remarque est partie. */
  screen: string;
  /** D'où le panneau a été ouvert : bouton d'un écran, menu de la séance, raccourci Android. */
  origin: 'screen' | 'session' | 'shortcut';
  appVersion: string;
  /** Largeur × hauteur de la fenêtre, en px CSS (affichage). */
  viewport: string;
  session?: SessionContext;
  /** Raccourci Android : dernier écran vu avant de quitter l'appli, et quand. */
  lastScreen?: { name: string; at: number };
}

/** Une remarque telle qu'elle est enregistrée (table `remarks`, schéma v8). */
export interface Remark {
  id?: number;
  /** Horodatage (ms). */
  at: number;
  text: string;
  tags: RemarkTag[];
  context: RemarkContext;
  /**
   * Capture d'écran jointe, réduite, en « data:image/jpeg;base64,… ». Gardée en texte (et non en
   * Blob comme les photos) : elle passe telle quelle dans l'export JSON, sans conversion, et ne
   * pèse qu'une centaine de Ko.
   */
  capture?: string;
}

/** Une remarque est enregistrable si elle dit quelque chose : un texte, ou au moins une capture. */
export function canSaveRemark(text: string, capture: string | undefined): boolean {
  return text.trim().length > 0 || !!capture;
}

/** Remarques notées après le dernier export (celles que je n'ai pas encore pu lire). */
export function remarksSinceExport(remarks: readonly Pick<Remark, 'at'>[], lastExportAt: string): number {
  const since = lastExportAt ? Date.parse(lastExportAt) : Number.NEGATIVE_INFINITY;
  return remarks.filter((r) => r.at > since).length;
}

/**
 * Largeur maximale d'une capture réduite : le texte de l'appli reste lisible (un écran de
 * téléphone fait ~400 px CSS de large ; 720 px garde presque deux pixels par pixel CSS).
 */
export const CAPTURE_MAX_WIDTH = 720;
/** Hauteur maximale (captures défilantes très longues). */
export const CAPTURE_MAX_HEIGHT = 2400;

/** Dimensions d'une capture réduite, proportions gardées, jamais agrandie. */
export function captureSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, CAPTURE_MAX_WIDTH / width, CAPTURE_MAX_HEIGHT / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Dernier écran vu, d'après le journal d'usage (événements « screen », notés quand on quitte un
 * écran). Sert au raccourci Android, qui ouvre l'appli sans savoir d'où l'on venait.
 */
export function lastScreenFrom(
  events: readonly { at: number; type: string; data?: Record<string, unknown> }[],
): { name: string; at: number } | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!;
    if (e.type === 'screen' && typeof e.data?.name === 'string') return { name: e.data.name, at: e.at };
  }
  return undefined;
}
