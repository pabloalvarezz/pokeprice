// Exporta la base de datos a JSON estático para la web (web/public/data).
import type { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDb, ROOT, today } from './lib/db.ts';
import { LANG_LABEL, LANGS, PRODUCT_TYPES } from './classify/taxonomy.ts';

const OUT = resolve(ROOT, 'web', 'public', 'data');

export function exportData(db: DatabaseSync, log = console.log) {
  mkdirSync(OUT, { recursive: true });
  const t = today();
  const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

  const collections = (db.prepare('SELECT * FROM collections ORDER BY release_date DESC').all() as any[]).map((c) => ({
    id: c.id,
    line: c.line,
    code: c.code,
    series: c.series,
    names: Object.fromEntries(Object.entries({ en: c.name_en, es: c.name_es, ja: c.name_ja, ko: c.name_ko, zh: c.name_zh }).filter(([, v]) => v)),
    date: c.release_date,
    logo: c.logo,
    symbol: c.symbol,
    isNew: c.first_seen >= daysAgo(14) && c.first_seen !== FIRST_RUN(db) ? true : (c.release_date ?? '') >= daysAgo(45),
    upcoming: (c.release_date ?? '') > t,
  }));

  const stores = (db.prepare('SELECT * FROM stores ORDER BY name').all() as any[]).map((s) => ({
    id: s.id,
    name: s.name,
    url: s.url,
    country: s.country,
    currency: s.currency,
    platform: s.platform,
    languages: JSON.parse(s.languages ?? '[]'),
    shipping: s.shipping_note,
    enabled: !!s.enabled,
    status: s.last_status,
    lastRun: s.last_run,
    count: s.last_count ?? 0,
  }));

  const history = new Map<string, [string, number | null, number][]>();
  for (const h of db.prepare('SELECT offer_id, date, price_eur, available FROM price_history ORDER BY date').all() as any[]) {
    let arr = history.get(h.offer_id);
    if (!arr) history.set(h.offer_id, (arr = []));
    arr.push([h.date, h.price_eur, h.available]);
  }

  const offers = (
    db
      .prepare(`SELECT o.* FROM offers o JOIN stores s ON s.id = o.store_id
                WHERE o.active = 1 AND s.enabled = 1 AND o.language IN (${LANGS.map(() => '?').join(',')}) AND o.price_eur IS NOT NULL`)
      .all(...LANGS) as any[]
  ).map((o) => {
    const h = history.get(o.id) ?? [];
    // precio anterior distinto al actual → variación
    let prev: number | null = null;
    let changedOn: string | null = null;
    for (let i = h.length - 1; i > 0; i--) {
      if (h[i - 1][1] != null && h[i - 1][1] !== h[i][1]) {
        prev = h[i - 1][1];
        changedOn = h[i][0];
        break;
      }
    }
    return {
      id: o.id,
      s: o.store_id,
      t: o.title,
      u: o.url,
      i: o.image,
      p: o.price_eur,
      op: o.currency !== 'EUR' ? o.price : undefined,
      c: o.currency !== 'EUR' ? o.currency : undefined,
      a: o.available ? 1 : 0,
      col: o.collection_id,
      ty: o.product_type,
      l: o.language,
      v: o.variant_key || undefined,
      fs: o.first_seen,
      pp: prev ?? undefined,
      pd: changedOn ?? undefined,
      h: h.length > 1 ? h.map(([d, p, a]) => [d, p, a]) : undefined,
    };
  });

  const lastRun = db.prepare("SELECT finished FROM runs WHERE kind IN ('update','scrape') ORDER BY id DESC LIMIT 1").get() as { finished: string } | undefined;
  const catalog = {
    generatedAt: new Date().toISOString(),
    lastUpdate: lastRun?.finished ?? null,
    languages: LANGS.map((id) => ({ id, label: LANG_LABEL[id] })),
    productTypes: PRODUCT_TYPES.map(({ id, label, short }) => ({ id, label, short })),
    collections,
    stores,
  };

  writeFileSync(resolve(OUT, 'catalog.json'), JSON.stringify(catalog));
  writeFileSync(resolve(OUT, 'offers.json'), JSON.stringify(offers));
  log(`Exportado: ${collections.length} colecciones, ${stores.length} tiendas, ${offers.length} ofertas`);
}

let firstRunCache: string | undefined;
function FIRST_RUN(db: DatabaseSync): string {
  if (firstRunCache === undefined) {
    firstRunCache = (db.prepare('SELECT MIN(first_seen) d FROM collections').get() as { d: string }).d ?? '';
  }
  return firstRunCache;
}

if (import.meta.main) exportData(openDb());
