/**
 * Une photo de progression, floutée jusqu'au toucher si le réglage est actif (quelqu'un peut
 * regarder l'écran par-dessus l'épaule). L'image est lue depuis son Blob via une URL locale
 * (`blob:`), libérée quand la photo disparaît de l'écran.
 */
import { useEffect, useState } from 'preact/hooks';
import { track } from '../../data/usage';
import type { PhotoRow } from '../../data/db';
import { prefs } from '../state';

/** URL locale d'un Blob, valable tant que le composant est affiché. */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

interface Props {
  photo: PhotoRow;
  alt: string;
  /** Vignette : pas de dévoilement au toucher (le toucher ouvre l'écran Photos). */
  thumb?: boolean;
}

export function PhotoImg({ photo, alt, thumb }: Props) {
  const url = useBlobUrl(photo.blob);
  const [revealed, setRevealed] = useState(false);
  const blurred = prefs.value.photoBlur && !revealed;

  // Une autre photo à la même place : elle repart floutée.
  useEffect(() => setRevealed(false), [photo.id]);

  const img = url && <img class={`photo__img${blurred ? ' photo__img--blur' : ''}`} src={url} alt={alt} width={photo.width} height={photo.height} />;

  if (thumb || !blurred) return <div class={`photo${thumb ? ' photo--thumb' : ''}`}>{img}</div>;
  return (
    <button
      type="button"
      class="photo photo--hidden"
      onClick={() => {
        setRevealed(true);
        track('photo-reveal');
      }}
    >
      {img}
      <span class="photo__veil">Toucher pour voir</span>
    </button>
  );
}
