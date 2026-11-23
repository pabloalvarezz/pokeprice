// Shopify expone /products.json (y /collections/<handle>/products.json) sin autenticación.
import { fetchJson } from '../lib/http.ts';
import type { Adapter, RawOffer } from './types.ts';

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
  const base = store.url.replace(/\/$/, '');
  const handles = store.collections?.length ? store.collections : [store.collection ?? null];
  const seen = new Set<string>();
  const out: RawOffer[] = [];
  for (const handle of handles) {
    const path = handle ? `/collections/${handle}/products.json` : '/products.json';
    const maxPages = store.maxPages ?? 60;
    for (let page = 1; page <= maxPages; page++) {
      const data = await fetchJson<{ products: SProduct[] }>(`${base}${path}?limit=250&page=${page}`);
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
            currency: store.currency ?? 'EUR',
            available: v.available ?? null,
          });
        }
      }
      if (products.length < 250) break;
    }
  }
  log(`${out.length} variantes leídas`);
  return out;
};
