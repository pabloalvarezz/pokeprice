import { useMemo } from 'react';
import { buildGroups, collectionLocalName, collectionName, COLUMNS_FOR_LANG, fmtDate, fmtEur, LANG_NAME, LINES_FOR_LANG, offersByOrigin, type Collection, type Data, type Group, type Lang } from '../data.ts';
import { go, setParam, type Route } from '../router.ts';
import { Segmented } from '../components/ui.tsx';

type Cell = { min: number | null; minAny: number; stores: Set<string>; products: number };

export function Coverage({ data, route }: { data: Data; route: Route }) {
  const lang = (route.params.get('l') ?? 'es') as Lang;
  const series = route.params.get('serie') ?? 'all';
  const gapsOnly = route.params.get('huecos') === '1';
  const withOffersOnly = route.params.get('todas') !== '1';
  const origin = route.params.get('o');
  const cols = COLUMNS_FOR_LANG[lang];

  const { matrix, rows, seriesList, loose } = useMemo(() => {
    const groups = origin === 'es' || origin === 'eu' ? buildGroups(offersByOrigin(data, origin), data.colById, data.typeLabel) : data.groups;
    // En cada celda manda la variante estándar (sin "media caja", "Pokémon Center", lotes…) si existe
    const standard = new Set(groups.filter((g) => g.l === lang && g.col && !g.v).map((g) => `${g.col!.id}|${g.ty}`));
    const matrix = new Map<string, Cell>();
    const loose = new Map<string, Cell>();
    for (const g of groups) {
      if (g.l !== lang) continue;
      if (g.col && g.v && standard.has(`${g.col.id}|${g.ty}`)) continue;
      const target = g.col ? matrix : loose;
      const k = g.col ? `${g.col.id}|${g.ty}` : g.ty;
      let cell = target.get(k);
      if (!cell) target.set(k, (cell = { min: null, minAny: Infinity, stores: new Set(), products: 0 }));
      cell.products++;
      for (const o of g.offers) {
        if (o.x) continue; // precio anómalo
        cell.stores.add(o.s);
        cell.minAny = Math.min(cell.minAny, o.p);
        if (o.a) cell.min = cell.min == null ? o.p : Math.min(cell.min, o.p);
      }
    }
    const lines = LINES_FOR_LANG[lang];
    const all = data.catalog.collections.filter((c) => lines.includes(c.line));
    const hasAny = (c: Collection) => cols.some((t) => matrix.has(`${c.id}|${t}`));
    const rows = all.filter((c) => !withOffersOnly || hasAny(c) || c.upcoming || (c.date ?? '') >= new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10));
    const seriesList = [...new Set(rows.map((c) => c.series ?? 'Otras'))];
    return { matrix, rows, seriesList, loose };
  }, [data, lang, withOffersOnly, origin]);

  const visible = rows.filter((c) => series === 'all' || (c.series ?? 'Otras') === series);
  let covered = 0;
  for (const c of visible) for (const t of cols) if (matrix.has(`${c.id}|${t}`)) covered++;
  const total = visible.length * cols.length;

  const open = (params: Record<string, string>) => go('explorar', { l: lang, o: origin, ...params });
  const short = new Map(data.catalog.productTypes.map((t) => [t.id, t.label]));

  const renderCell = (cell: Cell | undefined, onClick: () => void) => {
    if (!cell) return <span className={`cell miss ${gapsOnly ? 'hl' : ''}`}>{gapsOnly ? 'Falta' : '—'}</span>;
    const oos = cell.min == null;
    return (
      <button className={`cell ${oos ? 'oos' : ''}`} onClick={onClick} title={`${cell.products} producto(s) en ${cell.stores.size} tienda(s)`}>
        <b>{fmtEur(oos ? cell.minAny : cell.min)}</b>
        <span>{oos ? 'agotado' : `${cell.stores.size} ${cell.stores.size === 1 ? 'tienda' : 'tiendas'}`}</span>
      </button>
    );
  };

  let lastSeries = '';
  return (
    <>
      <div className="wrap page-title">
        <h1>Cobertura</h1>
        <p>Cada colección frente a cada gama de producto. Los huecos son lo que ninguna tienda que envía a España tiene a la venta ahora mismo.</p>
      </div>
      <div className="wrap">
        <div className="legend" style={{ paddingTop: 28 }}>
          <Segmented
            value={lang}
            onChange={(v) => setParam(route, { l: v === 'es' ? null : v, serie: null })}
            options={data.catalog.languages.map((l) => ({ id: l.id, label: LANG_NAME[l.id] }))}
          />
          <select className="select" value={series} onChange={(e) => setParam(route, { serie: e.target.value === 'all' ? null : e.target.value })} aria-label="Serie">
            <option value="all">Todas las series</option>
            {seriesList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Segmented
            value={origin === 'es' || origin === 'eu' ? origin : 'all'}
            onChange={(v) => setParam(route, { o: v === 'all' ? null : v })}
            options={[
              { id: 'all', label: 'Todo el mundo' },
              { id: 'eu', label: 'UE' },
              { id: 'es', label: 'España' },
            ]}
          />
          <label className="toggle">
            <input type="checkbox" checked={gapsOnly} onChange={(e) => setParam(route, { huecos: e.target.checked ? '1' : null })} />
            Resaltar huecos
          </label>
          <label className="toggle">
            <input type="checkbox" checked={!withOffersOnly} onChange={(e) => setParam(route, { todas: e.target.checked ? '1' : null })} />
            Incluir colecciones sin producto
          </label>
          <span style={{ marginLeft: 'auto' }}>
            {covered} de {total} combinaciones con producto
            <span className="coverage-bar">
              <div style={{ width: `${total ? (covered / total) * 100 : 0}%` }} />
            </span>
          </span>
        </div>

        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th>Colección</th>
                {cols.map((t) => (
                  <th key={t}>{short.get(t)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const s = c.series ?? 'Otras';
                const header =
                  s !== lastSeries ? (
                    <tr className="series" key={`s-${s}`}>
                      <th colSpan={cols.length + 1}>{s}</th>
                    </tr>
                  ) : null;
                lastSeries = s;
                const local = collectionLocalName(c, lang);
                return [
                  header,
                  <tr key={c.id}>
                    <th>
                      {c.code && <span className="code">{c.code}</span>}
                      {collectionName(c, lang)}
                      <span className="date">
                        {local ? `${local} · ` : ''}
                        {c.upcoming ? `Sale el ${fmtDate(c.date)}` : fmtDate(c.date, { month: 'short', year: 'numeric' })}
                      </span>
                    </th>
                    {cols.map((t) => (
                      <td key={t}>{renderCell(matrix.get(`${c.id}|${t}`), () => open({ col: c.id, ty: t }))}</td>
                    ))}
                  </tr>,
                ];
              })}
              {series === 'all' && (
                <>
                  <tr className="series">
                    <th colSpan={cols.length + 1}>Sin colección asignada (productos especiales o títulos sin reconocer)</th>
                  </tr>
                  <tr>
                    <th>Otros productos</th>
                    {cols.map((t) => (
                      <td key={t}>{loose.has(t) ? renderCell(loose.get(t), () => open({ col: 'none', ty: t })) : <span className="cell miss">—</span>}</td>
                    ))}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export type { Group };
