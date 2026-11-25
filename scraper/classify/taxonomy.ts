// Gamas de producto e idiomas que maneja PokéPrice.

export const LANGS = ['es', 'en', 'ja', 'zh', 'ko'] as const;
export type Lang = (typeof LANGS)[number] | 'other';

export const LANG_LABEL: Record<string, string> = {
  es: 'Español',
  en: 'Inglés',
  ja: 'Japonés',
  zh: 'Chino',
  ko: 'Coreano',
};

/** Línea de sets que corresponde a cada idioma. */
export const LINES_FOR_LANG: Record<string, string[]> = {
  es: ['intl'],
  en: ['intl'],
  ja: ['jp'],
  ko: ['jp'],
  zh: ['cn', 'jp'], // simplificado tiene sets propios; tradicional sigue a Japón
  other: ['intl'],
};

export type ProductType =
  | 'booster_pack'
  | 'booster_box'
  | 'etb'
  | 'booster_bundle'
  | 'blister'
  | 'tin'
  | 'collection'
  | 'premium'
  | 'build_battle'
  | 'deck'
  | 'special'
  | 'case'
  | 'other';

export const PRODUCT_TYPES: { id: ProductType; label: string; short: string; multi: boolean }[] = [
  { id: 'booster_pack', label: 'Sobres', short: 'Sobre', multi: false },
  { id: 'booster_box', label: 'Cajas de sobres', short: 'Display', multi: false },
  { id: 'etb', label: 'Elite Trainer Box', short: 'ETB', multi: false },
  { id: 'booster_bundle', label: 'Booster Bundle', short: 'Bundle', multi: false },
  { id: 'blister', label: 'Blísteres', short: 'Blíster', multi: true },
  { id: 'tin', label: 'Latas', short: 'Lata', multi: true },
  { id: 'collection', label: 'Colecciones', short: 'Colección', multi: true },
  { id: 'premium', label: 'Colecciones Premium', short: 'Premium', multi: true },
  { id: 'build_battle', label: 'Build & Battle', short: 'B&B', multi: false },
  { id: 'deck', label: 'Barajas', short: 'Baraja', multi: true },
  { id: 'special', label: 'Sets especiales', short: 'Especial', multi: true },
  { id: 'case', label: 'Cajas master', short: 'Case', multi: true },
  { id: 'other', label: 'Otros sellados', short: 'Otro', multi: true },
];

// El orden importa: gana el primer patrón que encaje. Se aplican sobre texto normalizado (norm()).
export const TYPE_RULES: [ProductType, RegExp][] = [
  ['case', /\b(booster box case|display case|etb case|box case|caja master|master case|sealed case|carton|case of \d+|\d+ ?x ?(displays?|booster boxes|etbs?|elite trainer boxes))\b|カートン|\bcase\b/],
  ['etb', /\b(elite trainer box|caja de entrenador( de)? elite|entrenador( de)? elite|etb|top trainer box|coffret dresseur d elite)\b|\bcaja (de )?entrenador\b(?! avanzad)/],
  ['booster_bundle', /\b(booster bundle|bundle de sobres|lote de 6 sobres|pack de 6 sobres|6 sobres|6 booster packs|6 packs|bundle)\b/],
  ['build_battle', /\b(build and battle|build battle|construye y combate|caja de presentacion|kit de presentacion|prerelease|pre release)\b/],
  ['premium', /\b(ultra premium|super premium|premium collections?|coleccion premium|premium box|caja premium|premium figure|coleccion especial premium|upc|spc)\b/],
  ['special', /\b(special set|set especial|deck build box|premium trainer box|gift box|special box|caja especial|battle academy|academia de combate|surprise box|caja sorpresa|advent calendar|calendario de adviento|holiday calendar|calendario|starter set ex|premium deck set|special deck set|jumbo|card file set|high class pack box|card display set|display set|figure box|coin display|display frame|card display|figure collection box)\b|スペシャルセット|デッキビルドbox|ギフトボックス/],
  ['tin', /\b(tins?|mini tins?|latas?|mini latas?|tin box|stacking tin|poke ball tin|pokeball tin)\b|缶/],
  ['blister', /\b(blister|blisters|blister pack|checklane|3 pack|three pack|2 pack|two pack|pack de 3|3 sobres|tres sobres|quad pack|4 pack|cuadruple|triple pack|triple blister)\b/],
  ['deck', /\b(decks?|baraja|barajas|mazos?|theme deck|battle deck|starter deck|start deck|starter set|league battle deck|baraja de combate|baraja de liga|world championship deck|trainer kit|my first battle|mi primer combate)\b|デッキ|스타트덱/],
  ['booster_box', /\b(booster box|booster display|display|caja de sobres|caja sobres|caja (de )?\d+ sobres|caja (de )?(36|18|24|30)( boosters| con promo)?$|caja (de )?(36|18|24|30) (con|sobres|boosters|ingles|espanol)|caja \d+ boosters|\d+ sobres caja|boite de \d+ boosters|half booster box|enhanced booster box|booster case box|ブースターボックス)\b|\b(expansion|booster|high class|enhanced expansion|enhanced) packs?\b.*\bbox(es)?\b|拡張パック.*box|パック.*box|확장팩.*(박스|box)|부스터 ?박스|(补充包|擴充包|扩充包).*(盒|box)|\bbox(es)?\b.*\b\d{1,2} ?x? (booster )?(packs?|sobres|boosters)\b|\b\d{1,2} (booster )?(packs?|sobres|boosters)\b.*\bbox\b|\bpacks? box\b|\bcaja\b.*\b(18|24|30|36) (sobres|boosters|packs)\b|\b(18|24|30|36) (sobres|boosters)\b.*\bcaja\b/],
  ['collection', /\b(collection|coleccion|colecciones|caja coleccion|box set|coffret|figure collection|pin collection|poster collection|binder collection|knock out collection|premium figure|ex box|v box|vmax box|vstar box|gx box|caja ex|caja v|caja gx|tech sticker|sticker collection|mini portfolio|portfolio set|caja)\b/],
  ['booster_pack', /\b(booster packs?|booster|sobres?|boosters?|packs?|paquete|sleeved booster|art pack)\b|拡張パック|強化拡張パック|ハイクラスパック|パック|확장팩|팩|补充包|擴充包|擴充包/],
];

