// Sincroniza el catálogo de colecciones (sets) de las tres "líneas" de producto:
//   intl → producto internacional (inglés y español comparten sets: me02, sv08…)
//   jp   → línea asiática (japonés; coreano y chino tradicional siguen los mismos sets: M2, SV8a…)
//   cn   → chino simplificado, que tiene sets propios (CSV…C)
// Fuentes: TCGdex (nombres en cada idioma, logos, fechas) y tcgcsv.com (espejo diario de TCGplayer:
// nombres en inglés de sets japoneses y sets internacionales anunciados que aún no están en TCGdex).
import type { DatabaseSync } from 'node:sqlite';
import { openDb, today, tx } from './lib/db.ts';
import { fetchJson, pool } from './lib/http.ts';
import { key, slug } from './lib/text.ts';
import { MANUAL_COLLECTIONS } from './classify/aliases.ts';

const TCGDEX = 'https://api.tcgdex.net/v2';
const TCGCSV = 'https://tcgcsv.com/tcgplayer';

type DexSetBrief = { id: string; name: string; cardCount?: { total?: number; official?: number } };
type DexSet = DexSetBrief & { releaseDate?: string; serie?: { id: string; name: string }; logo?: string; symbol?: string };
type Group = { groupId: number; name: string; abbreviation: string; publishedOn: string };

const NOT_A_SET = /promo|energ|trainer kit|mcdonald|deck|starter|half deck|trainer box|gift|battle master|vending|campaign|photo contest|battle road|challenge|fan club|championship|unnumbered|elementary|corocoro|hobby fair|design contest|information|blister|league battle|league promo|play pokemon league|prize pack|trick or trade|first partner|classic|miscellaneous|jumbo|world collection|professor|gallery|shiny vault|my first battle|pop series|\bbox\b|special set|special card set|family pokemon|battle academy|box collections/i;


async function dexList(lang: string): Promise<DexSetBrief[]> {
  return fetchJson<DexSetBrief[]>(`${TCGDEX}/${lang}/sets`);
}

function stripGroupPrefix(name: string): string {
  // "ME06: Delta Reign" → "Delta Reign"; "M2a: High Class Pack: MEGA Dream ex" → "High Class Pack: MEGA Dream ex"
  return name.replace(/^[A-Za-z0-9.\-]+:\s*/, '').trim();
}

function jpSeries(code: string): string {
  const c = code.toUpperCase();
  if (c.startsWith('SM')) return 'Sun & Moon';
  if (c.startsWith('SV')) return 'Scarlet & Violet';
  if (c.startsWith('M')) return 'MEGA';
  if (c.startsWith('S')) return 'Sword & Shield';
  if (c.startsWith('XY') || c.startsWith('CP')) return 'XY';
  if (c.startsWith('BW')) return 'Black & White';
  if (c.startsWith('L') || c.startsWith('HGSS')) return 'HeartGold & SoulSilver';
  if (c.startsWith('DP') || c.startsWith('PT')) return 'Diamond & Pearl';
  return 'Otros';
}

