export type Lang = 'es' | 'en' | 'ja' | 'zh' | 'ko';

export type Collection = {
  id: string;
  line: 'intl' | 'jp' | 'cn';
  code: string | null;
  series: string | null;
  names: Partial<Record<Lang, string>>;
  date: string | null;
  /** logo en español (o inglés si no hay) */
  logo: string | null;
  /** logo en inglés (o español si no hay) */
  logoEn: string | null;
  /** foto oficial del sobre (sets japoneses, sobre todo) */
  art: string | null;
  symbol: string | null;
  isNew: boolean;
  upcoming: boolean;
};

export type Store = {
  id: string;
  name: string;
  url: string;
  country: string;
  currency: string;
  platform: string;
  languages: string[];
  shipping: string | null;
  enabled: boolean;
  status: string | null;
  lastRun: string | null;
  lastOk: string | null;
  count: number;
};

export type Offer = {
  id: string;
  s: string;
  t: string;
  u: string;
  i?: string | null;
  p: number;
  op?: number;
  c?: string;
  a: 0 | 1;
  col?: string | null;
  ty: string;
  l: Lang;
  v?: string;
  fs: string;
  pp?: number;
  pd?: string;
  h?: [string, number | null, number][];
  /** precio anómalo dentro de su grupo (muy por debajo de la mediana): no cuenta como "desde" */
  x?: boolean;
  /** huella visual de la foto (16 hex dHash + 6 hex color) */
  ih?: string;
  /** foto que no se parece a las demás del grupo (probablemente de otro producto) */
  io?: boolean;
  /** clave de producto calculada al exportar: une la misma referencia de distintas tiendas */
  k?: string;
};

export type Catalog = {
  generatedAt: string;
  lastUpdate: string | null;
  languages: { id: Lang; label: string }[];
  productTypes: { id: string; label: string; short: string }[];
  collections: Collection[];
  stores: Store[];
  /** imágenes oficiales por "colección|gama": [url, huella] */
  refs: Record<string, [string, string][]>;
};

export type Group = {
  key: string;
  col: Collection | null;
  ty: string;
  l: Lang;
  v: string;
  title: string;
  subtitle: string;
  offers: Offer[]; // ordenadas por precio, disponibles primero
  best: Offer; // la más barata disponible (o la más barata si nada está disponible)
  available: boolean;
  image: string | null;
  storeCount: number;
  drop: number | null; // mayor bajada reciente (EUR, positiva = bajó)
  dropPct: number | null;
  changedOn: string | null;
  firstSeen: string;
  search: string;
};

export type Data = {
  catalog: Catalog;
  offers: Offer[];
  groups: Group[];
  colById: Map<string, Collection>;
  storeById: Map<string, Store>;
  typeLabel: Map<string, string>;
  /** imagen de respaldo por colección (para las que no tienen logo ni arte) */
  colImage: Map<string, string>;
};

export const LANG_SHORT: Record<Lang, string> = { es: 'ES', en: 'EN', ja: 'JP', zh: 'CH', ko: 'KR' };
export const LANG_FLAG: Record<Lang, string> = { es: '🇪🇸', en: '🇬🇧', ja: '🇯🇵', zh: '🇨🇳', ko: '🇰🇷' };
export const LINE_LANGS: Record<string, string> = { intl: 'ES · EN', jp: 'JP · KR · CH', cn: 'CH' };
export const LANG_NAME: Record<Lang, string> = { es: 'Español', en: 'Inglés', ja: 'Japonés', zh: 'Chino', ko: 'Coreano' };
export const LINES_FOR_LANG: Record<Lang, string[]> = { es: ['intl'], en: ['intl'], ja: ['jp'], ko: ['jp'], zh: ['cn', 'jp'] };

