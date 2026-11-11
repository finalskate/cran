/**
 * Capture d'écran jointe à une remarque : une appli web ne peut pas photographier l'écran
 * elle-même, l'utilisateur la prend avec Android puis la choisit dans la galerie. On la réduit
 * (largeur 720 px, JPEG) pour qu'elle pèse ~100 Ko dans la base et dans l'export.
 */
import { captureSize } from '../../domain/remarks';

/** Qualité JPEG : le texte de l'appli reste net, les aplats compressent bien. */
const QUALITY = 0.72;

/** Lit une image choisie et renvoie sa version réduite en « data:image/jpeg;base64,… ». */
export async function readCapture(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = captureSize(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    bitmap.close();
  }
}
