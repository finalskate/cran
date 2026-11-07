/**
 * Prise de vue des photos de progression (J3) : plein écran, face puis profil.
 *
 * - Caméra de l'appli (getUserMedia), pas l'appareil photo d'Android : la photo ne passe jamais
 *   par la galerie, elle va directement dans la base locale.
 * - Caméra avant par défaut : on se voit pour s'aligner. L'aperçu est en miroir (comme un
 *   miroir), et la photo est enregistrée telle qu'elle a été vue, pour que les séries se
 *   superposent d'un mois à l'autre.
 * - Calque : la photo précédente de la même pose s'affiche en transparence pour reprendre la
 *   même position, à la même distance.
 * - Retardateur 10 s (ou 3 s) : bips sur les 3 dernières secondes, téléphone posé.
 * - Sans caméra (refusée, indisponible) : choix d'un fichier, réduit de la même façon.
 *
 * Affiché dans <body> (portail) : l'écran a son propre contexte d'empilement (« isolation »),
 * d'où la barre de navigation passerait par-dessus.
 *
 * Les images sont réduites (1 280 px au plus grand côté, JPEG 85 %) : ~200 Ko, assez pour voir
 * la silhouette, assez léger pour des années de photos.
 */
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { PHOTO_POSES, type PhotoPose } from '../../domain/body';
import { addPhoto, photos } from '../bodyState';
import { beep, unlockAudio, vibrate } from '../device/feedback';
import { useBlobUrl } from './PhotoImg';

/** Plus grand côté d'une photo enregistrée (px) et qualité JPEG. */
const MAX_SIDE = 1280;
const QUALITY = 0.85;

const POSE_LABEL: Record<PhotoPose, string> = { front: 'De face', side: 'De profil' };
const POSE_HINT: Record<PhotoPose, string> = {
  front: 'Debout, bras légèrement écartés, tout le corps dans le cadre.',
  side: 'Tourné de côté, bras le long du corps, regard droit devant.',
};

type Facing = 'user' | 'environment';
type Captured = { blob: Blob; width: number; height: number };

