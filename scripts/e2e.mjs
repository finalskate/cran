/**
 * Test de bout en bout (fumée) dans un vrai Chrome, en taille téléphone.
 *
 * Parcours : niveaux → accueil (Parc, 20 min) → score genou 3 → aperçu (un remplacement)
 * → séance complète, avec « fermeture » de l'appli et reprise en cours de route → bilan.
 * Échoue si une erreur JavaScript apparaît ou si le bilan n'est pas atteint.
 * Les captures d'écran sont écrites dans `.e2e/` (ignoré par git) pour vérification visuelle.
 *
 * Prérequis : `npm run build` (le script sert `dist/` lui-même) et Google Chrome installé.
 * Usage : `npm run e2e` ; variables facultatives :
 *   CHROME_PATH  chemin de Chrome (défaut : installation Windows standard)
 *   E2E_SIZE     taille d'écran, ex. « 360x640 » (défaut : 390x844)
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const OUT = '.e2e';
const PORT = 4319;
const BASE = `http://localhost:${PORT}/cran/`;
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [width, height] = (process.env.E2E_SIZE ?? '390x844').split('x').map(Number);

await mkdir(OUT, { recursive: true });
const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'silent' });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const errors = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  page.on('dialog', (d) => d.accept()); // confirmations (poignet, abandon…)

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = (name, fullPage = false) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  const text = () => page.evaluate(() => document.body.innerText);

  /** Clique le premier bouton (ou lien) actif dont le texte contient `t`. */
  async function click(t) {
    const ok = await page.evaluate((t) => {
      const el = [...document.querySelectorAll('button, a')].find((b) => b.innerText.includes(t) && !b.disabled);
      el?.click();
      return !!el;
    }, t);
    if (!ok) throw new Error(`bouton introuvable : ${t}`);
    await wait(150);
  }

  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Démarrer la séance'));
  await shot('01-accueil-vierge');

  // Niveaux : pompes au niveau 6 (archer), tirer vertical au niveau 4 (tractions).
  await page.goto(`${BASE}#/niveaux`);
  await wait(300);
  await page.evaluate(() => {
    const steps = (id) => document.getElementById(id).closest('section').querySelectorAll('.ladder__step');
    steps('lvl-push-h')[5].click();
    steps('lvl-pull-v')[3].click();
  });
  await wait(300);
  await shot('02-niveaux');

  // Accueil : Parc, 20 min.
  await page.goto(BASE);
  await wait(300);
  const selects = await page.$$('select');
  await selects[0].select('park');
  await selects[1].select('20');
  await wait(200);
  await shot('03-accueil');

  await click('Démarrer la séance');
  await page.waitForFunction(() => document.body.innerText.includes('Ton genou'));
  await click('3');
  await shot('04-genou');
  await click('Voir la séance');
  await page.waitForFunction(() => document.body.innerText.includes('Ta séance'));
  await wait(200);
  await shot('05-apercu', true);

  // Remplacement du 3e exercice (pompes) par la première option proposée.
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.innerText.includes('Remplacer'))[2].click());
  await wait(150);
  await shot('06-remplacer', true);
  await page.evaluate(() => document.querySelector('.swap__option')?.click());
  await wait(200);

  await click('C’est parti');
  await page.waitForFunction(() => location.hash === '#/seance');

  const seen = new Set();
  let n = 0;
  while (n++ < 300) {
    await wait(120);
    if ((await page.evaluate(() => location.hash)) === '#/bravo') break;
    const t = await text();

    // Reprise : au 6e passage, on « ferme » l'appli (rechargement) puis on reprend depuis l'accueil.
    if (n === 6) {
      await page.goto(BASE);
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForFunction(() => document.body.innerText.includes('Reprendre'));
      await shot('09-reprise');
      await click('Reprendre');
      continue;
    }

    if (t.includes('Passer le repos')) {
      if (!seen.has('rest')) (seen.add('rest'), await shot('08-repos'));
      await click('Passer le repos');
    } else if (t.includes('Valider la série')) {
      const timed = t.includes('Lancer le minuteur');
      if (timed && !seen.has('timed')) (seen.add('timed'), await shot('10-serie-duree'));
      if (!timed && !seen.has('work')) (seen.add('work'), await shot('07-serie'));
      await click('Valider la série');
    } else if (t.includes('Suivant')) {
      await click('Suivant');
    } else if (t.includes('Passer ce bloc')) {
      await click('Passer ce bloc');
    } else {
      await wait(300);
    }
  }

  await page.waitForFunction(() => document.body.innerText.includes('Bien joué'), { timeout: 5000 });
  await shot('12-bilan', true);
  console.log(`Parcours terminé en ${n} actions. Captures dans ${OUT}/`);
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  console.error(`Erreurs JavaScript :\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('Aucune erreur JavaScript.');
