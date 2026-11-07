/**
 * Scan d'un code-barres avec la caméra arrière (API BarcodeDetector de Chrome Android, qui
 * fonctionne hors ligne : la détection se fait sur le téléphone). Si l'API ou la caméra manque,
 * on peut taper le code à la main.
 *
 * Le panneau ne fait que LIRE le code : `resolve` (fourni par l'écran Assiette) cherche le
 * produit et ouvre la suite. Pendant cette recherche, le panneau affiche « Recherche… ».
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { isValidBarcode } from '../../data/openFoodFacts';
import { Sheet } from '../components/Sheet';

/** Sous-ensemble de l'API BarcodeDetector utilisé ici (absente des types DOM de TypeScript). */
interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (options: { formats: string[] }) => Detector;

/** Formats des produits alimentaires (EAN-13 en Europe). */
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

function detectorClass(): DetectorCtor | undefined {
  return (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
}

interface Props {
  onClose: () => void;
  resolve: (code: string, via: 'camera' | 'typed') => Promise<void>;
}

export function ScanSheet({ onClose, resolve }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'starting' | 'on' | 'unavailable'>(detectorClass() ? 'starting' : 'unavailable');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function submit(code: string, via: 'camera' | 'typed') {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await resolve(code, via);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Caméra + détection en boucle (toutes les 150 ms) ; tout est arrêté à la fermeture.
  useEffect(() => {
    const Ctor = detectorClass();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera('on');
        const detector = new Ctor({ formats: FORMATS });
        const loop = async () => {
          if (stopped) return;
          if (!busyRef.current && video.current && video.current.readyState >= 2) {
            try {
              const found = (await detector.detect(video.current)).find((c) => isValidBarcode(c.rawValue));
              if (found) {
                navigator.vibrate?.(60);
                await submit(found.rawValue, 'camera');
              }
            } catch {
              // Image illisible ce coup-ci : on réessaie au tour suivant.
            }
          }
          timer = setTimeout(() => void loop(), 150);
        };
        void loop();
      } catch {
        // Caméra refusée ou occupée : la saisie du code reste possible.
        if (!stopped) setCamera('unavailable');
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // Une seule fois à l'ouverture : `submit` ne dépend d'aucun état du rendu (il passe par busyRef).
  }, []);

  const code = typed.replace(/\D/g, '');
  const typedValid = isValidBarcode(code);

  return (
    <Sheet open onClose={onClose} title="Scanner un produit">
      {camera !== 'unavailable' && (
        <div class="scan">
          <video ref={video} class="scan__video" muted playsInline />
          <div class="scan__frame" aria-hidden="true" />
          {camera === 'starting' && <span class="scan__status">Ouverture de la caméra…</span>}
          {busy && <span class="scan__status">Recherche du produit…</span>}
        </div>
      )}
      {camera === 'unavailable' && (
        <p class="muted sheet__lead">Caméra indisponible ici : tape les chiffres sous le code-barres.</p>
      )}
      {camera === 'on' && !busy && <p class="muted sheet__lead">Vise le code-barres, il est lu tout seul.</p>}

      <form
        class="field"
        onSubmit={(e) => {
          e.preventDefault();
          if (typedValid) void submit(code, 'typed');
        }}
      >
        <label for="scan-code">Ou tape le code</label>
        <div class="field__with-suffix">
          <input
            id="scan-code"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="13 chiffres"
            value={typed}
            onInput={(e) => setTyped(e.currentTarget.value)}
          />
          <button type="submit" class="btn" disabled={!typedValid || busy}>
            {busy ? '…' : 'Chercher'}
          </button>
        </div>
        {code.length >= 8 && !typedValid && <span class="muted field__hint">Ce code ne semble pas valide : vérifie les chiffres.</span>}
      </form>
    </Sheet>
  );
}
