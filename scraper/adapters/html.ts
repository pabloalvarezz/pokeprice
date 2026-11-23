// Tiendas sin API: lee el listado HTML con selectores CSS configurados por tienda,
// o, si no hay selectores, los datos estructurados schema.org (JSON-LD) de la página.
import * as cheerio from 'cheerio';
import { fetchText, HttpError } from '../lib/http.ts';
import { parsePrice } from '../lib/text.ts';
import { absUrl } from './util.ts';
import type { Adapter, RawOffer } from './types.ts';

function jsonLdProducts(html: string, base: string, currency: string): RawOffer[] {
  const $ = cheerio.load(html);
  const out: RawOffer[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const type = node['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
      const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      const price = offers?.price ?? offers?.lowPrice;
      out.push({
        externalId: String(node.sku ?? node.productID ?? node.url ?? node.name),
        title: String(node.name ?? ''),
        url: absUrl(node.url ?? offers?.url, base) ?? base,
        image: absUrl(Array.isArray(node.image) ? node.image[0] : typeof node.image === 'object' ? node.image?.url : node.image, base),
        price: parsePrice(price),
        currency: offers?.priceCurrency ?? currency,
        available: offers?.availability ? /InStock|PreOrder|LimitedAvailability/i.test(offers.availability) : null,
      });
    }
    if (node.itemListElement) visit(node.itemListElement.map((e: any) => e.item ?? e));
    if (node['@graph']) visit(node['@graph']);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).text()));
    } catch {
      /* JSON-LD roto: se ignora */
    }
  });
  return out.filter((o) => o.title);
}

// Marcado típico de plataformas conocidas, para tiendas sin selectores propios.
const KNOWN: { name: string; test: string; sel: NonNullable<import('./types.ts').StoreConfig['selectors']> }[] = [
  {
    name: 'woocommerce',
    test: 'li.product, .products .product.type-product',
    sel: {
      item: 'li.product, .products .product.type-product',
      title: '.woocommerce-loop-product__title, .product-title, h2, h3',
      price: '.price ins .amount, .price:not(:has(ins)) .amount, .price',
      link: 'a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link, a',
      soldOut: '.outofstock, .out-of-stock, .soldout',
      next: 'a.next.page-numbers, .woocommerce-pagination a.next',
    },
  },
  {
    name: 'bigcommerce',
    test: '.productGrid .card, .card .card-title',
    sel: {
      item: '.productGrid .product, li.product',
      title: '.card-title',
      price: '[data-product-price-without-tax], .price--withoutTax, .price--main, .price',
      link: '.card-title a, a',
      soldOut: '.card-figcaption-button[disabled], .out-of-stock',
      next: '.pagination-item--next a',
    },
  },
  {
    name: 'prestashop16',
    test: '.product_list .ajax_block_product',
    sel: {
      item: '.product_list .ajax_block_product',
      title: '.product-name',
      price: '.content_price .price, .price.product-price, .price',
      link: '.product-name, a.product_img_link',
      soldOut: '.out-of-stock, .label-danger',
      next: '#pagination_next a, .pagination_next a',
    },
  },
];

/** Imagen real aunque la tienda use carga diferida (src = marcador "data:" y la URL en otro atributo). */
function lazyImage($img: cheerio.Cheerio<any>): string | undefined {
  for (const a of ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-full-size-image-url', 'src']) {
    const v = $img.attr(a);
    if (v && !v.startsWith('data:')) return v;
  }
  for (const a of ['data-srcset', 'srcset', 'data-lazy-srcset']) {
    const v = $img.attr(a)?.split(',')[0]?.trim().split(/\s+/)[0];
    if (v && !v.startsWith('data:')) return v;
  }
  return undefined;
}

type Sel = NonNullable<import('./types.ts').StoreConfig['selectors']>;

/** Precio de venta: atributo si se indica; si no, el texto sin el precio tachado (del/s/old-price). */
function readPrice($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>, sel: Sel): number | null {
  const $p = $el.find(sel.price).first();
  if (sel.priceAttr) return parsePrice($p.attr(sel.priceAttr) ?? null);
  const clone = $p.clone();
  clone.find('del, s, strike, .old-price, .price-old, .regular-price, .was-price, .compare-at-price').remove();
  return parsePrice(clone.text().trim() || $p.text());
}

export const html: Adapter = async (store, log) => {
  const lists = store.collections?.length ? store.collections : [store.collection ?? store.url];
  const currency = store.currency ?? 'EUR';
  const out: RawOffer[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    let url: string | null = list!;
    const maxPages = store.maxPages ?? 30;
    for (let page = 1; url && page <= maxPages; page++) {
      let body: string;
      try {
        body = await fetchText(url);
      } catch (e) {
        if (page > 1 && e instanceof HttpError && e.status === 404) break; // no hay más páginas
        throw e;
      }
      let items: RawOffer[] = [];
      const $ = cheerio.load(body);
      const sel = store.selectors ?? KNOWN.find((k) => $(k.test).length > 0)?.sel;
      if (sel) {
        $(sel.item).each((_, el) => {
          const $el = $(el);
          const $title = $el.find(sel.title).first();
          const title = ((sel.titleAttr ? $title.attr(sel.titleAttr) : null) ?? $title.text()).trim();
          const href = $el.find(sel.link).first().attr('href') ?? $el.attr('href');
          if (!title) return;
          const $img = sel.image ? $el.find(sel.image).first() : $el.find('img').first();
          items.push({
            externalId: href ?? title,
            title,
            url: absUrl(href, url!) ?? url!,
            image: absUrl(lazyImage($img), url!),
            price: readPrice($, $el, sel),
            meta: sel.meta ? $el.find(sel.meta).map((_, m) => `${$(m).text()} ${$(m).attr('alt') ?? ''} ${$(m).attr('title') ?? ''}`).get().join(' ').trim() : undefined,
            currency,
            available: sel.soldOut ? $el.find(sel.soldOut).length === 0 : null,
          });
        });
      }
      if (!items.length) items = jsonLdProducts(body, url, currency);
      // La divisa configurada de la tienda manda (algunas declaran USD en JSON-LD pero muestran yenes)
      if (store.currency) for (const it of items) it.currency = store.currency;
      let fresh = 0;
      for (const it of items) {
        if (seen.has(it.externalId)) continue;
        seen.add(it.externalId);
        out.push(it);
        fresh++;
      }
      if (!fresh) break;
      if (store.pageParam) {
        const u = new URL(list!);
        u.searchParams.set(store.pageParam, String(page + 1));
        url = u.toString();
      } else {
        const next = sel?.next ? $(sel.next).first().attr('href') : $('a[rel=next], link[rel=next]').first().attr('href');
        url = next ? absUrl(next, url) : null;
      }
    }
  }
  log(`${out.length} productos leídos`);
  return out;
};
