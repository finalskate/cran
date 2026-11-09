/**
 * Test de bout en bout (fumée) dans un vrai Chrome, en taille téléphone.
 *
 * Parcours : niveaux (fiche, choix) → accueil (Parc, 20 min) → score genou 3 → aperçu (fiche,
 * un remplacement) → séance complète (menu « ⋯ », chrono d'exercice), avec « fermeture » de
 * l'appli et reprise en cours de route → bilan (ressenti) → export depuis Réglages.
 * Puis alimentation : profil, assiette estimée, scan (code tapé, Open Food Facts simulé), produit
 * inconnu recopié depuis l’étiquette, modification d’une entrée, pesée depuis l’accueil.
 * Puis carnet (J2) et corps (J3) : historique de pesées espacées injecté, objectif, courbes,
 * tour de taille, photos prises avec la caméra simulée de Chrome (retardateur, calque).
 * Puis J3b : priorité « haut du corps » (bloc Bras dans l'aperçu), idées de protéines, tours de
 * bras et de poitrine proposés après les photos, mode miroir.
 * Puis J4B : bilan du jour depuis l'Assiette (écart, déclencheur, plan rappelé), résumé de la
 * semaine, « Mes plans ».
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
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
  // Caméra simulée (mire animée) et autorisation accordée d'office : pour les photos de progression.
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
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
      if (!seen.has('rest')) {
        seen.add('rest');
        // « Ensuite » : consignes de l'exercice suivant et sa fiche, sans quitter le repos.
        if (!t.includes('Fiche complète')) throw new Error('repos : aperçu de l’exercice suivant incomplet');
        await shot('08-repos', true);
      }
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

  await page.waitForFunction(() => document.body.textContent.includes('Séance terminée'), { timeout: 5000 });
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
  // J3 : le panneau montre la tendance, puis propose le tour de taille (première fois).
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Ta tendance'), { timeout: 5000 });
  await shot('30b-pesee-notee');
  await clickIn('Noter');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 5000 });
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

  // ─── Course, vélo, vélotaf, semaine (J5a) ───
  await page.goto(BASE);
  await wait(300);
  const content = () => page.evaluate(() => document.body.textContent);
  if (!(await content()).includes('Prochaine sortie')) throw new Error('accueil : carte « Prochaine sortie » absente');
  await shot('80-accueil-semaine', true);
  await click('Noter une course');
  await wait(200);
  await fill('#run-km', '5,2');
  await page.click('dialog[open] .score-grid button:nth-child(2)'); // genou après : 1
  await wait(100);
  await shot('81-course');
  await clickIn('Noter');
  await wait(300);
  if (!(await content()).includes('Course notée aujourd’hui')) throw new Error('course non notée');
  await click('Vélotaf');
  await wait(200);
  await shot('82-velotaf');
  await clickIn('Aller et retour');
  await wait(300);
  await click('Course · vélo');
  await clickIn('Vélo');
  await clickIn('Fractionné');
  await wait(100);
  await shot('83-velo');
  await clickIn('Noter');
  await wait(300);
  const marks = await page.evaluate(() => ({
    cardio: document.querySelectorAll('.week-card .cal__mark--cardio').length,
    commute: document.querySelectorAll('.week-card .cal__dash').length,
  }));
  if (marks.cardio !== 1 || marks.commute !== 1) throw new Error(`semaine de l’accueil : ${JSON.stringify(marks)}`);
  await shot('84-accueil-apres-course', true);
  await page.evaluate(() => document.querySelector('.week-card').click());
  await page.waitForFunction(() => document.body.textContent.includes('Ce que j’ai fait'));
  await wait(300);
  if (!/course \d+ min/.test(await content())) throw new Error('carnet : minutes de course absentes de la semaine');
  await shot('85-carnet-semaine', true);
  await page.evaluate(() => document.querySelector('.week-strip__day--today').click());
  await wait(300);
  await shot('86-jour-cardio', true);
  await page.click('dialog[open] [aria-label="Fermer"]');
  await wait(200);
  await page.goto(`${BASE}#/reglages`);
  await wait(300);
  if (!(await content()).includes('Objectif de la semaine')) throw new Error('réglages : objectif de la semaine absent');
  await shot('87-reglages-objectif', true);
  await page.goto(`${BASE}#/carnet`);
  await wait(300);

  // Test de placement : compteur vide (« Valider » impossible), puis 30 répétitions au niveau
  // actuel des pompes → écran « Trop facile » → on teste le niveau au-dessus, dans la fourchette.
  await click('Niveaux');
  await wait(300);
  await page.evaluate(() => document.getElementById('lvl-push-h').closest('section').querySelector('.level-test').click());
  await wait(300);
  await shot('45a-placement-vide');
  for (let i = 0; i < 30; i++) await page.click('dialog[open] [aria-label="Plus"]');
  await shot('45-placement');
  await clickIn('Valider');
  await wait(200);
  await shot('46-placement-suite');
  await clickIn('Tester ce niveau');
  await wait(200);
  await page.click('dialog[open] [aria-label="Plus"]');
  await clickIn('Valider');
  await wait(200);
  await shot('47-placement-resultat');
  // On adopte le niveau trouvé (le panneau se ferme) ; sinon on ferme simplement.
  if ((await page.evaluate(() => document.querySelector('dialog[open]')?.innerText ?? '')).includes('Choisir le niveau')) {
    await clickIn('Choisir le niveau');
  } else {
    await page.click('dialog[open] [aria-label="Fermer"]');
  }
  await wait(300);

  // ─── Corps (J3) ───
  /** Ouvre la base de l'appli directement (données injectées pour simuler des semaines d'usage). */
  const withDb = (fn) =>
    page.evaluate(async (src) => {
      const idb = await new Promise((ok, ko) => {
        const r = indexedDB.open('cran');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
      const pad = (n) => String(n).padStart(2, '0');
      const day = (offset) => {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      await new Function('idb', 'day', `return (${src})(idb, day)`)(idb, day);
      idb.close();
    }, fn.toString());

  // Historique espacé : pesées tous les 3 jours il y a 75 à 36 jours, puis 3 semaines sans pesée
  // (éloignement), puis celles du test d'ajustement ; tours de taille hebdomadaires au début.
  await withDb(async (idb, day) => {
    const tx = idb.transaction(['weights', 'measures'], 'readwrite');
    for (let i = -75, k = 0; i <= -36; i += 3, k++) {
      // Petites variations (eau, sel) autour d'une perte d'environ 0,3 kg par semaine.
      const noise = [0.4, -0.3, 0.1][k % 3];
      tx.objectStore('weights').put({ day: day(i), at: new Date().toISOString(), kg: Math.round((83 - k * 0.13 + noise) * 10) / 10 });
    }
    for (let i = -70, k = 0; i <= -35; i += 7, k++) {
      tx.objectStore('measures').put({ id: `waist:${day(i)}`, kind: 'waist', day: day(i), at: new Date().toISOString(), value: 92 - k * 0.5 });
    }
    // Un niveau plus bas choisi il y a 30 jours : l'escalier a deux marches.
    const lvl = idb.transaction('levelHistory', 'readwrite');
    lvl.objectStore('levelHistory').add({ movementId: 'push-h', level: 3, at: new Date(Date.now() - 30 * 86_400_000).toISOString() });
    await new Promise((ok) => (lvl.oncomplete = ok));
  });

  // Courbe en escalier sous l'échelle des pompes.
  await page.goto(`${BASE}#/niveaux`);
  await page.reload();
  await page.waitForSelector('.chart--step', { timeout: 5000 });
  await page.evaluate(() => document.querySelector('.chart--step').scrollIntoView({ block: 'center' }));
  await wait(200);
  await shot('48-niveaux-escalier');

  // Objectifs de poids saisis dans le profil.
  // Profil ouvert depuis l'appli déjà chargée (le formulaire se remplit à l'ouverture de l'écran).
  await page.goto(`${BASE}#/profil`);
  await page.waitForSelector('#pr-goal1');
  await fill('#pr-goal1', '78');
  await fill('#pr-goal2', '75');
  // J3b : priorité haut du corps (protéines 1,8 g/kg dans le calcul).
  await click('Haut du corps');
  await wait(200);
  if (!(await text()).includes('1,8 g/kg')) throw new Error('protéines de la priorité haut du corps absentes du calcul');
  await shot('49-profil-priorite', true);
  await click('Enregistrer');
  await wait(300);

  await page.goto(`${BASE}#/corps`);
  await page.waitForFunction(() => document.body.textContent.includes('Tendance'), { timeout: 5000 });
  await wait(300);
  await shot('50-corps', true);
  const t50 = await text();
  if (!t50.includes('kg / sem.')) throw new Error('rythme de la tendance absent');
  if (!t50.includes('À ce rythme, 78,0 kg')) throw new Error('projection vers l’objectif absente');
  if (!(await page.$('.chart__line--gap'))) throw new Error('interruption de la courbe (trou de 3 semaines) non dessinée');
  // Toucher la courbe : légende du point le plus proche.
  const box = await (await page.$('.chart svg')).boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height / 2);
  await wait(200);
  if (!(await text()).includes('· tendance')) throw new Error('le toucher de la courbe n’affiche pas la valeur');
  await shot('50b-corps-toucher');
  await click('Tout');
  await wait(200);
  await shot('51-corps-tout', true);

  await page.goto(BASE);
  await wait(300);
  await shot('52-accueil-poids', true);

  // Photos : caméra simulée de Chrome, retardateur 3 s, face puis profil.
  await page.goto(`${BASE}#/photos`);
  await wait(300);
  await shot('53-photos-vide');
  await click('Photos de');
  await page.waitForFunction(() => document.body.innerText.includes('Lancer le retardateur'), { timeout: 8000 });
  await wait(500);
  await shot('54-capture');
  await click('Retardateur 3 s');
  await click('Lancer le retardateur');
  await wait(1200);
  await shot('54b-capture-decompte');
  await page.waitForFunction(() => document.body.innerText.includes('Garder'), { timeout: 8000 });
  await shot('55-capture-revue');
  await click('Garder, puis profil');
  await page.waitForFunction(() => document.body.innerText.includes('De profil'), { timeout: 5000 });
  await click('Lancer le retardateur');
  await page.waitForFunction(() => document.body.innerText.includes('Garder'), { timeout: 15000 });
  await click('Garder');
  await page.waitForFunction(() => !document.querySelector('.capture'), { timeout: 5000 });
  // J3b : les tours de bras et de poitrine sont proposés juste après les photos du mois.
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('Tour de bras'), { timeout: 5000 });
  await wait(300);
  await shot('55b-mesures-du-mois');
  await clickIn('Noter');
  await wait(300);
  await shot('56-photos-un-mois', true);

  // Une série du mois précédent (copie des images) pour voir la comparaison.
  await withDb(async (idb, day) => {
    const rows = await new Promise((ok) => {
      const r = idb.transaction('photos').objectStore('photos').getAll();
      r.onsuccess = () => ok(r.result);
    });
    const tx = idb.transaction('photos', 'readwrite');
    for (const { id, ...row } of rows) tx.objectStore('photos').add({ ...row, day: day(-35), month: day(-35).slice(0, 7) });
    await new Promise((ok) => (tx.oncomplete = ok));
  });
  await page.reload();
  await page.waitForSelector('.compare__item');
  await wait(300);
  await shot('57-photos-comparaison', true);
  await page.click('.photo--hidden');
  await wait(200);
  await shot('58-photo-devoilee');
  // Le calque : la photo précédente de face, en transparence.
  await click('Reprendre les photos');
  await page.waitForFunction(() => !!document.querySelector('.capture__ghost'), { timeout: 8000 });
  await wait(400);
  await shot('54c-capture-calque');
  // Mode miroir : caméra arrière, déclenchement au toucher, calque repris faute de photo « miroir ».
  await click('Miroir');
  await page.waitForFunction(() => document.body.innerText.includes('Prendre la photo'), { timeout: 8000 });
  await wait(400);
  await shot('54d-capture-miroir');
  await page.click('.capture [aria-label="Fermer"]');
  await wait(200);

  // Carnet › Corps : bras et poitrine notés.
  await page.goto(`${BASE}#/corps`);
  await page.waitForFunction(() => document.body.textContent.includes('Bras (contracté)'), { timeout: 5000 });
  await page.evaluate(() => document.getElementById('muscle-title').scrollIntoView({ block: 'center' }));
  await wait(200);
  await shot('56b-corps-bras-poitrine');

  // Idées de protéines depuis l'Assiette, puis une idée choisie (feuille de portion pré-remplie).
  await page.goto(`${BASE}#/assiette`);
  await wait(300);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /idées/i.test(b.innerText))?.click());
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('Thon au naturel'), { timeout: 8000 });
  await wait(300);
  await shot('61-idees-proteines');
  await clickIn('Œufs durs');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('2 œufs (100 g)'), { timeout: 5000 });
  await wait(200);
  await shot('62-idee-portion');
  await page.click('dialog[open] [aria-label="Fermer"]');
  await wait(200);

  // J4B : bilan du jour depuis l'Assiette (protéines déduites des entrées), écart « soirée » :
  // le plan correspondant s'affiche au moment du choix du déclencheur.
  await click('Bilan du jour');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('Un écart ?'), { timeout: 5000 });
  if (!(await page.evaluate(() => document.querySelector('dialog[open]').textContent.includes('D’après ce que tu as noté'))))
    throw new Error('protéines du bilan non déduites des entrées');
  await clickIn('Oui');
  await clickIn('Petit');
  await clickIn('Soirée');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('le dîner est fini'), { timeout: 3000 });
  await wait(200);
  await shot('64-bilan');
  await clickIn('Noter le bilan');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('Bilan noté'), { timeout: 3000 });
  await wait(200);
  await shot('65-bilan-note');
  await clickIn('Fermer');
  await wait(300);
  const t65 = await page.evaluate(() => document.body.textContent);
  if (!t65.includes('Bilan fait ✓') || !t65.includes('soirée (1)')) throw new Error('bilan absent de l’Assiette ou du résumé de la semaine');
  await shot('66-assiette-semaine', true);
  await click('Mes plans');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.textContent.includes('Ajouter un plan'), { timeout: 3000 });
  await wait(200);
  await shot('67-mes-plans');
  await page.click('dialog[open] [aria-label="Fermer"]');
  await wait(200);

  // Aperçu à la maison, 30 min, priorité haut du corps : un bloc « Bras » après les principaux.
  await page.goto(BASE);
  await wait(300);
  const homeSelects = await page.$$('select');
  await homeSelects[0].select('home');
  await homeSelects[1].select('30');
  await wait(200);
  // Une séance est déjà faite aujourd'hui : l'accueil propose « Une 2e séance quand même ».
  await click('2e séance');
  await page.waitForFunction(() => document.body.innerText.includes('Ton genou'));
  await click('2');
  await click('Voir la séance');
  await page.waitForFunction(() => document.body.innerText.includes('Ta séance'));
  await wait(300);
  if (!(await page.evaluate(() => document.body.textContent.includes('Curl aux sangles')))) throw new Error('bloc Bras absent de l’aperçu');
  await shot('63-apercu-haut-du-corps', true);

  // Élastiques (retouche du 08/11) : forces saisies dans Lieux, variante « curl à l'élastique »
  // retenue, puis en séance l'élastique se choisit sous les séries.
  await page.goto(`${BASE}#/lieux`);
  await wait(300);
  await page.type('input[placeholder="ex. 10, 20, 30"]', '30, 10, 20');
  await page.keyboard.press('Tab');
  await wait(300);
  if (!(await text()).includes('10 kg · 20 kg · 30 kg')) throw new Error('élastiques non enregistrés');
  await shot('68-lieux-elastiques', true);
  await withDb(async (idb) => {
    const tx = idb.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'variantChoice', value: { biceps: 'curl-band' } });
    await new Promise((ok) => (tx.oncomplete = ok));
  });
  await page.goto(`${BASE}#/niveaux`);
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(400);
  if (!(await text()).includes('Curl à l’élastique ou Curl aux sangles')) throw new Error('échelle : variante préférée non affichée en premier');
  await openStep('lvl-biceps', 0);
  await wait(300);
  await shot('69-fiche-elastique');
  await page.click('dialog[open] [aria-label="Fermer"]');
  await page.goto(BASE);
  await wait(300);
  await click('2e séance');
  await page.waitForFunction(() => document.body.innerText.includes('Ton genou'));
  await click('2');
  await click('Voir la séance');
  await page.waitForFunction(() => document.body.innerText.includes('Ta séance'));
  await click('C’est parti');
  await wait(300);
  // On passe les blocs jusqu'au curl.
  for (let i = 0; i < 24 && !(await page.evaluate(() => document.querySelector('.work__name')?.textContent.includes('Curl'))); i++) {
    if ((await text()).includes('Passer le repos')) {
      await click('Passer le repos');
      await wait(200);
      continue;
    }
    await page.click('[aria-label^="Plus d’options"]');
    await wait(150);
    await click('Passer le bloc');
    await wait(200);
  }
  if (!(await page.evaluate(() => !!document.querySelector('.band-picker')))) throw new Error('choix de l’élastique absent en séance');
  await shot('70-seance-elastique');

  // Mannequin animé (J8, prototype) : page de revue, puis la fiche d'une variante animée.
  await page.goto(`${BASE}#/mannequin`);
  await wait(600);
  const figures = await page.evaluate(() => document.querySelectorAll('svg.figure').length);
  if (figures < 4) throw new Error(`mannequin : ${figures} figures affichées`);
  await shot('71-mannequin');
  await page.goto(`${BASE}#/niveaux`);
  await wait(300);
  await openStep('lvl-push-v', 0);
  await wait(500);
  if (!(await page.evaluate(() => !!document.querySelector('dialog[open] svg.figure')))) throw new Error('fiche : animation absente');
  await shot('72-fiche-animee');
  await page.click('dialog[open] [aria-label="Fermer"]');

  await page.goto(`${BASE}#/carnet`);
  await wait(200);
  await click('Séances');
  await wait(300);
  await shot('59-seances-par-semaine');
  await page.goto(`${BASE}#/reglages`);
  await wait(300);
  if (!(await text()).includes('Inclure les photos')) throw new Error('option « Inclure les photos » absente de l’export');
  await shot('60-reglages-photos', true);

  // ─── Phases, mode cantine, saisie en une phrase (J5b) ─── (en dernier : le lieu passe à « Éloigné »)
  await click('Changer de phase');
  await clickIn('Éloigné');
  await shot('88-phase', true);
  await clickIn('Choisir');
  await wait(300);
  await page.goto(BASE);
  await wait(400);
  const home = await page.evaluate(() => document.body.textContent);
  for (const t of ['· Éloigné', 'mode cantine', 'vélo']) if (!home.includes(t)) throw new Error(`accueil en éloignement : « ${t} » absent`);
  if (home.includes('Noter une course')) throw new Error('accueil en éloignement : course proposée sans tapis de course');
  await shot('89-accueil-eloigne', true);
  await page.goto(`${BASE}#/assiette`);
  await wait(400);
  if (!(await page.evaluate(() => document.body.textContent.includes('Mode cantine')))) throw new Error('assiette : mode cantine absent');
  await shot('90-assiette-cantine', true);
  await click('Ajouter');
  await wait(200);
  await fill('#food-search', 'wrap poulet + petite frite + coca zéro');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Noter en une fois'), { timeout: 5000 });
  await shot('91-phrase-recherche');
  await clickIn('Noter en une fois');
  await page.waitForFunction(() => document.querySelector('dialog[open]')?.innerText.includes('Petite frite (80 g)'), { timeout: 5000 });
  await shot('92-phrase', true);
  await page.evaluate(() => document.querySelectorAll('dialog[open] .phrase-line .food-row')[1].click());
  await wait(200);
  await shot('92b-phrase-ligne', true);
  await clickIn('Ajouter les 3');
  await wait(400);
  if (!(await page.evaluate(() => document.body.textContent.includes('Cola, sans sucres ajoutés')))) throw new Error('phrase : entrées non notées');
  await shot('93-assiette-apres-phrase', true);
  // Changement programmé : Vacances demain (la date proposée par défaut).
  await page.goto(`${BASE}#/reglages`);
  await wait(300);
  await click('Changer de phase');
  await clickIn('Vacances');
  await clickIn('Plus tard');
  await shot('94a-phase-programmer', true);
  await clickIn('Programmer');
  await wait(300);
  if (!(await page.evaluate(() => document.body.textContent.includes('Puis Vacances le')))) throw new Error('réglages : changement programmé absent');
  await shot('94-reglages-phase', true);

  console.log(`Parcours terminé en ${n} actions. Captures dans ${OUT}/`);
} catch (e) {
  // Échec : les erreurs JavaScript vues jusque-là aident souvent à comprendre pourquoi.
  if (errors.length) console.error(`Erreurs JavaScript avant l’échec :\n${errors.join('\n')}`);
  throw e;
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  console.error(`Erreurs JavaScript :\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('Aucune erreur JavaScript.');
