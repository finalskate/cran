/**
 * Recherche d'un produit par code-barres dans Open Food Facts (base ouverte, licence ODbL),
 * quand il y a du réseau (SPEC §4.8). Le produit trouvé est ensuite gardé dans la base locale :
 * le scanner suivant le reconnaît hors ligne.
 *
 * Seul le code-barres part sur le réseau (une requête publique, sans identifiant) ; rien de ce
 * que l'utilisateur mange ou pèse ne quitte le téléphone.
 */
import { formatAmount, type Food, type Nutrients, type Portion } from '../domain/nutrition';

const API = 'https://world.openfoodfacts.org/api/v2/product/';

/** Champs demandés : la réponse reste petite (quelques Ko). */
const FIELDS = [
  'product_name_fr',
  'product_name',
  'brands',
  'nutriments',
  'serving_size',
  'serving_quantity',
  'product_quantity',
  'product_quantity_unit',
  'quantity',
].join(',');

/** Identifiant local d'un produit à code-barres (partagé par Open Food Facts et la saisie manuelle). */
export function barcodeFoodId(code: string): string {
  return `ean:${code}`;
}

/**
 * Vérifie un code-barres EAN-8, UPC-A (12), EAN-13 ou GTIN-14 : longueur et chiffre de contrôle.
 * Évite d'interroger la base pour un code mal tapé.
 */
export function isValidBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // Poids 3 et 1 en alternance, en partant du chiffre le plus à droite (hors contrôle).
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Nombre positif lu dans un champ qui peut être un nombre, une chaîne (« 30 », « 30,5 ») ou absent. */
function num(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Énergie pour 100 g : en kcal si disponible, sinon convertie depuis les kJ. */
function kcalPer100(n: Record<string, unknown>): number | undefined {
  const kcal = num(n['energy-kcal_100g']);
  if (kcal !== undefined) return kcal;
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
  return kj !== undefined ? kj / 4.184 : undefined;
}

export interface ParsedProduct {
  food: Food;
  /** Vrai si l'énergie ou les protéines manquent : l'utilisateur doit compléter depuis l'étiquette. */
  incomplete: boolean;
}

/**
 * Transforme une réponse de l'API en aliment local. Renvoie `null` si le produit est inconnu.
 * Portions proposées : la portion indiquée par le fabricant, ½ paquet et le paquet (si le
 * poids est connu), et 100 g.
 */
export function parseOffProduct(code: string, response: unknown, now: string): ParsedProduct | null {
  const r = response as { status?: number; product?: Record<string, unknown> } | null;
  if (!r || r.status !== 1 || !r.product) return null;
  const p = r.product;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  const kcal = kcalPer100(n);
  const protein = num(n['proteins_100g']);
  const per100: Nutrients | undefined =
    kcal !== undefined ? { kcal: Math.round(kcal), protein: Math.round((protein ?? 0) * 10) / 10 } : undefined;

  const quantityText = typeof p.quantity === 'string' ? p.quantity : '';
  const unit: 'g' | 'ml' = p.product_quantity_unit === 'ml' || /\d\s*(ml|cl|l)\b/i.test(quantityText) ? 'ml' : 'g';

  const portions: Portion[] = [];
  const serving = num(p.serving_quantity);
  if (serving && serving > 0) {
    const label = typeof p.serving_size === 'string' && p.serving_size.trim() ? p.serving_size.trim() : `${formatAmount(serving)} ${unit}`;
    portions.push({ label: `1 portion (${label})`, amount: serving });
  }
  const pack = num(p.product_quantity);
  if (pack && pack > 0 && (!serving || pack > serving * 1.2)) {
    portions.push({ label: `½ paquet (${formatAmount(pack / 2)} ${unit})`, amount: pack / 2 });
    portions.push({ label: `1 paquet (${formatAmount(pack)} ${unit})`, amount: pack });
  }
  portions.push({ label: `100 ${unit}`, amount: 100 });

  const name = String(p.product_name_fr || p.product_name || '').trim() || `Produit ${code}`;
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0]!.trim() || undefined : undefined;

  return {
    food: {
      id: barcodeFoodId(code),
      source: 'off',
      name,
      ...(brand ? { brand } : {}),
      barcode: code,
      ...(per100 ? { per100 } : {}),
      unit,
      portions,
      uses: 0,
      createdAt: now,
    },
    incomplete: kcal === undefined || protein === undefined,
  };
}

export type LookupResult =
  | { status: 'found'; product: ParsedProduct }
  | { status: 'not-found' }
  | { status: 'offline' };

/**
 * Interroge Open Food Facts. Pas de réseau, délai dépassé ou serveur en panne : `offline`
 * (l'appli propose alors de saisir les valeurs de l'étiquette).
 */
export async function lookupBarcode(
  code: string,
  now: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<LookupResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${API}${code}.json?fields=${FIELDS}`, { signal: controller.signal });
    // 404 = produit inconnu de la base (l'API répond aussi status: 0 dans le corps).
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'offline' };
    const product = parseOffProduct(code, await res.json(), now);
    return product ? { status: 'found', product } : { status: 'not-found' };
  } catch {
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
