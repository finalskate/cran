/**
 * Retours pendant la séance : vibration, bip, voix, notification (relayée par la montre).
 * Chaque fonction échoue en silence : un retour manquant ne doit jamais bloquer la séance.
 */

// ─── Son ───

let audio: AudioContext | null = null;

/**
 * Android n'autorise le son qu'après un geste de l'utilisateur : à appeler sur le bouton
 * « C'est parti » pour « déverrouiller » l'audio pour toute la séance.
 */
export function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

/** Bip discret, généré (aucun fichier son à embarquer). `count` bips courts. */
export function beep(count = 2): void {
  if (!audio) return;
  try {
    const t0 = audio.currentTime;
    for (let i = 0; i < count; i++) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = 880;
      const start = t0 + i * 0.22;
      // Enveloppe douce : pas de « clic » au début ni à la fin.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.linearRampToValueAtTime(0, start + 0.15);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.16);
    }
  } catch {
    /* son indisponible */
  }
}

// ─── Vibration ───

export function vibrate(pattern: number | number[] = [200, 100, 200]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* vibration indisponible */
  }
}

// ─── Voix ───

/** Voix française si le téléphone en a une (synthèse vocale d'Android, hors ligne). */
function frenchVoice(): SpeechSynthesisVoice | undefined {
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('fr'));
}

export function voiceAvailable(): boolean {
  return 'speechSynthesis' in window;
}

export function speak(text: string): void {
  if (!voiceAvailable()) return;
  try {
    speechSynthesis.cancel(); // pas d'empilement d'annonces
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const voice = frenchVoice();
    if (voice) u.voice = voice;
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch {
    /* voix indisponible */
  }
}

// ─── Notification (montre) ───

export type NotifyPermission = NotificationPermission | 'unsupported';

export function notifyPermission(): NotifyPermission {
  return 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Préfixe commun des notifications de fin de repos. */
const NOTIFY_TAG = 'cran-rest';

/**
 * Notification système via le service worker : les notifications intelligentes de la montre
 * la relaient, elle vibre au poignet (SPEC §4.12).
 *
 * Chaque notification a un `tag` UNIQUE : la montre ne relaie que les nouvelles notifications.
 * Remplacer la précédente (même tag) mettait à jour celle du téléphone sans faire vibrer la montre.
 * Pour ne pas encombrer le volet, les anciennes notifications de repos sont fermées d'abord.
 */
export async function notify(title: string, body: string): Promise<void> {
  if (notifyPermission() !== 'granted' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const previous = await reg.getNotifications();
    previous.filter((n) => n.tag.startsWith(NOTIFY_TAG)).forEach((n) => n.close());
    await reg.showNotification(title, {
      body,
      tag: `${NOTIFY_TAG}-${Date.now()}`,
      ...({ vibrate: [200, 100, 200] } as object),
      icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
      silent: false,
    });
  } catch {
    /* notification refusée ou indisponible */
  }
}
