/**
 * Génération des icônes PWA (192, 512, maskable, apple-touch, favicon) à partir d'un seul SVG.
 * Exécutée automatiquement au build par vite-plugin-pwa (option `pwaAssets`) : rien à committer.
 */
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Fond de l'icône « maskable » (Android découpe l'icône en cercle ou en goutte) :
// la même teinte que le fond de l'appli, pour que la découpe soit invisible.
const background = '#120b12';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