export async function syncCollections(db: DatabaseSync, log = console.log) {
  const t = today();
  const existing = new Map(
    (db.prepare('SELECT id, release_date FROM collections').all() as { id: string; release_date: string | null }[]).map((r) => [r.id, r]),
  );
  const rows: Record<string, any>[] = [];

  // ── Línea internacional (EN/ES) ───────────────────────────────────────────
  const [en, es, fr, de, it, pt] = await Promise.all(['en', 'es', 'fr', 'de', 'it', 'pt'].map(dexList));
  const byId = (list: DexSetBrief[]) => new Map(list.map((s) => [s.id, s.name]));
  const esN = byId(es), frN = byId(fr), deN = byId(de), itN = byId(it), ptN = byId(pt);

  const seriesList = await fetchJson<{ id: string; name: string }[]>(`${TCGDEX}/en/series`);
  const seriesEs = new Map((await fetchJson<{ id: string; name: string }[]>(`${TCGDEX}/es/series`)).map((s) => [s.id, s.name]));
  const intlSetSeries = new Map<string, { id: string; name: string; nameEs?: string }>();
  for (const s of seriesList) {
    const detail = await fetchJson<{ id: string; name: string; releaseDate?: string; sets: DexSetBrief[] }>(`${TCGDEX}/en/series/${s.id}`);
    // Todas las series de cartas físicas (también las antiguas: hay tiendas con producto vintage)
    if (['tcgp', 'misc', 'mc', 'tk', 'pop'].includes(s.id)) continue;
    for (const set of detail.sets) intlSetSeries.set(set.id, { id: s.id, name: s.name, nameEs: seriesEs.get(s.id) });
  }

  const intlCandidates = en.filter(
    (s) => intlSetSeries.has(s.id) && (s.cardCount?.official ?? 0) >= 15 && !NOT_A_SET.test(s.name),
  );
  const details = await pool(intlCandidates, 4, async (s) => {
    const id = `intl:${slug(s.name)}`;
    if (existing.get(id)?.release_date) return null; // ya lo tenemos completo
    try {
      return await fetchJson<DexSet>(`${TCGDEX}/en/sets/${s.id}`);
    } catch {
      return null;
    }
  });
  const intlNames = new Set<string>();
  intlCandidates.forEach((s, i) => {
    const d = details[i];
    const serie = intlSetSeries.get(s.id)!;
    const isBase = key(s.name) === key(serie.name) || (!!esN.get(s.id) && key(esN.get(s.id)!) === key(serie.nameEs ?? ''));
    intlNames.add(key(s.name));
    rows.push({
      id: `intl:${slug(s.name)}`,
      line: 'intl',
      code: s.id,
      series: serie.nameEs ?? serie.name,
      name_en: s.name,
      name_es: esN.get(s.id) ?? null,
      names_other: JSON.stringify({ fr: frN.get(s.id), de: deN.get(s.id), it: itN.get(s.id), pt: ptN.get(s.id) }),
      release_date: d?.releaseDate ?? null,
      logo: d?.logo ? `${d.logo}.png` : null,
      symbol: d?.symbol ? `${d.symbol}.png` : null,
      card_count: s.cardCount?.official ?? null,
      is_base: isBase ? 1 : 0,
    });
  });

  // Sets internacionales anunciados que TCGdex aún no tiene (preventas).
  const enGroups = (await fetchJson<{ results: Group[] }>(`${TCGCSV}/3/groups`)).results;
  // Enlace set de TCGdex ↔ grupo de TCGplayer, por nombre ("SV03: Obsidian Flames" ↔ "Obsidian Flames")
  const groupByName = new Map<string, number>();
  for (const g of enGroups) {
    if (NOT_A_SET.test(g.name) && !/^[A-Z]{2,4}\d/i.test(g.name)) continue;
    const k = key(stripGroupPrefix(g.name));
    if (!groupByName.has(k)) groupByName.set(k, g.groupId);
  }
  for (const r of rows) {
    if (r.line !== 'intl' || r.tcg_group) continue;
    const k = key(r.name_en);
    r.tcg_group = groupByName.get(k) ?? [...groupByName].find(([gk]) => gk.endsWith(` ${k}`) && k.length >= 3)?.[1] ?? null;
  }
  const recentCut = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  for (const g of enGroups) {
    const name = stripGroupPrefix(g.name);
    const date = g.publishedOn.slice(0, 10);
    // tcgcsv re-fecha grupos antiguos; los grupos de verdad nuevos tienen groupId alto y prefijo de set ("ME07: …").
    const isNewSet = g.groupId >= 24000 && /^[A-Z]{2,4}\d+[a-z]?:/i.test(g.name);
    if (date < recentCut || !isNewSet || NOT_A_SET.test(g.name) || intlNames.has(key(name))) continue;
    rows.push({
      id: `intl:${slug(name)}`,
      tcg_group: g.groupId,
      line: 'intl',
      code: g.abbreviation || null,
      series: /^ME/i.test(g.name) ? 'Megaevolución' : null,
      name_en: name,
      release_date: date,
    });
  }

  // ── Línea asiática (JA/KO/ZH-TW) ──────────────────────────────────────────
  const [ja, ko, tw] = await Promise.all(['ja', 'ko', 'zh-tw'].map(dexList));
  const byCode = (list: DexSetBrief[]) => new Map(list.map((s) => [s.id.toLowerCase(), s.name]));
  const jaN = byCode(ja), koN = byCode(ko), twN = byCode(tw);
  const jpGroups = (await fetchJson<{ results: Group[] }>(`${TCGCSV}/85/groups`)).results;
  for (const g of jpGroups) {
    const date = g.publishedOn.slice(0, 10);
    if (!g.abbreviation || NOT_A_SET.test(g.name)) continue;
    const code = g.abbreviation.toLowerCase();
    const nameEn = stripGroupPrefix(g.name);
    const extra = nameEn.startsWith('High Class Pack:') ? [nameEn.replace('High Class Pack:', '').trim()] : [];
    rows.push({
      id: `jp:${code}`,
      tcg_group: g.groupId,
      line: 'jp',
      code: g.abbreviation.replace(/^m/, 'M'),
      series: jpSeries(code),
      name_en: nameEn,
      name_ja: jaN.get(code) ?? null,
      name_ko: koN.get(code) ?? null,
      name_zh: twN.get(code) ?? null,
      aliases: JSON.stringify(extra),
      release_date: date,
    });
  }

  // ── Chino simplificado ─────────────────────────────────────────────────────
  const cn = await dexList('zh-cn');
  const seenCn = new Set<string>();
  const cnDetails = await pool(cn, 4, async (s) => {
    const id = `cn:${s.id.toLowerCase()}`;
    if (seenCn.has(id) || existing.get(id)?.release_date) return null;
    seenCn.add(id);
    try {
      return await fetchJson<DexSet>(`${TCGDEX}/zh-cn/sets/${s.id}`);
    } catch {
      return null;
    }
  });
  cn.forEach((s, i) => {
    // TCGdex mezcla aquí algunos sets de chino tradicional (SV7…) y duplicados en minúscula: sólo códigos "C…" propios
    if (/promo|特典|能量/i.test(s.name) || !/^C[A-Z]/.test(s.id)) return;
    rows.push({
      id: `cn:${s.id.toLowerCase()}`,
      line: 'cn',
      code: s.id,
      series: s.id.startsWith('CSV') ? '朱&紫' : s.id.startsWith('CS') ? '剑&盾' : null,
      name_zh: s.name,
      release_date: cnDetails[i]?.releaseDate ?? null,
      card_count: s.cardCount?.official ?? null,
    });
  });

  // ── Colecciones añadidas a mano (las fuentes aún no las tienen) ─────────────
  for (const m of MANUAL_COLLECTIONS) rows.push({ ...m, aliases: JSON.stringify(m.aliases ?? []) });

  // ── Volcado ────────────────────────────────────────────────────────────────
  const cols = ['tcg_group', 'line', 'code', 'series', 'name_en', 'name_es', 'name_ja', 'name_ko', 'name_zh', 'names_other', 'aliases', 'release_date', 'logo', 'symbol', 'card_count', 'is_base'];
  const upsert = db.prepare(`
    INSERT INTO collections (id, ${cols.join(', ')}, first_seen)
    VALUES (?, ${cols.map(() => '?').join(', ')}, ?)
    ON CONFLICT(id) DO UPDATE SET ${cols.map((c) => `${c} = COALESCE(excluded.${c}, ${c})`).join(', ')}
  `);
  let added = 0;
  const newOnes: string[] = [];
  tx(db, () => {
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      if (!existing.has(r.id)) {
        added++;
        newOnes.push(r.name_en ?? r.name_zh ?? r.id);
      }
      upsert.run(r.id, ...cols.map((c) => r[c] ?? (c === 'is_base' ? 0 : null)), t);
    }
  });
  log(`Colecciones: ${rows.length} procesadas, ${added} nuevas${newOnes.length && existing.size ? ': ' + newOnes.slice(0, 10).join(', ') : ''}`);
  return { total: rows.length, added, newOnes };
}

if (import.meta.main) {
  const db = openDb();
  await syncCollections(db);
}