/** Dessine une image réduite (et en miroir si demandé), puis l'encode en JPEG. */
async function encode(source: CanvasImageSource, srcW: number, srcH: number, mirror: boolean): Promise<Captured> {
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const width = Math.round(srcW * scale);
  const height = Math.round(srcH * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Encodage de la photo impossible');
  return { blob, width, height };
}

export function PhotoCapture({ onClose }: { onClose: () => void }) {
  const [poseIndex, setPoseIndex] = useState(0);
  const pose = PHOTO_POSES[poseIndex]!;
  const [facing, setFacing] = useState<Facing>('user');
  const [timer, setTimer] = useState<10 | 3>(10);
  const [camera, setCamera] = useState<'starting' | 'on' | 'unavailable'>('starting');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captured, setCaptured] = useState<(Captured & { source: 'camera' | 'file' }) | null>(null);
  const [saving, setSaving] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Calque : la photo la plus récente de cette pose (d'un mois précédent ou du mois en cours).
  const ghost = [...photos.value].reverse().find((p) => p.pose === pose);
  const ghostUrl = useBlobUrl(ghost?.blob);
  const capturedUrl = useBlobUrl(captured?.blob);

  // Caméra : relancée au changement d'objectif, arrêtée à la fermeture.
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }
    let stopped = false;
    let stream: MediaStream | undefined;
    setCamera('starting');
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, height: { ideal: 1920 } }, audio: false });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        setCamera('on');
      } catch {
        if (!stopped) setCamera('unavailable');
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // Compte à rebours : un tic par seconde, bips sur les 3 dernières, déclenchement à 0.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      void shoot();
      return;
    }
    if (countdown <= 3) beep(1);
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  async function shoot() {
    const v = video.current;
    if (!v || v.videoWidth === 0) return;
    vibrate(80);
    const image = await encode(v, v.videoWidth, v.videoHeight, facing === 'user');
    setCaptured({ ...image, source: 'camera' });
  }

  async function fromFile(file: File) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const image = await encode(bitmap, bitmap.width, bitmap.height, false);
    bitmap.close();
    setCaptured({ ...image, source: 'file' });
  }

  async function keep() {
    if (!captured) return;
    setSaving(true);
    const { source, ...image } = captured;
    await addPhoto(pose, image, { source, timer: source === 'camera' ? timer : 0 });
    setSaving(false);
    setCaptured(null);
    if (poseIndex < PHOTO_POSES.length - 1) setPoseIndex(poseIndex + 1);
    else onClose();
  }

  return createPortal(
    <div class="capture" role="dialog" aria-modal="true" aria-label={`Photo ${POSE_LABEL[pose].toLowerCase()}`}>
      <div class="capture__top">
        <button type="button" class="icon-btn" aria-label="Fermer" onClick={onClose}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div class="capture__title">
          <strong>{POSE_LABEL[pose]}</strong>
          <span class="muted">
            {poseIndex + 1} / {PHOTO_POSES.length}
          </span>
        </div>
        {camera === 'on' && !captured ? (
          <button type="button" class="icon-btn" aria-label="Changer de caméra" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <path d="M9 13a3 3 0 0 1 5.2-2M15 13a3 3 0 0 1-5.2 2M14 9.5l.4 1.6-1.6.3M10 16.5l-.4-1.6 1.6-.3" />
            </svg>
          </button>
        ) : (
          <span class="icon-btn--spacer" />
        )}
      </div>

      <div class="capture__view">
        {/* La vidéo reste montée en permanence : recréée, elle perdrait le flux de la caméra. */}
        <video ref={video} class={`capture__media${facing === 'user' ? ' capture__media--mirror' : ''}`} muted playsInline />
        {captured ? (
          capturedUrl && <img class="capture__media capture__shot" src={capturedUrl} alt="Photo prise" />
        ) : (
          <>
            {ghostUrl && camera === 'on' && <img class="capture__media capture__ghost" src={ghostUrl} alt="" aria-hidden="true" />}
            {camera === 'starting' && <span class="capture__status">Ouverture de la caméra…</span>}
            {camera === 'unavailable' && (
              <span class="capture__status">Caméra indisponible. Tu peux choisir une photo déjà prise.</span>
            )}
            {countdown !== null && (
              <span class="capture__count num" aria-live="assertive">
                {countdown}
              </span>
            )}
          </>
        )}
      </div>

      <div class="capture__bottom">
        {captured ? (
          <div class="segmented">
            <button type="button" class="btn" onClick={() => setCaptured(null)}>
              Reprendre
            </button>
            <button type="button" class="btn btn--solid" disabled={saving} onClick={() => void keep()}>
              {poseIndex < PHOTO_POSES.length - 1 ? 'Garder, puis profil' : 'Garder'}
            </button>
          </div>
        ) : (
          <>
            <p class="muted capture__hint">
              {POSE_HINT[pose]}
              {ghostUrl ? ' Cale-toi sur le contour de la dernière photo.' : ''}
            </p>
            {camera === 'on' && (
              <div class="segmented segmented--tight" role="radiogroup" aria-label="Retardateur">
                {([10, 3] as const).map((t) => (
                  <button key={t} type="button" class="btn btn--small" role="radio" aria-checked={timer === t} onClick={() => setTimer(t)}>
                    Retardateur {t} s
                  </button>
                ))}
              </div>
            )}
            {camera === 'on' ? (
              <button
                type="button"
                class="cta"
                disabled={countdown !== null}
                onClick={() => {
                  unlockAudio();
                  setCountdown(timer);
                }}
              >
                <span class="cta__title">{countdown !== null ? 'Prends la pose…' : 'Lancer le retardateur'}</span>
              </button>
            ) : (
              <button type="button" class="cta" onClick={() => fileInput.current?.click()}>
                <span class="cta__title">Choisir une photo</span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) void fromFile(file);
                e.currentTarget.value = '';
              }}
            />
            {camera === 'on' && (
              <button type="button" class="btn btn--small btn--quiet" onClick={() => fileInput.current?.click()}>
                Choisir une photo déjà prise
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