export const COLUMNS_FOR_LANG: Record<Lang, string[]> = {
  es: ['booster_pack', 'booster_box', 'etb', 'booster_bundle', 'blister', 'tin', 'collection', 'premium', 'build_battle', 'deck'],
  en: ['booster_pack', 'booster_box', 'etb', 'booster_bundle', 'blister', 'tin', 'collection', 'premium', 'build_battle', 'deck'],
  ja: ['booster_pack', 'booster_box', 'case', 'deck', 'special', 'collection'],
  ko: ['booster_pack', 'booster_box', 'case', 'deck', 'special', 'collection'],
  zh: ['booster_pack', 'booster_box', 'case', 'deck', 'special', 'collection'],
};

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function collectionName(c: Collection | null | undefined, lang: Lang | 'ui' = 'ui'): string {
  if (!c) return 'Sin colección';
  const n = c.names;
  if (c.line === 'intl') return (lang === 'en' ? (n.en ?? n.es) : (n.es ?? n.en)) ?? c.code ?? c.id;
  // Japón / China: nombre en inglés (legible) y el original como secundario
  return n.en ?? n[lang as Lang] ?? n.ja ?? n.zh ?? n.ko ?? c.code ?? c.id;
}

/** Nombre secundario: original japonés/coreano/chino, o el otro idioma (ES↔EN) en la línea internacional. */
export function collectionLocalName(c: Collection | null | undefined, lang: Lang | 'ui'): string | null {
  if (!c) return null;
  const main = collectionName(c, lang);
  const n = c.names;
  const local = c.line === 'intl' ? (lang === 'en' ? n.es : n.en) : (n[lang as Lang] ?? n.ja ?? n.zh ?? n.ko);
  return local && local !== main ? local : null;
}

const VARIANT_WORDS: Record<string, string> = { pc: 'Pokémon Center', lat: 'Edición latinoamericana', half: 'Media caja', enhanced: 'Enhanced', noshrink: 'Sin film', bulk: 'Sobres sueltos', combo: 'Lote combinado', ex: 'ex', gx: 'GX', v: 'V', vmax: 'VMAX', vstar: 'VSTAR', mega: 'Mega', 'tag team': 'TAG TEAM' };
export function variantLabel(v: string): string {
  if (!v) return '';
  const parts = v.split('+');
  const out: string[] = [];
  for (const p of parts) {
    if (/^x\d+$/.test(p)) out.push(`Lote de ${p.slice(1)}`);
    else if (VARIANT_WORDS[p]) out.push(VARIANT_WORDS[p]);
    else out.push(p.replace(/\b\w/g, (m) => m.toUpperCase()));
  }
  // "Mega" delante del Pokémon, "ex" detrás
  const mega = out.includes('Mega');
  const rest = out.filter((x) => x !== 'Mega');
  return (mega ? 'Mega ' : '') + rest.join(' ');
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
export const fmtEur = (n: number | null | undefined) => (n == null ? '—' : eur.format(n));
export function fmtMoney(n: number, cur: string) {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'JPY' || cur === 'KRW' ? 0 : 2 }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}
export function fmtDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '';
  const date = d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  return new Intl.DateTimeFormat('es-ES', opts).format(date);
}
export function daysSince(d: string | null | undefined): number {
  if (!d) return Infinity;
  return (Date.now() - new Date(d.length === 10 ? `${d}T12:00:00` : d).getTime()) / 864e5;
}

