// Recursos visuales:
//  · logos de colección (TCGdex, en español e inglés) optimizados a WebP para publicarlos con la web
//  · arte de colección (foto oficial del sobre en TCGplayer, útil sobre todo para sets japoneses sin logo)
//  · imágenes oficiales de referencia por colección y gama (TCGplayer)
//  · huella visual (dHash + color medio) de cada foto de tienda, para elegir la foto que mejor
//    representa a cada producto y descartar las que no encajan
import type { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';
import { nowIso, openDb, tx } from './lib/db.ts';
import { fetchJson, pool, USER_AGENT } from './lib/http.ts';
import { norm } from './lib/text.ts';
import { TYPE_RULES } from './classify/taxonomy.ts';

const TCGCSV = 'https://tcgcsv.com/tcgplayer';
const RETRY_MISSING_DAYS = 30;

// ── Descarga con límite por servidor ────────────────────────────────────────
const active = new Map<string, number>();
const waiters = new Map<string, (() => void)[]>();
const CDN = /(^|\.)(cdn\.shopify\.com|tcgplayer-cdn\.tcgplayer\.com|cdn\.crystalcommerce\.com|assets\.tcgdex\.net)$/;
const perHost = (host: string) => (host === 'cdn.shopify.com' ? 6 : CDN.test(host) ? 8 : 4);

async function withHost<T>(url: string, fn: () => Promise<T>): Promise<T> {
  const host = new URL(url).host;
  while ((active.get(host) ?? 0) >= perHost(host)) await new Promise<void>((r) => (waiters.get(host) ?? waiters.set(host, []).get(host)!).push(r));
  active.set(host, (active.get(host) ?? 0) + 1);
  try {
    return await fn();
  } finally {
    active.set(host, active.get(host)! - 1);
    waiters.get(host)?.shift()?.();
  }
}

/** Imagen descargada; `transient` = fallo pasajero (saturación, red): no se anota y se reintenta otro día. */
export async function fetchImage(url: string, maxBytes = 8_000_000): Promise<{ buf: Buffer | null; transient: boolean }> {
  return withHost(url, async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { 'user-agent': USER_AGENT, accept: 'image/avif,image/webp,image/png,image/jpeg,*/*' },
          signal: AbortSignal.timeout(25_000),
        });
        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) return { buf: null, transient: false };
        const buf = Buffer.from(await res.arrayBuffer());
        return { buf: buf.length > maxBytes ? null : buf, transient: false };
      } catch {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    return { buf: null, transient: true };
  });
}

export async function download(url: string, maxBytes = 8_000_000): Promise<Buffer | null> {
  return (await fetchImage(url, maxBytes)).buf;
}

/** Miniatura pequeña cuando el CDN lo permite (Shopify, TCGplayer): menos datos que descargar. */
function smallVariant(url: string): string {
  try {
    const u = new URL(url);
    if (u.host === 'cdn.shopify.com' || u.pathname.includes('/cdn/shop/')) {
      u.searchParams.set('width', '160');
      return u.toString();
    }
  } catch {
    /* URL rara: se usa tal cual */
  }
  return url.replace(/_(\d+)w\.jpg$/, '_200w.jpg');
}

// ── Huella visual ───────────────────────────────────────────────────────────
/** dHash de 64 bits (estructura) + color medio (3 bytes), tras recortar bordes uniformes. */
export async function visualHash(buf: Buffer): Promise<string | null> {
  try {
    let base = await sharp(buf, { failOn: 'none', animated: false }).flatten({ background: '#ffffff' }).png().toBuffer();
    try {
      base = await sharp(base).trim({ threshold: 18 }).png().toBuffer();
    } catch {
      /* imagen uniforme: sin recorte */
    }
    const gray = await sharp(base).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
    let hi = 0;
    let lo = 0;
    for (let i = 0; i < 64; i++) {
      const y = Math.floor(i / 8);
      const x = i % 8;
      const bit = gray[y * 9 + x] > gray[y * 9 + x + 1] ? 1 : 0;
      if (i < 32) hi = (hi * 2 + bit) >>> 0;
      else lo = (lo * 2 + bit) >>> 0;
    }
    const { dominant } = await sharp(base).stats();
    const hex = (n: number, w: number) => n.toString(16).padStart(w, '0');
    return hex(hi, 8) + hex(lo, 8) + hex(dominant.r, 2) + hex(dominant.g, 2) + hex(dominant.b, 2);
  } catch {
    return null;
  }
}

