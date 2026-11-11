/**
 * État partagé des remarques d'usage (retouche du 11/11) : la liste (Réglages) et la demande
 * d'ouverture du panneau « Signaler », qui peut venir de n'importe quel écran, du menu de la
 * séance ou du raccourci Android. Le panneau est monté une seule fois, dans App.
 */
import { computed, signal } from '@preact/signals';
import { addRemark, deleteRemark, lastScreen, listRemarks } from '../data/remarksRepo';
import { track } from '../data/usage';
import { remarksSinceExport, type Remark, type RemarkContext, type SessionContext } from '../domain/remarks';
import { currentRoute } from './router';
import { prefs } from './state';

/** Remarques, de la plus ancienne à la plus récente. */
export const remarks = signal<Remark[]>([]);

/** Contexte de la remarque en cours de saisie (null : panneau fermé). */
export const remarkDraft = signal<RemarkContext | null>(null);

/** Remarques que le dernier export n'a pas encore emportées. */
export const remarksNotExported = computed(() => remarksSinceExport(remarks.value, prefs.value.lastExportAt));

export async function loadRemarksState(): Promise<void> {
  remarks.value = await listRemarks();
}

/**
 * Ouvre le panneau en relevant le contexte maintenant (avant que le panneau ne change l'écran).
 * Depuis le raccourci Android, l'écran courant est l'accueil : on cherche alors le dernier
 * écran vu dans le journal d'usage.
 */
export async function openRemark(origin: RemarkContext['origin'], session?: SessionContext): Promise<void> {
  const context: RemarkContext = {
    screen: currentRoute.value.name,
    origin,
    appVersion: __APP_VERSION__,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    ...(session ? { session } : {}),
  };
  remarkDraft.value = context;
  track('remark-open', { origin, screen: context.screen });
  if (origin === 'shortcut') {
    const last = await lastScreen().catch(() => undefined);
    if (last && remarkDraft.value === context) remarkDraft.value = { ...context, lastScreen: last };
  }
}

export function closeRemark(): void {
  remarkDraft.value = null;
}

/** Enregistre la remarque saisie (le texte reste sur le téléphone : seul le nombre va au journal). */
export async function saveRemark(remark: Omit<Remark, 'id'>): Promise<void> {
  const id = await addRemark(remark);
  remarks.value = [...remarks.value, { ...remark, id }];
  track('remark', { tags: remark.tags, capture: !!remark.capture, screen: remark.context.screen });
}

export async function removeRemark(id: number): Promise<void> {
  await deleteRemark(id);
  remarks.value = remarks.value.filter((r) => r.id !== id);
}