// ── Fotos: elegir la que mejor representa al grupo ────────────────────────
function popcount(n: number): number {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
/** Distancia visual entre dos huellas: bits distintos de estructura + diferencia de color. */
export function imageDistance(a: string, b: string): number {
  const d = popcount(parseInt(a.slice(0, 8), 16) ^ parseInt(b.slice(0, 8), 16)) + popcount(parseInt(a.slice(8, 16), 16) ^ parseInt(b.slice(8, 16), 16));
  const c = (i: number) => Math.abs(parseInt(a.slice(16 + i, 18 + i), 16) - parseInt(b.slice(16 + i, 18 + i), 16));
  return d + (c(0) + c(2) + c(4)) / 24;
}
const FAR = 40; // por encima de esto, dos fotos casi seguro muestran productos distintos
const MULTI_ART = new Set(['booster_pack', 'tin', 'special', 'case', 'other']); // varias ilustraciones legítimas por producto

type RefMap = Record<string, [string, string][]>;

/** Foto del grupo: la que más se parece al resto (y a la oficial, si la hay). Marca las que no encajan. */
function pickImage(list: Offer[], ref: [string, string][] | undefined): string | null {
  const cands = list.filter((o) => o.i && !o.x);
  if (!cands.length) return list.find((o) => o.i)?.i ?? null;
  const hashed = cands.filter((o) => o.ih);
  const refs = ref ?? [];
  if (!hashed.length) return refs[0]?.[0] ?? cands[0].i!;
  const refDist = (o: Offer) => (refs.length ? Math.min(...refs.map(([, h]) => imageDistance(o.ih!, h))) : 0);
  let best = hashed[0];
  let bestScore = Infinity;
  for (const o of hashed) {
    let sum = 0;
    for (const p of hashed) if (p !== o) sum += imageDistance(o.ih!, p.ih!);
    const peers = hashed.length > 1 ? sum / (hashed.length - 1) : 0;
    const score = peers + refDist(o) * (refs.length ? 1.2 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  const ty = list[0]?.ty;
  for (const o of hashed) o.io = hashed.length >= 3 && !MULTI_ART.has(ty) && imageDistance(o.ih!, best.ih!) > FAR ? true : undefined;
  // Si ninguna foto de tienda se parece a la oficial, mejor la oficial
  if (refs.length && refDist(best) > 34) return refs[0][0];
  return best.i!;
}

const MULTI = new Set(['blister', 'tin', 'collection', 'premium', 'deck', 'special', 'case', 'other']);

export function buildGroups(offers: Offer[], colById: Map<string, Collection>, typeLabel: Map<string, string>, refs: RefMap = {}): Group[] {
  const map = new Map<string, Offer[]>();
  for (const o of offers) {
    const loose = !o.col || (MULTI.has(o.ty) && !o.v);
    const key = o.k ?? (loose ? `offer:${o.id}` : `${o.col}|${o.ty}|${o.l}|${o.v ?? ''}`);
    const arr = map.get(key);
    if (arr) arr.push(o);
    else map.set(key, [o]);
  }
  const groups: Group[] = [];
  for (const [key, list] of map) {
    list.sort((a, b) => b.a - a.a || a.p - b.p);
    // Precios anómalos: muy por debajo de la mediana del grupo (señales de reserva, errores de la tienda…)
    const avail = list.filter((o) => o.a).map((o) => o.p).sort((a, b) => a - b);
    const median = avail.length >= 3 ? avail[Math.floor(avail.length / 2)] : null;
    for (const o of list) o.x = median != null && o.p < median * 0.35 ? true : undefined;
    const best = list.find((o) => !o.x) ?? list[0];
    const col = best.col ? (colById.get(best.col) ?? null) : null;
    const type = typeLabel.get(best.ty) ?? best.ty;
    const loose = key.startsWith('offer:');
    // Huella del grupo: la de la clave (puede afinar la de la oferta, p. ej. nº de sobres de un blíster)
    const parts = key.split('|');
    const v = !loose && parts.length >= 4 ? parts[3] : (best.v ?? '');
    // Gamas con muchas referencias (colecciones, latas, barajas…) o sin colección: el título más representativo
    // de las tiendas; las demás, "Colección · variante"
    const byTitle = loose || key.startsWith('~|') || MULTI.has(best.ty);
    const title = byTitle ? representativeTitle(list) : [collectionName(col, best.l), variantLabel(v)].filter(Boolean).join(' · ');
    const subtitle = byTitle ? [type, col ? collectionName(col, best.l) : null].filter(Boolean).join(' · ') : type;
    let drop: number | null = null;
    let dropPct: number | null = null;
    let changedOn: string | null = null;
    for (const o of list) {
      if (o.pp != null && o.pd && daysSince(o.pd) <= 7) {
        const d = o.pp - o.p;
        if (drop == null || Math.abs(d) > Math.abs(drop)) {
          drop = d;
          dropPct = o.pp ? d / o.pp : null;
          changedOn = o.pd;
        }
      }
    }
    groups.push({
      key,
      col,
      ty: best.ty,
      l: best.l,
      v,
      title,
      subtitle,
      offers: list,
      best,
      available: list.some((o) => o.a),
      image: pickImage(list, best.col && !v && (col?.line === 'intl' ? best.l === 'en' : col?.line === 'jp' ? best.l === 'ja' : false) ? refs[`${best.col}|${best.ty}`] : undefined),
      storeCount: new Set(list.map((o) => o.s)).size,
      drop,
      dropPct,
      changedOn,
      firstSeen: list.reduce((m, o) => (o.fs < m ? o.fs : m), list[0].fs),
      search: norm([title, subtitle, col?.code ?? '', ...Object.values(col?.names ?? {}), ...list.map((o) => o.t)].join(' ')),
    });
  }
  return groups;
}

const LANG_WORD = '(espa[ñn]ol|castellano|spanish|ingl[ée]s|english|eng|esp|en|es|englisch|inglese|japon[ée]s|japanese|jap|jpn?|chino|chinese|coreano|korean|kr)';

/** Quita ruido típico de tienda de los títulos: idioma, "Pokémon TCG", reserva, separadores sueltos. */
export function cleanTitle(t: string): string {
  return t
    .replace(new RegExp(`\\s*[\\[(]\\s*${LANG_WORD}(\\s*[/&,y-]\\s*${LANG_WORD})*\\s*[\\])]`, 'gi'), '')
    .replace(new RegExp(`\\s*[—–|-]\\s*${LANG_WORD}\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s+${LANG_WORD}\\s*$`, 'i'), '')
    .replace(/\s*\|\s*pok[eé]mon\s*\|\s*/gi, ' ')
    .replace(/\s*[-–|:]\s*(pok[eé]mon\s*)?(tcg|jcc)\b/gi, '')
    .replace(/^(pok[eé]mon\s*(tcg|jcc|trading card game)?\s*[:\-–]?\s*)/i, '')
    .replace(/\bpok[eé]mon (tcg|jcc)\b\s*/gi, '')
    .replace(/\s*\((preventa|pre-?order|reserva)[^)]*\)/gi, '')
    .replace(/\s*\+\s*\d+\s*a[ñn]os\b/gi, '')
    .replace(/\s+[—–|-]\s*$/, '')
    .replace(/^[\s:–—|-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** El título que mejor representa al grupo: el que más palabras comparte con los demás (sin gritos en mayúsculas). */
export function representativeTitle(list: Offer[]): string {
  // Sin la variante de la tienda (" — Alomomola & Axew") ni la coletilla tras "|" ("| Mega Evolution", "| POKÉMON | Español")
  const titles = [...new Set(list.map((o) => cleanTitle(o.t.replace(/\s+—\s+.*$/, '').replace(/\s+\|\s+.*$/, '')) || cleanTitle(o.t)))];
  if (titles.length === 1) return list.length === 1 ? cleanTitle(list[0].t) : titles[0];
  const toks = titles.map((t) => new Set(norm(t).split(' ').filter((w) => w.length > 1)));
  let best = titles[0];
  let bestScore = -1;
  titles.forEach((t, i) => {
    let score = 0;
    toks.forEach((o, j) => {
      if (i === j) return;
      let inter = 0;
      for (const w of toks[i]) if (o.has(w)) inter++;
      score += inter / (toks[i].size + o.size - inter || 1);
    });
    const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
    if (letters && letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length / letters.length > 0.6) score *= 0.75;
    score -= t.length / 2000; // a igualdad, el más corto
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  });
  return best;
}

export async function loadData(): Promise<Data> {
  const [catalog, offers] = await Promise.all([
    fetch('./data/catalog.json').then((r) => r.json() as Promise<Catalog>),
    fetch('./data/offers.json').then((r) => r.json() as Promise<Offer[]>),
  ]);
  const colById = new Map(catalog.collections.map((c) => [c.id, c]));
  const storeById = new Map(catalog.stores.map((s) => [s.id, s]));
  const typeLabel = new Map(catalog.productTypes.map((t) => [t.id, t.label]));
  catalog.refs ??= {};
  const groups = buildGroups(offers, colById, typeLabel, catalog.refs);
  // Imagen de respaldo para colecciones sin logo ni arte: la foto de su sobre o caja más vista
  const colImage = new Map<string, string>();
  const rank = ['booster_pack', 'booster_box', 'etb', 'booster_bundle'];
  for (const t of rank) for (const g of [...groups].sort((a, b) => b.storeCount - a.storeCount)) if (g.col && g.ty === t && g.image && !colImage.has(g.col.id)) colImage.set(g.col.id, g.image);
  return { catalog, offers, groups, colById, storeById, typeLabel, colImage };
}

export const FLAG: Record<string, string> = {
  ES: '🇪🇸', DE: '🇩🇪', FR: '🇫🇷', IT: '🇮🇹', PT: '🇵🇹', NL: '🇳🇱', BE: '🇧🇪', AT: '🇦🇹', PL: '🇵🇱', GB: '🇬🇧', UK: '🇬🇧',
  IE: '🇮🇪', JP: '🇯🇵', KR: '🇰🇷', CN: '🇨🇳', HK: '🇭🇰', TW: '🇹🇼', SG: '🇸🇬', US: '🇺🇸', CA: '🇨🇦', DK: '🇩🇰', SE: '🇸🇪',
  FI: '🇫🇮', NO: '🇳🇴', CZ: '🇨🇿', LU: '🇱🇺', CH: '🇨🇭', TH: '🇹🇭', MY: '🇲🇾', AU: '🇦🇺', GR: '🇬🇷', HU: '🇭🇺', SK: '🇸🇰',
  LT: '🇱🇹', LV: '🇱🇻', EE: '🇪🇪', SI: '🇸🇮', HR: '🇭🇷', RO: '🇷🇴', BG: '🇧🇬', MT: '🇲🇹', CY: '🇨🇾',
};

export const EU_COUNTRIES = new Set(['ES', 'DE', 'FR', 'IT', 'PT', 'NL', 'BE', 'AT', 'PL', 'IE', 'DK', 'SE', 'FI', 'CZ', 'LU', 'GR', 'HU', 'SK', 'LT', 'LV', 'EE', 'SI', 'HR', 'RO', 'BG', 'MT', 'CY']);
export type Region = 'es' | 'eu' | 'world';
export function regionOf(country: string | undefined): Region {
  if (country === 'ES') return 'es';
  return country && EU_COUNTRIES.has(country) ? 'eu' : 'world';
}
const countryNames = new Intl.DisplayNames(['es'], { type: 'region' });
export function countryName(code: string): string {
  try {
    return countryNames.of(code === 'UK' ? 'GB' : code) ?? code;
  } catch {
    return code;
  }
}
export function shippingNote(country: string): string {
  const r = regionOf(country);
  if (r === 'es') return 'Envío desde España';
  if (r === 'eu') return `Envío desde ${countryName(country)} · UE, sin aduana`;
  return `Envío desde ${countryName(country)} · fuera de la UE: suma IVA de importación y aduana`;
}

/** Origen permitido: 'es' = sólo tiendas españolas, 'eu' = UE (sin aduanas), null = todas. */
export function offersByOrigin(data: { offers: Offer[]; storeById: Map<string, Store> }, origin: string | null): Offer[] {
  if (origin !== 'es' && origin !== 'eu') return data.offers;
  return data.offers.filter((o) => {
    const r = regionOf(data.storeById.get(o.s)?.country);
    return origin === 'es' ? r === 'es' : r !== 'world';
  });
}

/** Visual de una colección según el idioma: logo (ES/EN), foto del sobre o imagen de respaldo. */
export function collectionVisual(data: Pick<Data, 'colImage'>, c: Collection | null | undefined, lang: Lang | 'ui' = 'ui'): { logo?: string; art?: string } {
  if (!c) return {};
  if (c.line === 'intl') {
    const logo = lang === 'en' ? (c.logoEn ?? c.logo) : (c.logo ?? c.logoEn);
    if (logo) return { logo };
  }
  if (c.art) return { art: c.art };
  const img = data.colImage.get(c.id);
  return img ? { art: img } : {};
}

/** La misma imagen al tamaño justo cuando el CDN lo permite (Shopify, TCGplayer): menos datos. */
export function sized(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.host === 'cdn.shopify.com' || u.pathname.includes('/cdn/shop/')) {
      u.searchParams.set('width', String(width));
      return u.toString();
    }
    if (u.host === 'tcgplayer-cdn.tcgplayer.com') return url.replace(/_\d+w\.jpg$/, width <= 200 ? '_200w.jpg' : '_400w.jpg');
  } catch {
    /* ruta relativa (logos propios) */
  }
  return url;
}
