/**
 * Configuration Vite (build), vite-plugin-pwa (service worker + manifest) et Vitest (tests).
 */
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Version affichée dans Réglages : « 0.1.0 · 2026-11-06 · a1b2c3d ».
 * Le commit vient de GitHub Actions (GITHUB_SHA) ; en local, « local ».
 */
const appVersion = [
  process.env.npm_package_version ?? '0.0.0',
  new Date().toISOString().slice(0, 10),
  process.env.GITHUB_SHA?.slice(0, 7) ?? 'local',
].join(' · ');

export default defineConfig({
  // GitHub Pages sert le site sous /<nom-du-dépôt>/ : tous les chemins générés en dépendent.
  base: '/cran/',

  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },

  plugins: [
    preact(),
    VitePWA({
      // « prompt » : une nouvelle version est proposée par un bandeau, jamais appliquée d'office.
      // Un rechargement automatique pourrait couper une séance en cours.
      registerType: 'prompt',
      // L'enregistrement est fait à la main dans src/pwa/registerSW.ts (module virtuel).
      injectRegister: false,

      // Icônes générées à partir de public/icon.svg (voir pwa-assets.config.ts),
      // puis injectées dans le manifest et dans <head>.
      pwaAssets: { config: true, overrideManifestIcons: true },

      manifest: {
        name: 'Cran',
        short_name: 'Cran',
        description: 'Renfo au poids de corps, course et alimentation. Hors ligne, sans compte.',
        lang: 'fr',
        dir: 'ltr',
        // Relatifs au manifest, donc à /cran/.
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        // Couleur de l'écran de démarrage et de la barre système.
        background_color: '#000000',
        theme_color: '#120b12',
        // Appui long sur l'icône de l'appli installée → « Signaler » (remarques d'usage, retouche
        // du 11/11). Android ne relit le manifeste qu'à la mise à jour de l'appli installée
        // (parfois un jour ou deux) : le raccourci peut tarder à apparaître.
        shortcuts: [
          {
            name: 'Signaler quelque chose',
            short_name: 'Signaler',
            description: 'Noter ce qui ne va pas dans Cran',
            url: './#/?remarque',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },

      workbox: {
        // « Précache tout » : après la première visite, l'appli fonctionne entièrement hors ligne.
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2,webmanifest}'],
        // Routage par hash : toutes les navigations retombent sur index.html.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },

      devOptions: {
        // Service worker désactivé en développement (évite les caches fantômes pendant le dev).
        enabled: false,
      },
    }),
  ],

  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
