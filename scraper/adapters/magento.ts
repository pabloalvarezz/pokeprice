// Magento 2: GraphQL público (/graphql). `collection` = id de categoría; si no, búsqueda "pokemon".
import { fetchJson } from '../lib/http.ts';
import { html } from './html.ts';
import type { Adapter, RawOffer } from './types.ts';

const QUERY = (filter: string, page: number) => `{
  products(${filter} pageSize: 100, currentPage: ${page}) {
    page_info { total_pages }
    items {
      sku name url_key url_suffix stock_status
      small_image { url }
      price_range { minimum_price { final_price { value currency } } }
    }
  }
}`;

export const magento: Adapter = async (store, log) => {
  const base = store.url.replace(/\/$/, '');
  if (store.collection && /^https?:/.test(store.collection)) return html(store, log);
  const filter = store.collection ? `filter: { category_id: { eq: "${store.collection}" } }` : 'search: "pokemon"';
  const out: RawOffer[] = [];
  for (let page = 1; page <= (store.maxPages ?? 40); page++) {
    const data = await fetchJson<any>(`${base}/graphql?query=${encodeURIComponent(QUERY(filter, page))}`, {
      headers: { 'content-type': 'application/json', store: 'default' },
    });
    const res = data?.data?.products;
    if (!res?.items?.length) break;
    for (const p of res.items) {
      const price = p.price_range?.minimum_price?.final_price;
      out.push({
        externalId: p.sku,
        title: p.name,
        url: `${base}/${p.url_key}${p.url_suffix ?? '.html'}`,
        image: p.small_image?.url ?? null,
        price: price?.value ?? null,
        currency: price?.currency ?? store.currency ?? 'EUR',
        available: p.stock_status ? p.stock_status === 'IN_STOCK' : null,
      });
    }
    if (page >= (res.page_info?.total_pages ?? 1)) break;
  }
  log(`${out.length} productos leídos`);
  return out;
};
