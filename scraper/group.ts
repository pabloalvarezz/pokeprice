// Agrupa las ofertas de todas las tiendas en productos: la misma caja vendida en diez tiendas, con diez títulos
// distintos, tiene que salir como un solo producto con diez precios.
//
// Clave de un producto = colección · gama · idioma · huella (variant_key del clasificador: Pokémon, entrenador,
// rasgos como "mini", "póster", "liga", nº de sobres…). Además:
//  · sin colección reconocida, la huella basta si nombra un Pokémon o entrenador; si no, se usa el título
//    limpio (sin idioma, tienda ni palabras de gama), que también suele coincidir entre tiendas
//  · un producto sin colección se une al único producto con colección que tenga su misma huella
//  · si una tienda no escribe la mecánica ("Charizard Premium Collection") se une al único grupo que sólo se
//    diferencia en eso ("Charizard ex Premium Collection")
//  · blísteres sin número de sobres en el título: por precio, sobre suelto (checklane) o de tres
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/db.ts';
import { norm } from './lib/text.ts';
import { PRODUCT_TYPES } from './classify/taxonomy.ts';
import { TRAINER_TAGS } from './classify/classifier.ts';

export type Groupable = { id: string; t: string; p: number; col: string | null; ty: string; l: string; v?: string };

const MULTI = new Set<string>(PRODUCT_TYPES.filter((p) => p.multi).map((p) => p.id));
const MECH = new Set(['ex', 'gx', 'v', 'vmax', 'vstar', 'break', 'prism', 'tagteam', 'vunion']);
// Detalles que muchas tiendas no escriben aunque el producto los tenga
const SOFT = new Set([...MECH, 'mega', 'league']);
const STRONG = new Set(['firstpartner', 'academy', 'trainerkit', 'lumiose']);
let pokemon: Set<string> | null = null;
const isNamed = (tag: string) => {
  pokemon ??= new Set(JSON.parse(readFileSync(resolve(ROOT, 'data', 'pokemon-names.json'), 'utf8')) as string[]);
  // Pokémon, entrenador, tipo de Poké Ball, mes de una colección mensual o línea de producto inconfundible
  return pokemon.has(tag) || TRAINER_TAGS.has(tag) || /^[a-z]+ball$/.test(tag) || /^m\d\d$/.test(tag) || STRONG.has(tag);
};

// Palabras que no identifican el producto: idioma, tienda, gama, relleno
const NOISE = new Set(
  (
    'pokemon pokémon tcg jcc ptcg trading card cards carta cartas game juego juegos coleccionables coleccionable cartes ' +
    'espanol espanola castellano spanish ingles inglesa english eng esp ing japones japonesa japanese jap jp jpn en es ' +
    'coreano korean kr kor chino chinese cn sc tc simplified traditional simplificado tradicional version edicion edition ed idioma language ' +
    'sealed sellado sellada precintado precintada nuevo nueva new original originales oficial official producto product ' +
    'preventa reserva pre order preorder oferta stock disponible envio gratis free shipping unidad unidades pezzo pcs pc pz ud uds ' +
    'de del la el los las y and e et the of con with en a para por un una al o or to from desde vs ' +
    'box caja cajas set sets pack packs sobre sobres booster boosters display tin tins lata latas collection coleccion colecciones ' +
    'deck decks baraja barajas mazo mazos blister blisters bundle etb kit premium special especial box ' +
    'brand ver japanisch englisch inglese protection cpc random aleatoria aleatorio aleatorias surtido surtida assorted anos years ' +
    'scarlet violet sword shield escarlata purpura espada escudo'
  ).split(' '),
);

/** Título reducido a lo que identifica el producto ("Pokemon Sinnoh Star Mini Tin – Set (5pc)" → "sinnoh star"). */
export function residual(title: string): string {
  const toks = norm(title)
    .split(' ')
    .filter((w) => w && !NOISE.has(w) && !(/^\d+$/.test(w) && Number(w) < 100) && w.length > 1);
  return [...new Set(toks)].sort().join(' ');
}

const addTag = (v: string, tag: string) => (v ? `${v}+${tag}` : tag).split('+').sort().join('+');

const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i || 1);
};

