export type Lang = 'es' | 'en' | 'ja' | 'zh' | 'ko';

export type Collection = {
  id: string;
  line: 'intl' | 'jp' | 'cn';
  code: string | null;
  series: string | null;
  names: Partial<Record<Lang, string>>;
  date: string | null;
  logo: string | null;
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
};

export type Catalog = {
  generatedAt: string;
  lastUpdate: string | null;
  languages: { id: Lang; label: string }[];
  productTypes: { id: string; label: string; short: string }[];
  collections: Collection[];
  stores: Store[];
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
};

export const LANG_SHORT: Record<Lang, string> = { es: 'ES', en: 'EN', ja: 'JA', zh: 'ZH', ko: 'KO' };
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

const VARIANT_WORDS: Record<string, string> = { pc: 'Pokémon Center', lat: 'Edición latinoamericana', half: 'Media caja', enhanced: 'Enhanced', noshrink: 'Sin film', bulk: 'Sobres sueltos', ex: 'ex', gx: 'GX', v: 'V', vmax: 'VMAX', vstar: 'VSTAR', mega: 'Mega', 'tag team': 'TAG TEAM' };
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

const MULTI = new Set(['blister', 'tin', 'collection', 'premium', 'deck', 'special', 'case', 'other']);

export function buildGroups(offers: Offer[], colById: Map<string, Collection>, typeLabel: Map<string, string>): Group[] {
  const map = new Map<string, Offer[]>();
  for (const o of offers) {
    const loose = !o.col || (MULTI.has(o.ty) && !o.v);
    const key = loose ? `offer:${o.id}` : `${o.col}|${o.ty}|${o.l}|${o.v ?? ''}`;
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
    const vLabel = variantLabel(best.v ?? '');
    const title = loose ? cleanTitle(best.t) : [collectionName(col, best.l), vLabel].filter(Boolean).join(' · ');
    const subtitle = loose ? [type, col ? collectionName(col, best.l) : null].filter(Boolean).join(' · ') : type;
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
      v: best.v ?? '',
      title,
      subtitle,
      offers: list,
      best,
      available: list.some((o) => o.a),
      image: list.find((o) => o.i)?.i ?? null,
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

/** Quita ruido típico de tienda de los títulos. */
export function cleanTitle(t: string): string {
  return t
    .replace(/\s*[-–|]\s*(pok[eé]mon\s*)?(tcg|jcc)\b/gi, '')
    .replace(/^(pok[eé]mon\s*(tcg|jcc|trading card game)?\s*[:\-–]?\s*)/i, '')
    .replace(/\s*\((preventa|pre-?order|reserva)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadData(): Promise<Data> {
  const [catalog, offers] = await Promise.all([
    fetch('./data/catalog.json').then((r) => r.json() as Promise<Catalog>),
    fetch('./data/offers.json').then((r) => r.json() as Promise<Offer[]>),
  ]);
  const colById = new Map(catalog.collections.map((c) => [c.id, c]));
  const storeById = new Map(catalog.stores.map((s) => [s.id, s]));
  const typeLabel = new Map(catalog.productTypes.map((t) => [t.id, t.label]));
  const groups = buildGroups(offers, colById, typeLabel);
  return { catalog, offers, groups, colById, storeById, typeLabel };
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