/** Señales inequívocas de que NO es producto sellado de Pokémon (sueltas, gradeadas, otros TCG). */
export const HARD_EXCLUDE: [string, RegExp][] = [
  ['suelta', /\b\d{1,3}\s*\/\s*\d{2,3}\b/], // número de carta 199/165
  ['suelta', /\b(psa|bgs|cgc|beckett|graded|gradeada|gradeado|slab|carta suelta|cartas sueltas|single card|singles?|holo rare|reverse holo|full art|secret rare|illustration rare|special illustration rare|alt art|proxy|custom card|carta individual)\b/],
  ['suelta', /\b(svp|swshp?|smp|xyp|bwp|mep|black star promo)\s?\d{1,3}\b/],
  ['suelta', /\[[a-z0-9.]{1,6}[- ](pre )?\d{1,3}[a-z]?\]|\((?!pack|lote|caja|box|set|vol|ver|ed|sobres|tins?|latas?|cartas)[a-z]{2,4} \d{1,3}\)|#\d{1,4}\b/],
  ['suelta', /\((common|uncommon|rare|double rare|ultra rare|holo rare|rare holo|promo|illustration rare|art rare|super rare|secret|amazing rare|radiant rare|shiny rare|ace spec rare|hyper rare|mega attack rare|black white rare)\)/],
  ['suelta', /\b(near mint|lightly played|moderately played|heavily played|nm|lp|mp|hp|excellent|good condition|aog|gem mint|mint condition|unsealed)\b/],
  ['otro tcg', /\b(one piece|magic the gathering|mtg|yu gi oh|yugioh|lorcana|digimon|dragon ball|star wars unlimited|flesh and blood|union arena|weiss schwarz|riftbound|sorcery|metazoo|vanguard|cardfight|cfv|buddyfight|bfe|battle spirits|shadowverse|wixoss|duel masters|keyforge|grand archive|gundam|naruto|final fantasy|disney|harry potter|kpop|k pop|demon hunters|marvel|topps|panini|match attax|hololive|attack on titan|jujutsu|demon slayer|kayou)\b/],
  ['accesorio', /\b(acrylic|acrilico|acrilica|protector|protectores|magnetic|magnetico|magnetica|display holder|uv protection|empty tin only)\b/],
  ['usado', /\b(used|usado|usada|pre owned|preowned|second hand|segunda mano|damaged|danada|danado|box damage|caja danada|opened|abierto|abierta|roturas?|sellado roto|precinto roto|damaged seal|dented|abollad[oa]|desperfectos?|tara)\b/],
  ['código', /\b(online code|online codes|codigo online|codigos online|code card|code cards|ptcgl|tcg live code|tcgo)\b/],
  ['lote de tienda', /\b(mystery|misterio|misteriosa|misterioso|repack|repacks|re pack|lucky box|grab bag|value pack|god pack|pack opening|random packs|random booster|sobres aleatorios|ultra rare card bundle|hit bundle|bundle de cartas)\b/],
  ['vacío', /\b(empty|vacia|vacio|sin sobres|no cards|no packs|sin cartas|box only|solo caja|caja vacia)\b/],
];

/** Accesorios: se descartan salvo que el título indique claramente un producto sellado. */
export const ACCESSORY = /\b(sleeves?|fundas?|protectores?|card protectors?|binder|carpeta|album|deck box|deckbox|caja de mazo|caja para mazo|porta mazo|playmat|tapete|toploader|top loader|dice|dados|damage counters?|marcadores?|contadores?|peluche|plush|puzzle|camiseta|t shirt|hoodie|mug|taza|llavero|keychain|backpack|mochila|lamina|card storage|storage box|almacenamiento|acrylic|acrilico|magnetic|one touch|card saver|funko|lego|nanoblock|videojuego|nintendo switch|amiibo|manga|libro|ultra pro|dragon shield|ultimate guard|gamegenic|kmc|figura|peluches|pin badge|eraser|goma de borrar|lapiz|pencil|stationery|card frame|long card box|marco|poster|coin case|cuaderno|notebook)\b/;
export const STRONG_SEALED = /\b(collection|coleccion|elite trainer|etb|booster|sobres?|display|tins?|latas?|bundle|blister|premium|build and battle|baraja|deck box collection|pin blister)\b/;
