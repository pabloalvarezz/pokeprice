// Clasifica un título de producto de tienda → { colección, gama, idioma, variante }.
import type { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/db.ts';
import { hasHan, hasHangul, hasKana, key, norm } from '../lib/text.ts';
import { ACCESSORY, HARD_EXCLUDE, LANGS, LINES_FOR_LANG, PRODUCT_TYPES, STRONG_SEALED, TYPE_RULES, type Lang, type ProductType } from './taxonomy.ts';
import { EXTRA_ALIASES, BLOCKED_ALIASES } from './aliases.ts';

export type Classification = {
  excluded: string | null; // motivo si no es producto sellado de Pokémon en un idioma que seguimos
  collectionId: string | null;
  productType: ProductType;
  language: Lang | null;
  variantKey: string;
};

type Alias = {
  collectionId: string;
  line: string;
  text: string; // forma ya normalizada, rodeada de espacios
  form: 'key' | 'norm';
  lang: Lang | 'jpline' | null; // idioma que implica el alias (null = ambiguo es/en)
  weight: number; // 2 = nombre, 1 = código
  isBase: boolean;
};

type CollectionRow = {
  id: string;
  line: string;
  code: string | null;
  name_en: string | null;
  name_es: string | null;
  name_ja: string | null;
  name_ko: string | null;
  name_zh: string | null;
  names_other: string | null;
  aliases: string | null;
  is_base: number;
  release_date: string | null;
};

const SEALED_LEXICON = /\b(box|caja|set|sets|pack|packs|sobres?|booster|lata|tin|collection|coleccion|bundle|blister|deck|baraja|mazo|display|kit|briefcase|maletin|magazine|revista|megapack|calendar|calendario|gift|regalo|coffret|file|classic|sealed|precintad[oa]|preventa|pre order|preorder|lote|surtido|assorted)\b|ボックス|パック|セット|デッキ|박스|팩|盒|包|礼盒/;

// ── Idioma ────────────────────────────────────────────────────────────────────
const LANG_WORDS: [Lang, RegExp][] = [
  ['ja', /\b(japanese|japones|japonesa|japonais|japanisch|giapponese|japan version|version japonesa|jap)\b|日本語|日本版/],
  ['ko', /\b(korean|coreano|coreana|coreen|koreanisch|coreana|korea version)\b|한국어|한글판/],
  ['zh', /\b(chinese|chino|china|chinois|chinesisch|cinese|s chinese|t chinese|simplified|traditional|simplificado|tradicional|gem pack)\b|中文|简体|繁體|繁体|簡體/],
  ['es', /\b(espanol|espanola|castellano|spanish|spanisch|espagnol|spagnolo|version espanola)\b/],
  ['en', /\b(english|ingles|inglesa|anglais|englisch|inglese|version inglesa)\b/],
  ['other', /\b(frances|francesa|french|francais|franzosisch|aleman|alemana|german|deutsch|allemand|italiano|italiana|italian|italien|portugues|portuguesa|portuguese|holandes|dutch|neerlandais|polaco|polish|ruso|russian|thai|tailandes|indonesian|indonesio)\b/],
];
const SHORT_CODES: Record<string, Lang> = {
  ES: 'es', ESP: 'es', SPA: 'es', CAST: 'es',
  EN: 'en', ENG: 'en', ING: 'en',
  JP: 'ja', JPN: 'ja', JAP: 'ja', JA: 'ja',
  KR: 'ko', KOR: 'ko', KO: 'ko',
  CN: 'zh', CHN: 'zh', SC: 'zh', TC: 'zh', ZH: 'zh', SCN: 'zh', TCN: 'zh',
  FR: 'other', DE: 'other', IT: 'other', PT: 'other', NL: 'other', PL: 'other', GER: 'other', FRA: 'other', ITA: 'other',
};
const SHORT_RE = new RegExp(`(?<![A-Za-z])(${Object.keys(SHORT_CODES).join('|')})(?![A-Za-z])`, 'g');
const BRACKET_RE = new RegExp(`[\\(\\[\\{]\\s*(${Object.keys(SHORT_CODES).join('|')})\\s*[\\)\\]\\}]`, 'gi');

/** Idioma explícito en un texto, o null si no hay o hay contradicción. */
export function explicitLanguage(text: string): Lang | null {
  if (!text) return null;
  const found = new Set<Lang>();
  const n = norm(text);
  for (const [lang, re] of LANG_WORDS) if (re.test(n)) found.add(lang);
  for (const m of text.matchAll(BRACKET_RE)) found.add(SHORT_CODES[m[1].toUpperCase()]);
  const letters = text.replace(/[^A-Za-z]/g, '');
  const upperRatio = letters ? letters.replace(/[^A-Z]/g, '').length / letters.length : 0;
  if (upperRatio < 0.6) for (const m of text.matchAll(SHORT_RE)) found.add(SHORT_CODES[m[1]]);
  // "Japanese & English" o "ES/EN": ambiguo
  if (found.size === 1) return [...found][0];
  if (found.size > 1) {
    // zh + ja suele ser "Japanese/Chinese art"… mejor no adivinar
    return null;
  }
  return null;
}

function scriptLanguage(text: string): Lang | null {
  if (hasKana(text)) return 'ja';
  if (hasHangul(text)) return 'ko';
  if (hasHan(text)) return 'zh';
  return null;
}

// ── Clasificador ──────────────────────────────────────────────────────────────
export class Classifier {
  aliases: Alias[] = [];
  pokemon: string[] = [];
  collections = new Map<string, CollectionRow>();

  constructor(db: DatabaseSync) {
    const rows = db.prepare('SELECT * FROM collections').all() as CollectionRow[];
    for (const c of rows) {
      this.collections.set(c.id, c);
      const add = (text: string | null | undefined, lang: Alias['lang'], weight = 2) => {
        if (!text) return;
        let form: Alias['form'] = 'key';
        let k = key(text);
        const isCode = (weight === 1 && /^[a-z]{1,4}\d{1,2}(\.\d)?[a-z]{0,2}$/i.test(text.replace(/[ .]/g, ''))) || (!!c.is_base && /^[a-z]{2}$/i.test(text.trim()));
        if (k.length < 4 && !/^\d{3}$/.test(k) && !isCode) {
          form = 'norm';
          k = norm(text);
        }
        if (!k || (k.length < 3 && !isCode) || BLOCKED_ALIASES.has(k)) return;
        this.aliases.push({ collectionId: c.id, line: c.line, text: ` ${k} `, form, lang, weight, isBase: !!c.is_base });
      };
      if (c.line === 'intl') {
        const same = c.name_en && c.name_es && key(c.name_en) === key(c.name_es);
        add(c.name_en, same ? null : 'en');
        add(c.name_es, same ? null : 'es');
        const other = c.names_other ? (JSON.parse(c.names_other) as Record<string, string | undefined>) : {};
        for (const v of Object.values(other)) {
          // sólo nombres extranjeros distintivos (2+ palabras o largos): sirven para descartar FR/DE/IT/PT
          if (v && key(v) !== key(c.name_en ?? '') && key(v) !== key(c.name_es ?? '') && (key(v).includes(' ') || key(v).length >= 10)) add(v, 'other');
        }
        if (c.code && /^(sv|me|swsh|sm)\d/i.test(c.code)) add(c.code.replace('.', ' '), null, 1);
      } else if (c.line === 'jp') {
        add(c.name_en, 'jpline');
        add(c.name_ja, 'ja');
        add(c.name_ko, 'ko');
        add(c.name_zh, 'zh');
        if (c.code) add(c.code, 'jpline', 1);
      } else {
        add(c.name_zh, 'zh');
        if (c.code) {
          add(c.code, 'zh', 1);
          add(c.code.replace(/c$/i, ' c'), 'zh', 1); // "csv9 C"
          if (/^CS/.test(c.code) && /[a-z]C$/.test(c.code)) add(c.code.slice(0, -1), 'zh', 1); // "CSM2cC" → "CSM2c"
        }
        const vol = c.name_zh?.match(/vol\.?\s*(\d+)/i)?.[1];
        if (vol && /宝石包/.test(c.name_zh ?? '')) for (const f of ['gem pack vol', 'gem pack volume', 'gem pack']) add(`${f} ${vol}`, 'zh');
      }
      for (const extra of [...(c.aliases ? (JSON.parse(c.aliases) as string[]) : []), ...(EXTRA_ALIASES[c.id] ?? [])]) {
        add(extra, c.line === 'intl' ? null : c.line === 'jp' ? 'jpline' : 'zh');
      }
    }
    // Nombres de Pokémon para distinguir productos de gamas con muchas referencias (colecciones, latas…)
    const pkPath = resolve(ROOT, 'data', 'pokemon-names.json');
    if (existsSync(pkPath)) this.pokemon = JSON.parse(readFileSync(pkPath, 'utf8'));
  }

  matchCollections(title: string) {
    const k = ` ${key(title)} `;
    const n = ` ${norm(title)} `;
    const squashed = k.replace(/ /g, '');
    const hits: Alias[] = [];
    for (const a of this.aliases) {
      if ((a.form === 'key' ? k : n).includes(a.text)) hits.push(a);
      else if (a.form === 'key' && a.weight === 2 && a.text.length >= 13 && squashed.includes(a.text.replace(/ /g, ''))) hits.push(a);
    }
    return hits;
  }

  classify(input: { title: string; variant?: string; meta?: string; storeLanguages?: string[] }): Classification {
    const { title } = input;
    const variant = input.variant && !/default title/i.test(input.variant) ? input.variant : '';
    const full = `${title} ${variant}`.trim();
    const n = norm(full);
    const typeText = `${n} ${norm(input.meta ?? '')}`;

    // 1. ¿Es producto sellado de Pokémon? (las reglas duras miran también el texto con puntuación: "063/191")
    const lower = full.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const [reason, re] of HARD_EXCLUDE) if (re.test(n) || re.test(lower)) return this.out(reason);
    let productType: ProductType = 'other';
    for (const [t, re] of TYPE_RULES) {
      if (re.test(n)) {
        productType = t;
        break;
      }
    }
    if (ACCESSORY.test(n) && !STRONG_SEALED.test(n)) return this.out('accesorio');
    const hitsAll = this.matchCollections(full);
    if (!hitsAll.length && !/pokemon|ポケモン|포켓몬|宝可梦|寶可夢|ptcg/.test(n) && !this.hasPokemonName(n)) return this.out('no es pokémon');

    // 2. Idioma explícito o por escritura
    let language: Lang | null = explicitLanguage(variant) ?? explicitLanguage(title) ?? scriptLanguage(full);
    // Tienda de un solo idioma (p. ej. importadores japoneses): manda antes que el idioma del nombre del set
    const storeLangs = input.storeLanguages ?? [];
    if (!language && storeLangs.length === 1 && (LANGS as readonly string[]).includes(storeLangs[0])) language = storeLangs[0] as Lang;

    // 3. Colección, restringida a las líneas del idioma si lo conocemos
    const hits = hitsAll;
    const allowed = language ? LINES_FOR_LANG[language] : null;
    let pool = allowed ? hits.filter((h) => allowed.includes(h.line)) : hits;
    if (!pool.length && allowed && hits.length) pool = []; // p. ej. inglés + alias sólo japonés → sin colección
    // Un alias contenido en otro más largo que también encaja no cuenta ("evolution" dentro de "mega evolution")
    pool = pool.filter((h) => !pool.some((o) => o !== h && o.text.length > h.text.length && o.text.includes(h.text)));
    const distinct = new Set(pool.map((h) => h.collectionId));
    if (distinct.size > 1) pool = pool.filter((h) => !h.isBase || pool.every((p) => p.isBase));
    pool.sort(
      (a, b) =>
        b.weight - a.weight ||
        b.text.length - a.text.length ||
        (a.line === 'intl' ? -1 : 0) - (b.line === 'intl' ? -1 : 0),
    );
    const best = pool[0];

    if (!language && hits.some((h) => h.lang === 'other') && !hits.some((h) => h.lang === 'es' || h.lang === 'en')) language = 'other';
    if (!language && best) {
      if (best.lang === 'jpline') language = 'ja';
      else if (best.lang) language = best.lang;
      else {
        // alias que es igual en inglés y español: el idioma de otra coincidencia de la misma colección, o el de la tienda
        const other = pool.find((h) => h.collectionId === best.collectionId && h.lang && h.lang !== 'jpline');
        language = (other?.lang as Lang) ?? null;
      }
    }
    if (!language) {
      // idioma por defecto de la tienda; fr/de/it/pt… cuentan como "otro idioma"
      const first = (input.storeLanguages ?? [])[0];
      language = !first ? null : (LANGS as readonly string[]).includes(first) ? (first as Lang) : 'other';
    }
    // Colección incompatible con el idioma final (p. ej. alias japonés en tienda inglesa sin marca): la descartamos
    let collectionId: string | null = best?.collectionId ?? null;
    if (collectionId && language && !LINES_FOR_LANG[language].includes(best!.line)) {
      const alt = hits.find((h) => LINES_FOR_LANG[language!].includes(h.line));
      collectionId = alt?.collectionId ?? null;
    }

    // Japón: "BOX" a secas es una caja de sobres
    if (productType === 'collection' && (language === 'ja' || language === 'ko' || language === 'zh') && /\bbox\b/.test(n) && !/collection|coleccion|special|gift|deck|premium/.test(n)) {
      productType = 'booster_box';
    }
    if (productType === 'other' && /\bbox\b/.test(n)) productType = language === 'ja' || language === 'ko' ? 'booster_box' : 'collection';

    // Sin gama reconocida y sin ninguna palabra de producto sellado: casi siempre es una carta suelta
    if (productType === 'other' && !SEALED_LEXICON.test(n)) return this.out('suelta probable');

    if (language === 'other') return { ...this.out('otro idioma'), collectionId, productType, language };

    let variantKey = this.variantKey(n, productType);
    // Combos de tienda ("ETB + Bundle", "ETB + Pokéball"): no se mezclan con el producto suelto
    const SINGLE = ['etb', 'booster_box', 'booster_bundle', 'booster_pack', 'build_battle'];
    if (SINGLE.includes(productType) && /\+\s*(\d+\s*)?(etb|elite|bundle|booster box|display|caja|blister|tin|lata|poke ?ball|pokeball|coleccion|collection|binder|sleeves|fundas)|\bcombo\b|\bpack exclusivo\b/.test(lower)) {
      variantKey = variantKey ? `${variantKey}+combo` : 'combo';
    }
    return { excluded: null, collectionId, productType, language, variantKey };
  }

  hasPokemonName(n: string): boolean {
    const words = ` ${n} `;
    return this.pokemon.some((p) => p.length >= 4 && words.includes(` ${p} `));
  }

  private out(reason: string): Classification {
    return { excluded: reason, collectionId: null, productType: 'other', language: null, variantKey: '' };
  }

  /** Distingue referencias dentro de una misma colección+gama+idioma. */
  variantKey(n: string, type: ProductType): string {
    const parts: string[] = [];
    if (/pokemon center|pokemoncenter/.test(n)) parts.push('pc');
    if (/\b(lat|latam|latino|latina|latin american|latinoamerica|latinoamericano|latinoamericana|mexico|mx)\b/.test(n)) parts.push('lat');
    const qty = n.match(/\b(\d{1,3}) ?x\b|\bx ?(\d{1,3})\b|\b(\d{1,3}) (sobres|booster packs|packs|boosters)\b|\blote de (\d{1,3})\b|\b(\d{1,3}) ?ct\b|\bpack de (\d{1,3})\b|\b(\d{1,3}) ?(unds?|uds|unidades|pcs|stuck)\b/);
    const q = qty ? Number(qty[1] ?? qty[2] ?? qty[3] ?? qty[5] ?? qty[6] ?? qty[7] ?? qty[8]) : 1;
    if (type === 'booster_pack' && q > 1) parts.push(`x${q}`);
    if (type === 'booster_box' && /\bhalf|media|18 (sobres|packs|boosters)\b/.test(n)) parts.push('half');
    if (type === 'booster_box' && /\benhanced\b/.test(n)) parts.push('enhanced');
    if (type === 'booster_box' && /\b(no shrink|without shrink|no shrinkwrap|sin film|sin precinto|ohne folie|sans film|unshrink|unshrinked)\b/.test(n)) parts.push('noshrink');
    if (type === 'booster_box' && /\b(bulk|loose|sueltos|sueltas|lote de)\b/.test(n)) parts.push('bulk');
    const multi = PRODUCT_TYPES.find((p) => p.id === type)?.multi;
    if (multi) {
      const words = ` ${n} `;
      const mons = this.pokemon.filter((p) => words.includes(` ${p} `));
      const mech = (n.match(/\b(ex|gx|vmax|vstar|v|mega|tag team)\b/g) ?? []).filter((v, i, a) => a.indexOf(v) === i);
      if (mons.length) parts.push(...mons.sort(), ...mech.sort());
    }
    return parts.join('+');
  }
}
