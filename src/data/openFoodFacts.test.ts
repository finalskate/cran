/**
 * Tests de la lecture des fiches Open Food Facts (réponses fictives, sans réseau).
 */
import { describe, expect, it } from 'vitest';
import { isValidBarcode, lookupBarcode, parseOffProduct, parseOffSearch, searchOffByName } from './openFoodFacts';

const NOW = '2026-11-14T16:00:00.000Z';

describe('isValidBarcode', () => {
  it('accepte un EAN-13 et un EAN-8 valides', () => {
    expect(isValidBarcode('3017620422003')).toBe(true);
    expect(isValidBarcode('96385074')).toBe(true);
  });

  it('refuse un chiffre de contrôle faux ou une longueur impossible', () => {
    expect(isValidBarcode('3017620422004')).toBe(false);
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('30176204220a3')).toBe(false);
  });
});

describe('parseOffProduct', () => {
  it('lit les valeurs pour 100 g et propose portion, ½ paquet, paquet et 100 g', () => {
    const parsed = parseOffProduct(
      '3017620422003',
      {
        status: 1,
        product: {
          product_name_fr: 'Biscuits au chocolat',
          brands: 'Marque A, Marque B',
          nutriments: { 'energy-kcal_100g': 482.4, proteins_100g: 6.33 },
          serving_size: '2 biscuits (25 g)',
          serving_quantity: 25,
          product_quantity: '200',
        },
      },
      NOW,
    );
    expect(parsed?.incomplete).toBe(false);
    const f = parsed!.food;
    expect(f.id).toBe('ean:3017620422003');
    expect(f.brand).toBe('Marque A');
    expect(f.per100).toEqual({ kcal: 482, protein: 6.3 });
    expect(f.portions.map((p) => p.label)).toEqual([
      '1 portion (2 biscuits (25 g))',
      '½ paquet (100 g)',
      '1 paquet (200 g)',
      '100 g',
    ]);
  });

  it('convertit les kJ quand les kcal manquent, et repère les boissons en ml', () => {
    const parsed = parseOffProduct(
      '96385074',
      { status: 1, product: { product_name: 'Jus', quantity: '1 L', nutriments: { energy_100g: 180, proteins_100g: 0.5 } } },
      NOW,
    );
    expect(parsed!.food.per100?.kcal).toBe(43);
    expect(parsed!.food.unit).toBe('ml');
    expect(parsed!.food.portions.map((p) => p.label)).toEqual(['100 ml']);
  });

  it('signale une fiche sans valeurs nutritionnelles', () => {
    const parsed = parseOffProduct('96385074', { status: 1, product: { product_name: 'Mystère' } }, NOW);
    expect(parsed?.incomplete).toBe(true);
    expect(parsed?.food.per100).toBeUndefined();
  });

  it('ne garde pas « ½ paquet » quand le paquet est une seule portion', () => {
    const parsed = parseOffProduct(
      '96385074',
      { status: 1, product: { product_name: 'Barre', serving_quantity: 40, product_quantity: 40, nutriments: { 'energy-kcal_100g': 400, proteins_100g: 20 } } },
      NOW,
    );
    expect(parsed!.food.portions.map((p) => p.amount)).toEqual([40, 100]);
  });

  it('renvoie null pour un produit inconnu', () => {
    expect(parseOffProduct('96385074', { status: 0 }, NOW)).toBeNull();
  });
});

describe('lookupBarcode', () => {
  const fakeFetch = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('trouve un produit', async () => {
    const r = await lookupBarcode('96385074', NOW, fakeFetch(200, { status: 1, product: { product_name: 'Skyr', nutriments: { 'energy-kcal_100g': 60, proteins_100g: 10 } } }));
    expect(r.status).toBe('found');
  });

  it('distingue produit inconnu et réseau absent', async () => {
    expect((await lookupBarcode('96385074', NOW, fakeFetch(404, { status: 0 }))).status).toBe('not-found');
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await lookupBarcode('96385074', NOW, failing)).status).toBe('offline');
  });
});

describe('recherche par nom', () => {
  const product = (code: string, name: string, kcal?: number) => ({
    code,
    product_name: name,
    brands: 'Marque',
    nutriments: kcal === undefined ? {} : { 'energy-kcal_100g': kcal, proteins_100g: 10 },
  });

  it('garde les produits avec énergie, sans doublon ni code invalide', () => {
    const parsed = parseOffSearch(
      {
        products: [
          product('3000000000001', 'Wrap poulet', 230),
          product('3000000000001', 'Wrap poulet (doublon)', 230),
          product('3000000000002', 'Sans valeurs'),
          product('abc', 'Code invalide', 100),
        ],
      },
      NOW,
    );
    expect(parsed.map((p) => p.food.name)).toEqual(['Wrap poulet']);
    expect(parsed[0]!.food).toMatchObject({ id: 'ean:3000000000001', source: 'off', per100: { kcal: 230, protein: 10 } });
  });

  it('tolère une réponse inattendue', () => {
    expect(parseOffSearch(null, NOW)).toEqual([]);
    expect(parseOffSearch({ products: 'non' }, NOW)).toEqual([]);
  });

  it('envoie seulement les mots tapés, et lit les résultats', async () => {
    let url = '';
    const fake = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ products: [product('3000000000001', 'Wrap poulet', 230)] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await searchOffByName(' wrap poulet ', NOW, fake);
    expect(r.status === 'found' && r.products).toHaveLength(1);
    expect(new URL(url).searchParams.get('search_terms')).toBe('wrap poulet');
  });

  it('distingue serveur saturé (page HTML, 503) et absence de réseau', async () => {
    const html = (async () => new Response('<html>indisponible</html>', { status: 200 })) as unknown as typeof fetch;
    const unavailable = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    const down = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect((await searchOffByName('wrap', NOW, html)).status).toBe('busy');
    expect((await searchOffByName('wrap', NOW, unavailable)).status).toBe('busy');
    expect((await searchOffByName('wrap', NOW, down)).status).toBe('offline');
  });
});
