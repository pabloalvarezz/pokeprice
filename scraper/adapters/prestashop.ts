// PrestaShop 1.7/8: los listados de categoría devuelven JSON si se piden como AJAX.
// Si la tienda no lo permite, se lee el HTML (article.product-miniature).
import * as cheerio from 'cheerio';
import { fetchText, HttpError } from '../lib/http.ts';
import { parsePrice } from '../lib/text.ts';
import { absUrl, decodeEntities } from './util.ts';
import type { Adapter, RawOffer } from './types.ts';

type PProduct = {
  id_product: string | number;
  id_product_attribute?: string | number;
  name: string;
  url?: string;
  link?: string;
  price_amount?: number;
  price?: string;
  availability?: string;
  quantity?: number;
  add_to_cart_url?: string | null;
  cover?: { bySize?: Record<string, { url: string }>; large?: { url: string }; medium?: { url: string } } | null;
  category_name?: string;
};

function withParams(url: string, params: Record<string, string | number>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
}

export const prestashop: Adapter = async (store, log) => {
  const lists = store.collections?.length ? store.collections : [store.collection ?? store.url];
  const out: RawOffer[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    const maxPages = store.maxPages ?? 40;
    for (let page = 1; page <= maxPages; page++) {
      // page = PrestaShop 1.7/8 · p = PrestaShop 1.6. La primera página va sin parámetros (algunas tiendas dan 404 con extras).
      const url = page > 1 ? withParams(list!, { page, p: page }) : list!;
      let text: string;
      try {
        text = await fetchText(url, {
          headers: { accept: 'application/json, text/javascript, */*; q=0.01', 'x-requested-with': 'XMLHttpRequest' },
        });
      } catch (e) {
        if (page > 1 && e instanceof HttpError && e.status === 404) break; // no hay más páginas
        throw e;
      }
      let products: RawOffer[] = [];
      let pages = 1;
      if (text.trimStart().startsWith('{')) {
        const data = JSON.parse(text) as { products?: PProduct[]; pagination?: { pages_count?: number } };
        pages = data.pagination?.pages_count ?? 1;
        products = (data.products ?? []).map((p) => {
          const cover = p.cover?.bySize?.home_default?.url ?? p.cover?.medium?.url ?? p.cover?.large?.url ?? null;
          const avail = p.availability ? !/unavailable|out_of_stock/.test(p.availability) : p.add_to_cart_url ? true : (p.quantity ?? 0) > 0;
          return {
            externalId: `${p.id_product}-${p.id_product_attribute ?? 0}`,
            title: decodeEntities(p.name),
            meta: p.category_name ?? '',
            url: p.url ?? p.link ?? list!,
            image: cover,
            price: p.price_amount ?? parsePrice(p.price ?? null),
            currency: store.currency ?? 'EUR',
            available: avail,
          };
        });
      } else {
        const $ = cheerio.load(text);
        $('.product-miniature, article[data-id-product], .product_list .ajax_block_product').each((_, el) => {
          const $el = $(el);
          const a = $el.find('.product-title a, a.product-name, .product-name a, h2 a, h3 a').first();
          const title = a.text().trim() || $el.find('img').attr('alt') || '';
          const id = $el.attr('data-id-product') ?? a.attr('href') ?? title;
          if (!title) return;
          const priceText = $el.find('[itemprop=price]').attr('content') ?? $el.find('.content_price .price, .price, .product-price').first().text();
          const soldOut = $el.find('.out-of-stock, .product-unavailable, .product-flag.out_of_stock').length > 0 || /agotado|sin stock|out of stock/i.test($el.text());
          products.push({
            externalId: String(id),
            title: title.trim(),
            url: absUrl(a.attr('href'), list!) ?? list!,
            image: absUrl($el.find('img').first().attr('data-full-size-image-url') ?? $el.find('img').first().attr('data-src') ?? $el.find('img').first().attr('src'), list!),
            price: parsePrice(priceText),
            currency: store.currency ?? 'EUR',
            available: !soldOut,
          });
        });
        const pageNums = $('.pagination a, .page-list a').map((_, a) => Number($(a).text().trim())).get().filter(Number.isFinite);
        pages = pageNums.length ? Math.max(...pageNums) : 1;
      }
      let fresh = 0;
      for (const p of products) {
        if (seen.has(p.externalId)) continue;
        seen.add(p.externalId);
        out.push(p);
        fresh++;
      }
      if (!fresh || page >= pages) break;
    }
  }
  log(`${out.length} productos leídos`);
  return out;
};