/** Devuelve la clave de producto de cada oferta (id → clave). */
export function groupKeys(offers: Groupable[]): Map<string, string> {
  const keyOf = new Map<string, string>();
  const resOf = new Map<string, string>();
  for (const o of offers) {
    let v = o.v ?? '';
    if (o.ty === 'blister' && (o.l === 'es' || o.l === 'en') && !/(^|\+)[1-4]p(\+|$)/.test(v)) v = addTag(v, o.p < 12 ? '1p' : '3p');
    let k: string;
    if (o.col) {
      // Blísteres y mini latas de una expansión: la ilustración (Zapdos, Lapras…) no cambia el producto
      if (o.ty === 'blister' || (o.ty === 'tin' && v.split('+').includes('mini'))) v = v.split('+').filter((t) => !isNamed(t) && !MECH.has(t) && t !== 'mega').join('+');
      k = MULTI.has(o.ty) && !v && o.ty === 'other' ? `offer:${o.id}` : `${o.col}|${o.ty}|${o.l}|${v}`;
    } else {
      const named = MULTI.has(o.ty) && v.split('+').some(isNamed);
      // En japonés/chino/coreano hay muchas cajas regalo y sets distintos del mismo Pokémon: ahí cuenta también el
      // título (más abajo se juntan los que se parecen lo bastante)
      if (named && (o.l === 'es' || o.l === 'en')) k = `~|${o.ty}|${o.l}|${v}`;
      else {
        const r = o.ty === 'other' && !named ? '' : residual(o.t);
        k = r ? `~|${o.ty}|${o.l}|${v}|r:${r}` : `offer:${o.id}`;
        if (r) resOf.set(k, r);
      }
    }
    keyOf.set(o.id, k);
  }
  const redirect = new Map<string, string>();

  // 0. Mismo Pokémon en japonés/chino/coreano: se juntan los títulos que comparten al menos un tercio de palabras
  const buckets = new Map<string, string[]>();
  for (const k of resOf.keys()) {
    const [, ty, l, v] = k.split('|');
    if (!v || !v.split('+').some(isNamed)) continue;
    const b = `${ty}|${l}|${v}`;
    (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(k);
  }
  for (const ks of buckets.values()) {
    if (ks.length < 2) continue;
    const sets = ks.map((k) => new Set(resOf.get(k)!.split(' ')));
    const parent = ks.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (jaccard(sets[i], sets[j]) >= 0.34) parent[find(i)] = find(j);
    for (let i = 0; i < ks.length; i++) if (find(i) !== i) redirect.set(ks[i], ks[find(i)]);
  }

  // Grupos y su huella, con su precio mediano (dos grupos sólo se unen si cuestan parecido)
  type G = { key: string; col: string; ty: string; l: string; v: string; tags: Set<string>; price: number };
  const prices = new Map<string, number[]>();
  for (const o of offers) {
    const k = redirect.get(keyOf.get(o.id)!) ?? keyOf.get(o.id)!;
    (prices.get(k) ?? prices.set(k, []).get(k)!).push(o.p);
  }
  const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const groups = new Map<string, G>();
  for (const k of new Set(keyOf.values())) {
    if (k.startsWith('offer:') || k.includes('|r:')) continue;
    const [col, ty, l, v] = k.split('|');
    groups.set(k, { key: k, col, ty, l, v, tags: new Set(v ? v.split('+') : []), price: median(prices.get(k) ?? [0]) });
  }
  const similarPrice = (a: G, b: G) => Math.max(a.price, b.price) / Math.max(0.01, Math.min(a.price, b.price)) <= 1.8;

  // 1. Sin colección → al único grupo con colección con la misma huella
  const byIdentity = new Map<string, G[]>();
  for (const g of groups.values()) if (g.col !== '~' && g.v) (byIdentity.get(`${g.ty}|${g.l}|${g.v}`) ?? byIdentity.set(`${g.ty}|${g.l}|${g.v}`, []).get(`${g.ty}|${g.l}|${g.v}`)!).push(g);
  for (const g of groups.values()) {
    if (g.col !== '~') continue;
    const c = byIdentity.get(`${g.ty}|${g.l}|${g.v}`);
    if (c?.length === 1 && similarPrice(g, c[0])) redirect.set(g.key, c[0].key);
  }

  // 2. Huella incompleta → al único grupo que sólo le añade detalles que muchas tiendas omiten
  //    ("Baraja Combate Mega Lucario" → "… de Liga Mega Lucario ex"; "Charizard Premium" → "Charizard ex Premium")
  const byBucket = new Map<string, G[]>();
  for (const g of groups.values()) if (g.v) (byBucket.get(`${g.ty}|${g.l}`) ?? byBucket.set(`${g.ty}|${g.l}`, []).get(`${g.ty}|${g.l}`)!).push(g);
  for (const g of groups.values()) {
    if (redirect.has(g.key) || !g.v || ![...g.tags].some(isNamed)) continue;
    const all = (byBucket.get(`${g.ty}|${g.l}`) ?? []).filter(
      (o) => o !== g && o.tags.size > g.tags.size && [...g.tags].every((t) => o.tags.has(t)) && [...o.tags].every((t) => g.tags.has(t) || SOFT.has(t)),
    );
    const same = all.filter((o) => o.col === g.col);
    const c = same.length ? same : g.col === '~' ? all : all.filter((o) => o.col === '~');
    if (c.length === 1 && similarPrice(g, c[0])) redirect.set(g.key, redirect.get(c[0].key) ?? c[0].key);
  }

  // 3. Sin colección y sin Pokémon (agrupado por título): al único grupo con colección de su misma gama y huella
  //    cuyos títulos contienen todas sus palabras ("Unova Poster Collection" → Fulgor Negro/Llama Blanca · póster)
  const words = new Map<string, Set<string>>();
  for (const o of offers) {
    const k = keyOf.get(o.id)!;
    if (!groups.has(k) || groups.get(k)!.col === '~') continue;
    let w = words.get(k);
    if (!w) words.set(k, (w = new Set()));
    for (const t of residual(o.t).split(' ')) w.add(t);
  }
  const colByIdentity = new Map<string, string[]>();
  for (const k of words.keys()) {
    const g = groups.get(k)!;
    const b = `${g.ty}|${g.l}|${g.v}`;
    (colByIdentity.get(b) ?? colByIdentity.set(b, []).get(b)!).push(k);
  }
  for (const [k, r] of resOf) {
    if (redirect.has(k)) continue;
    const [, ty, l, v] = k.split('|');
    const toks = r.split(' ').filter((t) => !/^\d+$/.test(t));
    if (!toks.length) continue;
    const c = (colByIdentity.get(`${ty}|${l}|${v}`) ?? []).filter((ck) => toks.every((t) => words.get(ck)!.has(t)));
    if (c.length === 1) redirect.set(k, c[0]);
  }

  const resolve = (k: string) => {
    for (let i = 0; i < 5 && redirect.has(k); i++) k = redirect.get(k)!;
    return k;
  };
  for (const [id, k] of keyOf) keyOf.set(id, resolve(k));
  return keyOf;
}
