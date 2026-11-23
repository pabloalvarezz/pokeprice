import { useMemo } from 'react';
import { collectionLocalName, collectionName, collectionVisual, fmtDate, fmtEur, LANG_SHORT, type Collection, type Data, type Lang } from '../data.ts';
import { href, setParam, type Route } from '../router.ts';
import { Segmented } from '../components/ui.tsx';

const LINES = [
  { id: 'intl', label: 'Internacional · ES EN', langs: ['es', 'en'] as Lang[] },
  { id: 'jp', label: 'Japón · JP KR CH', langs: ['ja', 'ko', 'zh'] as Lang[] },
  { id: 'cn', label: 'China · CH', langs: ['zh'] as Lang[] },
];

type Stats = { products: number; langs: Map<Lang, number>; boxFrom: number | null };

export function Collections({ data, route }: { data: Data; route: Route }) {
  const line = route.params.get('linea') ?? 'intl';
  const series = route.params.get('serie') ?? 'all';
  const all = route.params.get('todas') === '1';
  const def = LINES.find((l) => l.id === line) ?? LINES[0];

  const stats = useMemo(() => {
    const m = new Map<string, Stats>();
    for (const g of data.groups) {
      if (!g.col) continue;
      let s = m.get(g.col.id);
      if (!s) m.set(g.col.id, (s = { products: 0, langs: new Map(), boxFrom: null }));
      s.products++;
      s.langs.set(g.l, (s.langs.get(g.l) ?? 0) + 1);
      if (g.ty === 'booster_box' && !g.v && g.available) s.boxFrom = s.boxFrom == null ? g.best.p : Math.min(s.boxFrom, g.best.p);
    }
    return m;
  }, [data]);

  const cols = data.catalog.collections.filter((c) => c.line === def.id && (all || stats.has(c.id) || c.upcoming));
  const seriesList = [...new Set(cols.map((c) => c.series ?? 'Otras'))];
  const visible = cols.filter((c) => series === 'all' || (c.series ?? 'Otras') === series);
  const groupsBySeries = new Map<string, Collection[]>();
  for (const c of visible) {
    const k = c.series ?? 'Otras';
    if (!groupsBySeries.has(k)) groupsBySeries.set(k, []);
    groupsBySeries.get(k)!.push(c);
  }
  const uiLang: Lang | 'ui' = def.id === 'intl' ? 'es' : def.langs[0];

  return (
    <>
      <div className="wrap page-title">
        <h1>Colecciones</h1>
        <p>Todas las expansiones, de la más reciente a la más antigua. Entra en una para ver sus productos y precios en cada idioma.</p>
      </div>
      <div className="wrap legend" style={{ paddingTop: 26 }}>
        <Segmented value={def.id} onChange={(v) => setParam(route, { linea: v === 'intl' ? null : v, serie: null })} options={LINES.map((l) => ({ id: l.id, label: l.label }))} />
        <select className="select" value={series} onChange={(e) => setParam(route, { serie: e.target.value === 'all' ? null : e.target.value })} aria-label="Serie">
          <option value="all">Todas las series</option>
          {seriesList.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={all} onChange={(e) => setParam(route, { todas: e.target.checked ? '1' : null })} />
          Incluir colecciones sin producto
        </label>
        <span style={{ marginLeft: 'auto' }}>{visible.length} colecciones</span>
      </div>

      <div className="wrap">
        {[...groupsBySeries].map(([s, list]) => (
          <section key={s} style={{ paddingBottom: 18 }}>
            <div className="section-head" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 26 }}>{s}</h2>
            </div>
            <div className="col-grid" style={{ paddingBottom: 30 }}>
              {list.map((c) => {
                const st = stats.get(c.id);
                const v = collectionVisual(data, c, uiLang);
                const local = collectionLocalName(c, uiLang);
                return (
                  <a key={c.id} className="col-tile glass" href={href('explorar', { col: c.id })}>
                    <div className="visual">
                      {v.art && <div className="bgart" style={{ backgroundImage: `url("${v.art}")` }} />}
                      {v.logo && <div className="bgart" style={{ backgroundImage: `url("${v.logo}")`, opacity: 0.35 }} />}
                      {v.logo ? (
                        <img className="logo" src={v.logo} alt="" loading="lazy" />
                      ) : v.art ? (
                        <img className="art" src={v.art} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="code">{c.code}</span>
                      )}
                      {(c.upcoming || c.isNew) && <span className="badge new tag">{c.upcoming ? 'Próximamente' : 'Nueva'}</span>}
                    </div>
                    <div className="info">
                      <span className="nm">{collectionName(c, uiLang)}</span>
                      {local && <span className="local">{local}</span>}
                      <span className="local">
                        {c.code ? `${c.code} · ` : ''}
                        {c.upcoming ? `Sale el ${fmtDate(c.date)}` : fmtDate(c.date, { month: 'long', year: 'numeric' })}
                      </span>
                      <div className="meta">
                        <span className="langdots">
                          {def.langs.map((l) => (
                            <span key={l} className={st?.langs.get(l) ? 'on' : ''} title={`${st?.langs.get(l) ?? 0} productos`}>
                              {LANG_SHORT[l]}
                            </span>
                          ))}
                        </span>
                        <span>
                          {st ? `${st.products} prod.` : 'Sin producto'}
                          {st?.boxFrom != null ? ` · caja ${fmtEur(st.boxFrom)}` : ''}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
