/**
 * Écran maintenu allumé pendant la séance (Screen Wake Lock API, SPEC §3.1).
 * Le navigateur relâche le verrou quand l'appli passe en arrière-plan : on le redemande au retour.
 */
import { useEffect } from 'preact/hooks';

/** Garde l'écran allumé tant que le composant appelant est affiché. */
export function useWakeLock(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;

    async function acquire() {
      if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!active) void lock.release();
      } catch {
        /* refusé (batterie faible, mode économie…) : la séance continue sans */
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release();
    };
  }, []);
}
