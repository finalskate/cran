/**
 * Textes d'aide qui s'effacent (accueil du 21/11) : « Au réveil, avant de manger… » est utile la
 * première semaine, du bruit ensuite. Chaque texte se montre HINT_DAYS jours (voir
 * src/domain/home.ts), le compte est gardé dans le réglage `hintsSeen`.
 */
import { useEffect } from 'preact/hooks';
import { dayKey } from '../../domain/days';
import { hintVisible, markHint } from '../../domain/home';
import { prefs, ready, setPref } from '../state';

/** Le texte d'aide `id` est-il encore à montrer ? Le note comme vu aujourd'hui s'il l'est. */
export function useHint(id: string): boolean {
  const today = dayKey(new Date());
  // Avant la lecture des réglages, on ne sait pas : on montre, sans rien écrire.
  const visible = !ready.value || hintVisible(prefs.value.hintsSeen, id, today);
  useEffect(() => {
    if (!ready.value || !visible || prefs.value.hintsSeen[id]?.last === today) return;
    void setPref('hintsSeen', markHint(prefs.value.hintsSeen, id, today));
  }, [id, today, visible, ready.value]);
  return visible;
}
