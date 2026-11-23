// Lee todas las tiendas activas, clasifica sus productos y guarda precios + historial de cambios.
//   node scraper/scrape.ts                 → todas
//   node scraper/scrape.ts tienda-a tienda-b → sólo esas
import type { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb, nowIso, ROOT, today, tx } from './lib/db.ts';
import { pool } from './lib/http.ts';
import { fxTable, refreshFx, toEur } from './lib/fx.ts';
import { norm } from './lib/text.ts';
import { Classifier } from './classify/classifier.ts';
import { ensurePokemonNames } from './classify/pokemon-names.ts';
import { shopify } from './adapters/shopify.ts';
import { woocommerce } from './adapters/woocommerce.ts';
import { prestashop } from './adapters/prestashop.ts';
import { magento } from './adapters/magento.ts';
import { html } from './adapters/html.ts';
import type { Adapter, RawOffer, StoreConfig } from './adapters/types.ts';

const ADAPTERS: Record<string, Adapter> = { shopify, woocommerce, prestashop, magento, html, other: html };
const POKEMON_RE = /pokemon|ポケモン|포켓몬|宝可梦|寶可夢/;

export function loadStores(): StoreConfig[] {
  return JSON.parse(readFileSync(process.env.POKEPRICE_STORES ?? resolve(ROOT, 'scraper', 'stores.json'), 'utf8'));
}

function syncStoreRows(db: DatabaseSync, stores: StoreConfig[]) {
  const up = db.prepare(`
    INSERT INTO stores (id, name, url, country, currency, platform, collection, languages, shipping_note, notes, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, url=excluded.url, country=excluded.country, currency=excluded.currency,
      platform=excluded.platform, collection=excluded.collection, languages=excluded.languages,
      shipping_note=excluded.shipping_note, notes=excluded.notes, enabled=excluded.enabled`);
  tx(db, () => {
    for (const s of stores) {
      up.run(s.id, s.name, s.url, s.country, s.currency ?? 'EUR', s.platform, s.collections?.join(' | ') ?? s.collection ?? null,
        JSON.stringify(s.languages ?? []), s.shippingToSpain ?? null, s.notes ?? null, s.enabled === false ? 0 : 1);
    }
  });
}

type StoreResult = { id: string; status: string; read: number; kept: number; changes: number; excluded: Record<string, number> };

