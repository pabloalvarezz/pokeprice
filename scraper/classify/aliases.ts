// Alias manuales: nombres con los que las tiendas llaman a una colección y que las fuentes no traen.
// Se amplía viendo los títulos que quedan "sin colección" en data/unmatched.txt tras cada actualización.

export const EXTRA_ALIASES: Record<string, string[]> = {
  // Internacional (EN/ES)
  'intl:151': ['scarlet violet 151', 'escarlata purpura 151', 'sv 151', 'mew 151'],
  'intl:prismatic-evolutions': ['prismatic evolution', 'evoluciones prismaticas', 'evolucion prismatica'],
  'intl:destined-rivals': ['rivales predestinados'],
  'intl:black-bolt': ['fulgor negro', 'rayo negro'],
  'intl:white-flare': ['llama blanca', 'llamarada blanca'],
  'intl:phantasmal-flames': ['llamas fantasmales', 'fuegos fantasmales'],
  'intl:ascended-heroes': ['heroes ascendentes', 'heroes ascendidos', 'ascenso heroico'],
  'intl:mega-evolution': ['mega evolucion', 'mega evolution', 'megaevolutions', 'mega evolutions', 'megaevoluciones'],
  'intl:journey-together': ['aventuras compartidas', 'juntos de aventuras', 'journing together'],
  'intl:shrouded-fable': ['fabula sombria', 'fabulas sombrias'],
  'intl:paldean-fates': ['destinos de paldea', 'paldean fate'],
  'intl:pokemon-go': ['pokemon go'],
  'intl:celebrations': ['celebraciones 25 aniversario', '25th anniversary celebrations'],
  'intl:crown-zenith': ['cenit supremo', 'zenit supremo', 'zenith supremo'],
  'intl:paldea-evolved': ['evoluciones de paldea', 'evoluciones paldea', 'evolucion de paldea', 'evoluciones en paldea'],
  'intl:30th-celebration': ['30th anniversary celebration', 'celebracion 30 aniversario', '30 aniversario', '30th celebration', '30th anniversary', '30 anniversary', 'aniversario 30'],

  // Japón (JA/KO/ZH-TW)
  'jp:sv2a': ['151', 'pokemon card 151', 'card 151'],
  'jp:sv8a': ['terastal festival', 'terastal festival ex', 'terastal fest', 'terastal festiva'],
  'jp:sv4a': ['shiny treasure', 'shiny treasure ex'],
  'jp:sv6': ['mask of change', 'transformation mask'],
  'jp:sv5k': ['wild force'],
  'jp:sv5m': ['cyber judge'],
  'jp:sv7a': ['paradise dragona'],
  'jp:sv8': ['super electric breaker'],
  'jp:sv10': ['glory of team rocket', 'team rocket glory', 'rocket gang glory'],
  'jp:s12a': ['vstar universe'],
  'jp:s4a': ['shiny star v'],
  'jp:m2a': ['mega dream', 'mega dream ex'],
  'jp:m1l': ['mega brave'],
  'jp:m1s': ['mega symphonia'],
  'jp:m6a': ['mega expansion 30th celebration', '30th celebration', '30th anniversary', '30 aniversario', 'celebracion 30 aniversario', '30 anniversary', 'aniversario 30'],
  'jp:s8b': ['vmax climax', 'climax vmax'],
  'jp:sm11b': ['dream league'],
  'cn:csv1c': ['eternal birth', 'ancient origins c'],
  'cn:csv5c': ['dark crystal blaze'],
  'cn:csv7c': ['blade awakening'],
  'cn:csv9c': ['stellar crystal'],
  'cn:csv9.5c': ['terastal gathering', 'terastal grand gathering'],
  'jp:s2': ['rebellion clash'],
  'jp:m6': ['storm emerald', 'storm emeralda'],
  'jp:s6a': ['eevee heroes', 'evee heroes', 'eevee hero'],
  'jp:sv1a': ['triplet beat', 'triple beat'],
  'jp:sv9a': ['heat wave arena', 'heatwave arena'],
  'jp:s5i': ['single strike master', 'ichigeki master', 'ichigeki'],
  'jp:s5r': ['rapid strike master', 'rengeki master', 'rengeki'],
  'jp:sv11w': ['white flare', 'white flame'],
  'intl:chilling-reign': ['reinado escalofriante', 'chillign reign'],
  'jp:sm6b': ['champion road'],
  'jp:s10b': ['pokemon go'],
};

/** Alias demasiado genéricos que provocan falsos positivos. */
export const BLOCKED_ALIASES = new Set<string>([
  'shield',
  'sword',
  'team rocket', // set vintage; choca con productos modernos del Team Rocket
  'base',
  'promo',
  'collection',
  'coleccion',
  'evolution',
  'box',
  'set',
  'deck',
  'starter',
  'premium',
]);

/** Colecciones que las fuentes aún no incluyen (sobre todo chino simplificado). Fecha desconocida → null. */
export const MANUAL_COLLECTIONS: { id: string; line: 'intl' | 'jp' | 'cn'; code: string; name_en?: string; name_zh?: string; series?: string; aliases?: string[] }[] = [
  { id: 'cn:csv10c', line: 'cn', code: 'CSV10C', name_en: 'Chasing Glory', series: '朱&紫', aliases: ['chasing glory', 'pursue glory together', 'pursuing glory'] },
  { id: 'cn:cbb6c', line: 'cn', code: 'CBB6C', name_en: 'Gem Pack Vol. 6', name_zh: '宝石包 Vol.6', series: '宝石包', aliases: ['gem pack vol 6', 'gem pack volume 6', 'gem pack 6'] },
  { id: 'cn:cbb7c', line: 'cn', code: 'CBB7C', name_en: 'Gem Pack Vol. 7', name_zh: '宝石包 Vol.7', series: '宝石包', aliases: ['gem pack vol 7', 'gem pack volume 7', 'gem pack 7'] },
  { id: 'cn:cbb1c', line: 'cn', code: 'CBB1C', name_en: 'Gem Pack Vol. 1', name_zh: '宝石包 Vol.1', series: '宝石包', aliases: ['gem pack vol 1', 'gem pack volume 1', 'gem pack 1'] },
  { id: 'cn:151c', line: 'cn', code: '151C', name_en: '151 Collect', name_zh: '宝可梦卡牌 151C', series: '朱&紫', aliases: ['151c', '151 c', '151 collect', '151c hope'] },
];