async function toWebp(buf: Buffer, width: number, height: number): Promise<Buffer | null> {
  try {
    return await sharp(buf, { failOn: 'none' }).resize(width, height, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

// ── Colecciones: logos, arte y referencias ──────────────────────────────────
type Col = { id: string; line: string; logo: string | null; tcg_group: number | null };

function typeOf(name: string): string | null {
  const n = norm(name);
  for (const [t, re] of TYPE_RULES) if (re.test(n)) return t;
  return null;
}

export async function syncCollectionAssets(db: DatabaseSync, log = console.log) {
  const now = nowIso();
  const retryCut = new Date(Date.now() - RETRY_MISSING_DAYS * 864e5).toISOString();
  const have = new Map(
    (db.prepare('SELECT key, data IS NOT NULL AS ok, checked FROM assets').all() as { key: string; ok: number; checked: string }[]).map((r) => [r.key, r]),
  );
  const need = (k: string) => {
    const a = have.get(k);
    return !a || (!a.ok && a.checked < retryCut);
  };
  const putAsset = db.prepare(
    'INSERT INTO assets (key, source, data, checked) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET source=excluded.source, data=excluded.data, checked=excluded.checked',
  );
  const putRef = db.prepare(
    'INSERT INTO refs (collection_id, product_type, name, image, hash) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET image=excluded.image, hash=excluded.hash',
  );
  const cols = db.prepare('SELECT id, line, logo, tcg_group FROM collections').all() as Col[];

  // Logos (sólo sets internacionales: TCGdex no tiene logos japoneses)
  const logoJobs: { key: string; src: string }[] = [];
  for (const c of cols) {
    if (c.line !== 'intl' || !c.logo) continue;
    if (need(`logo:${c.id}:en`)) logoJobs.push({ key: `logo:${c.id}:en`, src: c.logo });
    if (need(`logo:${c.id}:es`)) logoJobs.push({ key: `logo:${c.id}:es`, src: c.logo.replace('assets.tcgdex.net/en/', 'assets.tcgdex.net/es/') });
  }
  let logos = 0;
  await pool(logoJobs, 6, async (j) => {
    const buf = await download(j.src, 12_000_000);
    const webp = buf ? await toWebp(buf, 480, 180) : null;
    putAsset.run(j.key, j.src, webp, now);
    if (webp) logos++;
  });

  // Productos oficiales de TCGplayer: referencias por gama + arte (foto del sobre)
  const refJobs = cols.filter((c) => c.tcg_group && (c.line === 'jp' || c.line === 'intl') && need(`refs:${c.id}`));
  let refs = 0;
  let arts = 0;
  await pool(refJobs, 4, async (c) => {
    const cat = c.line === 'jp' ? 85 : 3;
    let products: { name: string; imageUrl: string; extendedData?: { name: string }[] }[] = [];
    try {
      products = (await fetchJson<{ results: typeof products }>(`${TCGCSV}/${cat}/${c.tcg_group}/products`)).results ?? [];
    } catch {
      putAsset.run(`refs:${c.id}`, null, null, now);
      return;
    }
    const sealed = products.filter((p) => p.imageUrl && !p.extendedData?.some((e) => e.name === 'Number'));
    let artSrc: string | null = null;
    for (const p of sealed) {
      const t = typeOf(p.name);
      if (!t || t === 'other') continue;
      const buf = await download(p.imageUrl);
      putRef.run(c.id, t, p.name, p.imageUrl.replace(/_200w\.jpg$/, '_400w.jpg'), buf ? await visualHash(buf) : null);
      refs++;
      if (t === 'booster_pack' && !artSrc) artSrc = p.imageUrl;
    }
    artSrc ??= sealed.find((p) => typeOf(p.name) === 'booster_box')?.imageUrl ?? null;
    if (artSrc && need(`art:${c.id}`)) {
      const buf = await download(artSrc.replace(/_200w\.jpg$/, '_400w.jpg'));
      const webp = buf ? await toWebp(buf, 360, 360) : null;
      putAsset.run(`art:${c.id}`, artSrc, webp, now);
      if (webp) arts++;
    }
    putAsset.run(`refs:${c.id}`, `${TCGCSV}/${cat}/${c.tcg_group}`, Buffer.from('ok'), now);
  });
  log(`Recursos de colección: ${logos} logos, ${arts} imágenes de sobre, ${refs} referencias oficiales nuevas`);
}

// ── Huellas de las fotos de tienda ──────────────────────────────────────────
export async function hashOfferImages(db: DatabaseSync, log = console.log, limit = Number(process.env.POKEPRICE_IMG_LIMIT ?? 25000)) {
  const retryCut = new Date(Date.now() - RETRY_MISSING_DAYS * 864e5).toISOString();
  const urls = (
    db
      .prepare(
        `SELECT DISTINCT o.image AS url FROM offers o LEFT JOIN image_hash h ON h.url = o.image
         WHERE o.active = 1 AND o.image IS NOT NULL AND o.image NOT LIKE 'data:%'
           AND (h.url IS NULL OR (h.hash IS NULL AND h.checked < ?))
         LIMIT ?`,
      )
      .all(retryCut, limit) as { url: string }[]
  ).map((r) => r.url);
  if (!urls.length) return log('Huellas de imagen: nada nuevo');
  const put = db.prepare('INSERT INTO image_hash (url, hash, checked) VALUES (?, ?, ?) ON CONFLICT(url) DO UPDATE SET hash=excluded.hash, checked=excluded.checked');
  const now = nowIso();
  let ok = 0;
  const results: [string, string | null][] = [];
  const started = Date.now();
  await pool(urls, 24, async (url, i) => {
    const { buf, transient } = await fetchImage(smallVariant(url));
    if (transient) return; // se reintenta en la próxima pasada
    const h = buf ? await visualHash(buf) : null;
    results.push([url, h]);
    if (h) ok++;
    if (results.length >= 500) tx(db, () => results.splice(0).forEach(([u, hh]) => put.run(u, hh, now)));
    if (i > 0 && i % 2000 === 0) log(`  huellas: ${i}/${urls.length}`);
  });
  tx(db, () => results.splice(0).forEach(([u, hh]) => put.run(u, hh, now)));
  log(`Huellas de imagen: ${ok}/${urls.length} nuevas en ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

if (import.meta.main) {
  const db = openDb();
  await syncCollectionAssets(db);
  await hashOfferImages(db);
}
