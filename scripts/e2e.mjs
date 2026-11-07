/**
 * Test de bout en bout (fumée) dans un vrai Chrome, en taille téléphone.
 *
 * Parcours : niveaux (fiche, choix) → accueil (Parc, 20 min) → score genou 3 → aperçu (fiche,
 * un remplacement) → séance complète (menu « ⋯ », chrono d'exercice), avec « fermeture » de
 * l'appli et reprise en cours de route → bilan (ressenti) → export depuis Réglages.
 * Puis alimentation : profil, assiette estimée, scan (code tapé, Open Food Facts simulé), produit
 * inconnu recopié depuis l’étiquette, modification d’une entrée, pesée depuis l’accueil.
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
  // Le 404 simulé d'Open Food Facts (produit inconnu) est attendu : Chrome le journalise quand même.
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location()?.url?.includes('openfoodfacts.org')) errors.push(`console: ${m.text()}`);
  });
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
  // Toucher un niveau ouvre sa fiche ; « Choisir ce niveau » le sélectionne.
  await page.goto(`${BASE}#/niveaux`);
  await wait(300);
  const openStep = (id, i) =>
    page.evaluate((id, i) => document.getElementById(id).closest('section').querySelectorAll('.ladder__step')[i].click(), id, i);
  await openStep('lvl-push-h', 5);
  await wait(300);
  await shot('02a-fiche-niveau');
  await click('Choisir ce niveau');
  await openStep('lvl-pull-v', 3);
  await wait(200);
  await click('Choisir ce niveau');
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

  // Fiche d'un exercice depuis l'aperçu, puis fermeture.
  await page.evaluate(() => document.querySelectorAll('.plan-item__fiche')[2].click());
  await wait(300);
  await shot('05b-fiche-apercu');
  await page.click('dialog[open] [aria-label="Fermer"]');
  await wait(200);

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
    } else if (t.includes('Démarrer le chrono')) {
      // Exercice en durée : la première fois, chrono complet (mise en place, effort, arrêt) ;
      // ensuite « Noter sans chrono » pour aller vite.
      if (!seen.has('timed')) {
        seen.add('timed');
        await shot('10a-chrono-pret');
        await click('Démarrer le chrono');
        await wait(2000);
        await shot('10b-chrono-mise-en-place');
        await wait(5000);
        await shot('10c-chrono-effort');
        await click('J’arrête');
        await shot('10d-chrono-tenu');
      } else {
        await click('Noter sans chrono');
      }
      await click('Valider la série');
    } else if (t.includes('Valider la série')) {
      if (!seen.has('work')) {
        seen.add('work');
        await shot('07-serie');
        // Menu « ⋯ » : capture, puis fermeture.
        await page.click('[aria-label^="Plus d"]');
        await wait(300);
        await shot('07b-menu');
        await page.click('dialog[open] [aria-label="Fermer"]');
        await wait(200);
      } else if (!seen.has('work2')) {
        // Deuxième série : les cases montrent la série faite.
        seen.add('work2');
        await shot('07c-serie-suivante');
      }
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
  await click('Bien dosée');
  await shot('12-bilan', true);
  await click('Terminer');

  // Export : sans partage de fichiers (navigateur de test), l'appli se rabat sur le téléchargement.
  await page.goto(`${BASE}#/reglages`);
  await wait(300);
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: undefined }));
  await click('Exporter mes données');
  await page.waitForFunction(() => document.body.innerText.includes('Dernier export'), { timeout: 5000 });
  await shot('13-reglages-export', true);

  // Séance déjà faite aujourd'hui : l'accueil conseille la récupération, la 2e séance reste
  // possible (sans les mouvements des 48 h) et l'aperçu rappelle le ressenti de la précédente.
  await page.goto(BASE);
  await wait(300);
  await shot('14a-accueil-seance-faite', true);
  await click('2e séance');
  await page.waitForFunction(() => document.body.innerText.includes('Ton genou'));
  await click('Voir la séance');
  await page.waitForFunction(() => document.body.innerText.includes('Séance jugée'), { timeout: 5000 });
  if (!(await text()).includes('2e séance du jour')) throw new Error('aperçu : la 2e séance du jour n’est pas signalée');
  await shot('14-apercu-rappel', true);

  // ─── Alimentation (J4 phase A) ───
  // Open Food Facts est simulé : un produit connu, un code inconnu (404). Aucune requête réelle.
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (!req.url().includes('openfoodfacts.org')) return req.continue();
    // Recherche par nom : deux produits de marque fictifs.
    if (req.url().includes('cgi/search.pl')) {
      const product = (code, name, kcal) => ({
        code,
        product_name: name,
        brands: 'Enseigne test',
        nutriments: { 'energy-kcal_100g': kcal, proteins_100g: 12 },
        serving_quantity: 190,
      });
      return req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ products: [product('3000000000017', 'Wrap poulet bacon (test)', 235), product('3000000000024', 'Wrap poulet curry (test)', 210)] }),
      });
    }
    if (req.url().includes('3017620422003')) {
      return req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          status: 1,
          product: {
            product_name_fr: 'Pâte à tartiner (test)',
            brands: 'Marque test',
            nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3 },
            serving_size: '15 g',
            serving_quantity: 15,
            product_quantity: 400,
          },
        }),
      });
    }
    return req.respond({ status: 404, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"status":0}' });
  });

  /** Clique un bouton du panneau ouvert (le fond, inerte, a parfois un bouton du même nom). */
  async function clickIn(t) {
    const ok = await page.evaluate((t) => {
      const el = [...document.querySelectorAll('dialog[open] button')].find((b) => b.innerText.includes(t) && !b.disabled);
      el?.click();
      return !!el;
    }, t);
    if (!ok) throw new Error(`bouton du panneau introuvable : ${t}`);
    await wait(200);
  }
  /** Remplit un champ (déclenche onInput comme une vraie saisie). */
  const fill = async (sel, value) => {
    await page.click(sel, { clickCount: 3 });
    await page.type(sel, value);
  };

  await page.goto(`${BASE}#/assiette`);
  await wait(300);
  await shot('20-assiette-vierge');
  await click('Calcule ta cible');
  await page.waitForFunction(() => document.body.innerText.includes('Ta cible'));
  await fill('#pr-year', '1990');
  await fill('#pr-height', '180');
  await fill('#pr-weight', '80');
  await wait(200);
  await shot('21-profil', true);
  await click('Commencer la calibration');
  await page.waitForFunction(() => document.body.innerText.includes('Calibration'));

  // Assiette de cantine estimée à la main : une paume de plus, un dessert.
  await click('Ajouter');
  await clickIn('Estimer une assiette');
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('dialog[open] .hand-row')];
    rows[0].querySelector('[aria-label="Plus"]').click();
    rows.find((r) => r.innerText.includes('Dessert')).querySelector('[aria-label="Plus"]').click();
  });
  await wait(200);
  await shot('22-estimer-assiette');
  await clickIn('Ajouter');

  // Scan (pas de caméra dans le navigateur de test) : code tapé, produit trouvé en ligne.
  await click('Scanner');
  await wait(300);
  await shot('23-scanner');
  await fill('#scan-code', '3017620422003');
  await clickIn('Chercher');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Pâte à tartiner'), { timeout: 5000 });
  await clickIn('½ paquet');
  await shot('24-portion');
  await clickIn('Ajouter');

  // Code inconnu : saisie depuis l'étiquette, puis la portion.
  await click('Scanner');
  await fill('#scan-code', '96385074');
  await clickIn('Chercher');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Recopier'), { timeout: 5000 });
  await fill('#pf-name', 'Chips (test)');
  await fill('#pf-kcal', '530');
  await fill('#pf-prot', '6,5');
  await fill('#pf-pack', '150');
  await wait(200);
  await shot('25-etiquette');
  await clickIn('Enregistrer le produit');
  await clickIn('1 paquet');
  await clickIn('Collation');
  await clickIn('Ajouter');

  // Le produit est désormais dans « Ajouter » (favori ou récent), sans réseau.
  await click('Ajouter');
  await wait(300);
  await shot('26-ajouter-liste');

  // Recherche par nom : aliments génériques (Ciqual, hors ligne), puis en ligne (simulé).
  await fill('#food-search', 'wrap poulet');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Wrap poulet crudités'), { timeout: 5000 });
  await shot('26b-recherche-ciqual');
  await clickIn('en ligne');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Wrap poulet bacon (test)'), { timeout: 5000 });
  await shot('26c-recherche-en-ligne', true);
  await clickIn('Wrap poulet crudités');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('1 wrap'), { timeout: 5000 });
  await shot('26d-portion-ciqual');
  await clickIn('Midi');
  await clickIn('Ajouter');

  // Introuvable : créer l'aliment, valeurs par pièce (site d'une enseigne).
  await click('Ajouter');
  await fill('#food-search', 'menu test');
  await wait(300);
  await clickIn('Créer');
  await clickIn('Pour une pièce');
  await fill('#pf-kcal', '850');
  await fill('#pf-prot', '30');
  await fill('#pf-piece', '1 menu');
  await wait(200);
  await shot('26e-creer-aliment');
  await clickIn('Créer');
  await clickIn('Midi');
  await clickIn('Ajouter');
  await wait(200);
  await shot('27-assiette-jour', true);

  // Modifier une entrée.
  await page.evaluate(() => document.querySelector('.food-row').click());
  await wait(300);
  await shot('28-entree');
  await clickIn('Enregistrer');

  // Accueil : carte Alimentation et pesée.
  await page.goto(BASE);
  await wait(400);
  await shot('29-accueil-alimentation', true);
  await click('Se peser');
  await wait(300);
  await shot('30-pesee');
  await clickIn('Noter');
  await page.waitForFunction(() => document.body.innerText.includes('80,0 kg'), { timeout: 5000 });
  await shot('31-accueil-pese');

  // Ajustement adaptatif : 15 jours fictifs de notes et de pesées écrits directement dans la base,
  // la veille très peu notée (journée partielle), puis rechargement.
  await page.evaluate(async () => {
    const pad = (n) => String(n).padStart(2, '0');
    const day = (offset) => {
      const d = new Date(Date.now() - 4 * 3600_000);
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const idb = await new Promise((ok, ko) => {
      const r = indexedDB.open('cran');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const tx = idb.transaction(['settings', 'foodLog', 'weights'], 'readwrite');
    tx.objectStore('settings').put({ key: 'calibrationStart', value: day(-15) });
    for (let i = -14; i <= -1; i++) {
      const kcal = i === -1 ? 500 : 2000;
      tx.objectStore('foodLog').add({
        day: day(i), at: new Date().toISOString(), meal: 'noon', label: 'Repas (test)', portion: '1 portion', count: 1,
        unit: { kcal, protein: 100 }, method: 'free',
      });
    }
    [[-14, 80.6], [-10, 80.5], [-6, 80.3], [-2, 80.1]].forEach(([i, kg]) =>
      tx.objectStore('weights').put({ day: day(i), at: new Date().toISOString(), kg }),
    );
    await new Promise((ok) => (tx.oncomplete = ok));
    idb.close();
  });
  await page.goto(`${BASE}#/assiette`);
  await page.reload();
  await page.waitForFunction(() => document.body.textContent.includes('Ta dépense réelle'), { timeout: 5000 });
  await shot('32-ajustement', true);
  await click('Adopter');
  await page.waitForFunction(() => !document.body.textContent.includes('Ta dépense réelle'), { timeout: 5000 });
  await page.click('[aria-label="Jour précédent"]');
  await wait(300);
  await shot('33-veille-mise-de-cote');
  await click('La compter');
  await wait(200);
  if (!(await text()).includes('Compte pour le calcul')) throw new Error('journée non comptée après « La compter »');

  // ─── Carnet (J2) ───
  // Séance imposée d'hier, jambes sollicitées : le moteur ménagera les jambes.
  await page.goto(BASE);
  await wait(300);
  await click('Imposée');
  await clickIn('Hier');
  await clickIn('Circuit');
  await clickIn('Dure');
  await wait(200);
  await shot('40-imposee');
  await clickIn('Noter');
  await wait(300);
  if ((await text()).includes('Ton genou ce matin')) {
    await shot('41-genou-du-matin');
    await click('Pareil');
  }

  await page.click('a[href="#/carnet"]');
  await page.waitForFunction(() => document.body.innerText.includes('Carnet'));
  await wait(300);
  await shot('42-carnet-calendrier', true);
  await page.evaluate(() => document.querySelector('.cal__day--today').click());
  await wait(300);
  await shot('43-carnet-jour', true);
  await page.click('dialog[open] [aria-label="Fermer"]');
  await wait(200);
  await click('Séances');
  await wait(300);
  await shot('44-carnet-seances', true);

  // Test de placement : 30 répétitions au niveau actuel des pompes → on monte d'un niveau.
  await click('Niveaux');
  await wait(300);
  await page.evaluate(() => document.getElementById('lvl-push-h').closest('section').querySelector('.level-test').click());
  await wait(300);
  for (let i = 0; i < 30; i++) await page.click('dialog[open] [aria-label="Plus"]');
  await shot('45-placement');
  await clickIn('Valider');
  await wait(200);
  await shot('46-placement-suite');
  await clickIn('Valider');
  await wait(200);
  await shot('47-placement-resultat');
  await page.click('dialog[open] [aria-label="Fermer"]');

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
