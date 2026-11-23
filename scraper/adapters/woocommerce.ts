// WooCommerce Store API pública: /wp-json/wc/store/v1/products
import { fetchJson } from '../lib/http.ts';
import { decodeEntities } from './util.ts';
import type { Adapter, RawOffer } from './types.ts';

type WProduct = {
  id: number;
  name: string;
  permalink: string;
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  prices?: { price?: string; currency_code?: string; currency_minor_unit?: number; price_range?: { min_amount: string } | null };
  images?: { src: string; thumbnail?: string }[];
  categories?: { name: string }[];
  tags?: { name: string }[];
  stock_availability?: { text?: string; class?: string };
};

export const woocommerce: Adapter = async (store, log) => {
  const base = store.url.replace(/\/$/, '');
  const cats = store.collections?.length ? store.collections : [store.collection ?? null];
  const seen = new Set<number>();
  const out: RawOffer[] = [];
  for (const cat of cats) {
    const maxPages = store.maxPages ?? 50;
    for (let page = 1; page <= maxPages; page++) {
      const q = `per_page=100&page=${page}${cat ? `&category=${encodeURIComponent(cat)}` : ''}`;
      const items = await fetchJson<WProduct[]>(`${base}/wp-json/wc/store/v1/products?${q}`);
      if (!Array.isArray(items) || !items.length) break;
      for (const p of items) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const minor = p.prices?.currency_minor_unit ?? 2;
        const raw = p.prices?.price ?? p.prices?.price_range?.min_amount;
        const price = raw != null && raw !== '' ? Number(raw) / 10 ** minor : null;
        const stockText = `${p.stock_availability?.class ?? ''} ${p.stock_availability?.text ?? ''}`;
        out.push({
          externalId: String(p.id),
          title: decodeEntities(p.name),
          meta: [...(p.categories ?? []).map((c) => decodeEntities(c.name)), ...(p.tags ?? []).map((t) => decodeEntities(t.name))].join(' '),
          url: p.permalink,
          image: p.images?.[0]?.thumbnail ?? p.images?.[0]?.src ?? null,
          price: price && price > 0 ? price : null,
          currency: p.prices?.currency_code ?? store.currency ?? 'EUR',
          available: /out-of-stock|agotado/i.test(stockText) ? false : (p.is_in_stock ?? null),
        });
      }
      if (items.length < 100) break;
    }
  }
  log(`${out.length} productos leídos`);
  return out;
};
