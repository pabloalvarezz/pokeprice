// Shopify expone /products.json (y /collections/<handle>/products.json) sin autenticación.
import { fetchJson, fetchPage } from '../lib/http.ts';
import type { Adapter, RawOffer } from './types.ts';

// Shopify Markets cambia precio y moneda según el país del visitante (IP). Pedimos siempre el
// mercado español, que es lo que paga un comprador en España, y leemos la moneda real de /cart.js.
const SPAIN = { cookie: 'localization=ES; cart_currency=EUR' };

async function spanishMarket(base: string, fallback: string): Promise<{ origin: string; currency: string }> {
  try {
    let page = await fetchPage(`${base}/cart.js`, { headers: { ...SPAIN, accept: 'application/json' } });
    const origin = new URL(page.url).origin;
    // si hubo redirección a otro dominio, la cookie pudo perderse: repetimos en el dominio final
    if (origin !== new URL(base).origin) page = await fetchPage(`${origin}/cart.js`, { headers: { ...SPAIN, accept: 'application/json' } });
    const currency = (JSON.parse(page.text) as { currency?: string }).currency;
    return { origin, currency: currency || fallback };
  } catch {
    return { origin: base, currency: fallback };
  }
}

type SProduct = {
  id: number;
  title: string;
  handle: string;
  product_type?: string;
  tags?: string[] | string;
  images?: { src: string }[];
  variants: { id: number; title: string; price: string; available?: boolean; featured_image?: { src: string } | null }[];
};

export const shopify: Adapter = async (store, log) => {
  const market = await spanishMarket(store.url.replace(/\/$/, ''), store.currency ?? 'EUR');
  const base = market.origin;
  const handles = store.collections?.length ? store.collections : [store.collection ?? null];
  const seen = new Set<string>();
  const out: RawOffer[] = [];
  for (const handle of handles) {
    const path = handle ? `/collections/${handle}/products.json` : '/products.json';
    const maxPages = store.maxPages ?? 60;
    for (let page = 1; page <= maxPages; page++) {
      const data = await fetchJson<{ products: SProduct[] }>(`${base}${path}?limit=250&page=${page}`, { headers: SPAIN });
      const products = data.products ?? [];
      if (!products.length) break;
      for (const p of products) {
        const tags = Array.isArray(p.tags) ? p.tags.join(' ') : (p.tags ?? '');
        const multi = p.variants.length > 1;
        for (const v of p.variants) {
          const id = String(v.id);
          if (seen.has(id)) continue;
          seen.add(id);
          out.push({
            externalId: id,
            title: p.title,
            variant: multi ? v.title : '',
            meta: `${p.product_type ?? ''} ${tags}`.trim(),
            url: `${base}/products/${p.handle}${multi ? `?variant=${v.id}` : ''}`,
            image: v.featured_image?.src ?? p.images?.[0]?.src ?? null,
            price: v.price != null ? Number(v.price) : null,
            currency: market.currency,
            available: v.available ?? null,
          });
        }
      }
      if (products.length < 250) break;
    }
  }
  log(`${out.length} variantes leídas (mercado ES, ${market.currency})`);
  return out;
};