function saveOffers(db: DatabaseSync, store: StoreConfig, raw: RawOffer[], clf: Classifier, fx: Map<string, number>): StoreResult {
  const t = today();
  const now = nowIso();
  const excluded: Record<string, number> = {};
  const existing = new Map(
    (db.prepare('SELECT id, price, available, active, classified_by, collection_id, product_type, language FROM offers WHERE store_id = ?').all(store.id) as any[]).map((r) => [r.id, r]),
  );
  const upsert = db.prepare(`
    INSERT INTO offers (id, store_id, external_id, url, title, raw_meta, image, price, currency, price_eur, available,
                        collection_id, product_type, language, variant_key, first_seen, last_seen, last_change, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET url=excluded.url, title=excluded.title, raw_meta=excluded.raw_meta, image=COALESCE(excluded.image, image),
      price=excluded.price, currency=excluded.currency, price_eur=excluded.price_eur, available=excluded.available,
      collection_id = CASE WHEN classified_by='manual' THEN collection_id ELSE excluded.collection_id END,
      product_type  = CASE WHEN classified_by='manual' THEN product_type  ELSE excluded.product_type END,
      language      = CASE WHEN classified_by='manual' THEN language      ELSE excluded.language END,
      variant_key=excluded.variant_key, last_seen=excluded.last_seen,
      last_change=COALESCE(excluded.last_change, last_change), active=1`);
  const hist = db.prepare(`
    INSERT INTO price_history (offer_id, date, price, price_eur, available) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(offer_id, date) DO UPDATE SET price=excluded.price, price_eur=excluded.price_eur, available=excluded.available`);
  const deactivate = db.prepare('UPDATE offers SET active = 0, available = 0, last_change = ? WHERE id = ?');

  let kept = 0;
  let changes = 0;
  const seen = new Set<string>();
  const wholeCatalog = !store.collection && !store.collections?.length;
  tx(db, () => {
    for (const r of raw) {
      if (r.price == null || r.price <= 0) {
        excluded['sin precio'] = (excluded['sin precio'] ?? 0) + 1;
        continue;
      }
      const c = clf.classify({ title: r.title, variant: r.variant, meta: r.meta, storeLanguages: store.languages });
      const reason = c.excluded ?? (wholeCatalog && !c.collectionId && !POKEMON_RE.test(norm(`${r.title} ${r.meta ?? ''}`)) ? 'no es pokémon' : null);
      if (reason) {
        excluded[reason] = (excluded[reason] ?? 0) + 1;
        continue;
      }
      const id = `${store.id}:${r.externalId}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const priceEur = toEur(fx, r.price, r.currency);
      const prev = existing.get(id);
      const avail = r.available == null ? 1 : r.available ? 1 : 0;
      const changed = !prev || prev.price !== r.price || prev.available !== avail || !prev.active;
      const title = r.variant ? `${r.title} — ${r.variant}` : r.title;
      upsert.run(id, store.id, r.externalId, r.url, title, [r.variant, r.meta].filter(Boolean).join(' | ') || null, r.image ?? null,
        r.price, r.currency, priceEur, avail, c.collectionId, c.productType, c.language, c.variantKey, t, t, changed ? now : null);
      if (changed) {
        hist.run(id, t, r.price, priceEur, avail);
        if (prev) changes++;
      }
      kept++;
    }
    // Lo que ya no aparece en la tienda pasa a inactivo
    for (const [id, prev] of existing) {
      if (!seen.has(id) && prev.active) {
        deactivate.run(now, id);
        hist.run(id, t, prev.price, toEur(fx, prev.price, null), 0);
      }
    }
  });
  return { id: store.id, status: 'ok', read: raw.length, kept, changes, excluded };
}

export async function scrapeAll(db: DatabaseSync, only: string[] = [], log = console.log) {
  const stores = loadStores();
  syncStoreRows(db, stores);
  try {
    await refreshFx(db);
  } catch (e) {
    log(`Aviso: no se pudieron actualizar los tipos de cambio (${(e as Error).message}); uso los últimos guardados.`);
  }
  await ensurePokemonNames(log);
  const fx = fxTable(db);
  const clf = new Classifier(db);
  const targets = stores.filter((s) => (only.length ? only.includes(s.id) : s.enabled !== false));
  const setStatus = db.prepare('UPDATE stores SET last_run = ?, last_status = ?, last_count = ? WHERE id = ?');
  const setOk = db.prepare('UPDATE stores SET last_ok = ? WHERE id = ?');

  const results = await pool(targets, 6, async (store) => {
    const adapter = ADAPTERS[store.platform];
    const tag = `[${store.id}]`;
    if (!adapter) {
      setStatus.run(nowIso(), `sin adaptador (${store.platform})`, 0, store.id);
      return { id: store.id, status: 'sin adaptador', read: 0, kept: 0, changes: 0, excluded: {} } as StoreResult;
    }
    const started = Date.now();
    try {
      const raw = await adapter(store, (m) => log(`${tag} ${m}`));
      const res = saveOffers(db, store, raw, clf, fx);
      setStatus.run(nowIso(), 'ok', res.kept, store.id);
      setOk.run(nowIso(), store.id);
      log(`${tag} ✓ ${res.kept} productos sellados (${res.changes} cambios) en ${((Date.now() - started) / 1000).toFixed(0)} s`);
      return res;
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      db.prepare('UPDATE stores SET last_run = ?, last_status = ? WHERE id = ?').run(nowIso(), `error: ${msg}`, store.id);
      log(`${tag} ✗ ${msg}`);
      return { id: store.id, status: `error: ${msg}`, read: 0, kept: 0, changes: 0, excluded: {} } as StoreResult;
    }
  });

  writeUnmatchedReport(db);
  return results;
}

/** Títulos sin colección o con gama "otros": la lista de trabajo para mejorar los alias. */
function writeUnmatchedReport(db: DatabaseSync) {
  const rows = db
    .prepare(`SELECT store_id, language, product_type, title FROM offers WHERE active = 1 AND (collection_id IS NULL OR product_type = 'other') ORDER BY store_id, title`)
    .all() as { store_id: string; language: string; product_type: string; title: string }[];
  writeFileSync(resolve(ROOT, 'data', 'unmatched.txt'), rows.map((r) => `${r.store_id}\t${r.language}\t${r.product_type}\t${r.title}`).join('\n'));
}

if (import.meta.main) {
  const db = openDb();
  const only = process.argv.slice(2);
  const started = nowIso();
  const res = await scrapeAll(db, only);
  const ok = res.filter((r) => r.status === 'ok');
  db.prepare('INSERT INTO runs (kind, started, finished, stats) VALUES (?, ?, ?, ?)').run('scrape', started, nowIso(), JSON.stringify(res));
  console.log(`\n${ok.length}/${res.length} tiendas OK · ${ok.reduce((a, r) => a + r.kept, 0)} productos · ${ok.reduce((a, r) => a + r.changes, 0)} cambios de precio`);
}
