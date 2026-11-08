/**
 * Planches de revue du mannequin (J8) : les positions clés et les consignes de toutes les
 * animations, en grille, par paquets de 12, dans `.e2e/figures/`. À lancer après `npm run build`
 * quand on ajoute ou retouche une animation :
 *
 *   node scripts/figures-sheet.mjs
 */
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const OUT = '.e2e/figures';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PER_SHEET = 12;

await mkdir(OUT, { recursive: true });
const server = await preview({ preview: { port: 4184 } });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('Erreur JavaScript :', e.message));
await page.goto('http://localhost:4184/cran/#/mannequin', { waitUntil: 'networkidle0' });
// Grille de 4 colonnes, sans l'animation en grand (seules les positions clés comptent ici).
await page.addStyleTag({
  content: `
  .screen { max-width: none !important; display: grid !important; grid-template-columns: repeat(4, 1fr); gap: 8px; padding: 8px !important; }
  .screen > header, .screen > p, .nav, .update-banner { display: none !important; }
  .card { padding: 6px !important; gap: 2px !important; }
  .card > svg.figure { display: none !important; }
  .card__title { font-size: 13px !important; }
  .figure-keys svg { height: 110px !important; }
`,
});
await new Promise((r) => setTimeout(r, 1500));
const cards = await page.$$('section.card');
for (let i = 0; i < cards.length; i += PER_SHEET) {
  const boxes = await Promise.all(cards.slice(i, i + PER_SHEET).map((c) => c.boundingBox()));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const y1 = Math.max(...boxes.map((b) => b.y + b.height));
  const name = `${OUT}/planche-${String(i / PER_SHEET + 1).padStart(2, '0')}.png`;
  await page.screenshot({ path: name, clip: { x: 0, y: y0, width: 1500, height: y1 - y0 }, captureBeyondViewport: true });
}
console.log(`${cards.length} animations, planches dans ${OUT}/`);
await browser.close();
server.httpServer.close();
