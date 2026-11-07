/**
 * Fabrique `src/data/ciqual.json` à partir de la table Ciqual de l'ANSES (composition
 * nutritionnelle des aliments, licence ouverte Etalab 2.0). On n'en garde que ce que l'appli
 * suit : nom, sous-groupe (pour les portions types), kcal et protéines pour 100 g.
 *
 * Le fichier produit est versionné : le build ne dépend pas du réseau. Ce script ne sert qu'à
 * passer à une nouvelle édition de la table.
 *
 * Usage :
 *   node scripts/build-ciqual.mjs            télécharge l'édition 2025 (≈ 70 Mo, quelques secondes)
 *   node scripts/build-ciqual.mjs <dossier>  relit des fichiers déjà téléchargés
 *                                            (alim_*.xml et compo_*.xml dans ce dossier)
 *
 * Source : https://doi.org/10.57745/RDMHWY (entrepôt Recherche Data Gouv, édition du 03/11/2025).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EDITION = '2025-11-03';
/** Identifiants des fichiers XML de l'édition 2025 dans l'entrepôt. */
const FILES = { alim: 666252, compo: 666249 };
const DOWNLOAD = (id) => `https://entrepot.recherche.data.gouv.fr/api/access/datafile/${id}`;

/** Constituants retenus (codes Ciqual), par ordre de préférence. */
const KCAL = ['328', '333']; // Énergie règlement UE 1169/2011, sinon N × Jones avec fibres
const PROTEIN = ['25000', '25003']; // Protéines N × facteur de Jones, sinon N × 6,25

/** Groupes écartés : aliments infantiles (11). */
const EXCLUDED_GROUPS = new Set(['11']);

async function load(kind) {
  const dir = process.argv[2];
  if (dir) {
    const file = readdirSync(dir).find((f) => f.startsWith(`${kind}_`) && f.endsWith('.xml'));
    if (!file) throw new Error(`Pas de fichier ${kind}_*.xml dans ${dir}`);
    return readFileSync(join(dir, file), 'utf8');
  }
  const res = await fetch(DOWNLOAD(FILES[kind]));
  if (!res.ok) throw new Error(`Téléchargement ${kind} : HTTP ${res.status}`);
  return res.text();
}

/** Contenu d'une balise simple dans un bloc XML (les valeurs sont entourées d'espaces). */
const tag = (block, name) => block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim();

/**
 * Teneur Ciqual → nombre. « 12,3 » → 12,3 ; « < 0,5 » et « traces » → 0 (négligeable pour
 * l'appli) ; « - » ou vide → absent.
 */
function value(text) {
  if (!text || text === '-') return undefined;
  if (text.startsWith('<') || /^traces$/i.test(text)) return 0;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** Remplace les entités XML usuelles (les noms en contiennent : « Bœuf », apostrophes…). */
const decode = (s) =>
  s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const [alimXml, compoXml] = await Promise.all([load('alim'), load('compo')]);

// Teneurs utiles : code aliment → code constituant → valeur.
const wanted = new Set([...KCAL, ...PROTEIN]);
const compo = new Map();
for (const [, block] of compoXml.matchAll(/<COMPO>([\s\S]*?)<\/COMPO>/g)) {
  const constCode = tag(block, 'const_code');
  if (!wanted.has(constCode)) continue;
  const alim = tag(block, 'alim_code');
  const v = value(tag(block, 'teneur'));
  if (v === undefined) continue;
  if (!compo.has(alim)) compo.set(alim, new Map());
  compo.get(alim).set(constCode, v);
}

const pick = (values, codes) => codes.map((c) => values?.get(c)).find((v) => v !== undefined);

const foods = [];
let skipped = 0;
for (const [, block] of alimXml.matchAll(/<ALIM>([\s\S]*?)<\/ALIM>/g)) {
  const code = tag(block, 'alim_code');
  const group = tag(block, 'alim_grp_code');
  if (EXCLUDED_GROUPS.has(group)) continue;
  const values = compo.get(code);
  const kcal = pick(values, KCAL);
  if (kcal === undefined) {
    skipped++;
    continue;
  }
  const protein = pick(values, PROTEIN) ?? 0;
  foods.push([Number(code), decode(tag(block, 'alim_nom_fr')), tag(block, 'alim_ssgrp_code'), Math.round(kcal), Math.round(protein * 10) / 10]);
}
foods.sort((a, b) => a[0] - b[0]);

const out = {
  edition: EDITION,
  source: 'Anses. Table de composition nutritionnelle des aliments Ciqual 2025. Licence ouverte Etalab 2.0.',
  // Une ligne par aliment : [code, nom, sous-groupe, kcal/100 g, protéines g/100 g].
  foods,
};
// Une ligne par aliment : le fichier reste lisible et les différences entre éditions aussi.
const json = `{\n  "edition": ${JSON.stringify(out.edition)},\n  "source": ${JSON.stringify(out.source)},\n  "foods": [\n${foods
  .map((f) => `    ${JSON.stringify(f)}`)
  .join(',\n')}\n  ]\n}\n`;
writeFileSync(new URL('../src/data/ciqual.json', import.meta.url), json);
console.log(`${foods.length} aliments écrits (${skipped} sans énergie écartés), ${Math.round(json.length / 1024)} Ko.`);
