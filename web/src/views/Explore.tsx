import { useMemo, useState } from 'react';
import { buildGroups, collectionName, LANG_NAME, LINES_FOR_LANG, norm, offersByOrigin, type Data, type Group, type Lang } from '../data.ts';
import { setParam, type Route } from '../router.ts';
import { ProductCard, SearchIcon, Segmented } from '../components/ui.tsx';

const SORTS = [
  { id: 'rel', label: 'Novedad de la colección' },
  { id: 'price', label: 'Precio: de menor a mayor' },
  { id: 'price-desc', label: 'Precio: de mayor a menor' },
  { id: 'drop', label: 'Mayor bajada reciente' },
  { id: 'stores', label: 'Más tiendas' },
];

export function Explore({ data, route }: { data: Data; route: Route }) {
  const p = route.params;
  const q = p.get('q') ?? '';
  const l = (p.get('l') ?? 'all') as Lang | 'all';
  const ty = p.get('ty') ?? 'all';
  const col = p.get('col') ?? 'all';
  const store = p.get('s') ?? 'all';
  const stock = p.get('stock') === '1';
  const sort = p.get('sort') ?? 'rel';
  const [limit, setLimit] = useState(96);
  const set = (k: string, v: string | null) => {
    setLimit(96);
    setParam(route, { [k]: v === 'all' ? null : v });
  };

  // Grupos que pasan todos los filtros salvo el indicado (para contar opciones)
  const pass = (g: Group, skip?: string) => {
    if (skip !== 'l' && l !== 'all' && g.l !== l) return false;
    if (skip !== 'ty' && ty !== 'all' && g.ty !== ty) return false;
    if (skip !== 'col' && col !== 'all' && (col === 'none' ? g.col !== null : g.col?.id !== col)) return false;
    if (skip !== 's' && store !== 'all' && !g.offers.some((o) => o.s === store)) return false;
    if (stock && !g.available) return false;
    return true;
  };
  const origin = p.get('o');
  const baseGroups = useMemo(
    () => (origin === 'es' || origin === 'eu' ? buildGroups(offersByOrigin(data, origin), data.colById, data.typeLabel) : data.groups),
    [data, origin],
  );
  const tokens = norm(q).split(' ').filter(Boolean);
  const searched = useMemo(() => (tokens.length ? baseGroups.filter((g) => tokens.every((t) => g.search.includes(t))) : baseGroups), [baseGroups, q]);

  const results = searched.filter((g) => pass(g));
  const typeOrder = new Map(data.catalog.productTypes.map((t, i) => [t.id, i]));
  results.sort((a, b) => {
    if (sort === 'price') return a.best.p - b.best.p;
    if (sort === 'price-desc') return b.best.p - a.best.p;
    if (sort === 'drop') return (b.dropPct ?? -9) - (a.dropPct ?? -9);
    if (sort === 'stores') return b.storeCount - a.storeCount || a.best.p - b.best.p;
    return (
      (b.col?.date ?? '0').localeCompare(a.col?.date ?? '0') ||
      (typeOrder.get(a.ty) ?? 99) - (typeOrder.get(b.ty) ?? 99) ||
      Number(b.available) - Number(a.available) ||
      a.best.p - b.best.p
    );
  });

  const count = (skip: string, fn: (g: Group) => boolean) => searched.filter((g) => pass(g, skip) && fn(g)).length;
  const langs = data.catalog.languages;

  // Colecciones con producto para el idioma elegido, agrupadas por serie
  const colCounts = new Map<string, number>();
  for (const g of searched) if (pass(g, 'col')) colCounts.set(g.col?.id ?? 'none', (colCounts.get(g.col?.id ?? 'none') ?? 0) + 1);
  const lines = l === 'all' ? null : LINES_FOR_LANG[l];
  const colOptions = data.catalog.collections.filter((c) => colCounts.has(c.id) && (!lines || lines.includes(c.line)));
  const bySeries = new Map<string, typeof colOptions>();
  for (const c of colOptions) {
    const k = `${c.line === 'intl' ? '' : c.line === 'jp' ? 'Japón · ' : 'China · '}${c.series ?? 'Otras'}`;
    if (!bySeries.has(k)) bySeries.set(k, []);
    bySeries.get(k)!.push(c);
  }
  const storesWith = data.catalog.stores.filter((s) => searched.some((g) => pass(g, 's') && g.offers.some((o) => o.s === s.id)));

  const active = [l !== 'all', ty !== 'all', col !== 'all', store !== 'all', stock, !!q, !!origin].filter(Boolean).length;

  return (
    <>
      <div className="wrap page-title">
        <h1>Explorar</h1>
        <p>
          {l === 'all' ? 'Todo el producto sellado' : `Producto en ${LANG_NAME[l].toLowerCase()}`}, agrupado por colección, gama e idioma, con el precio más bajo
          primero.
        </p>
      </div>

      <div className="filters">
        <div className="wrap">
          <div className="row">
            <Segmented
              value={l}
              onChange={(v) => setParam(route, { l: v === 'all' ? null : v, col: null })}
              options={[{ id: 'all', label: 'Todos' }, ...langs.map((x) => ({ id: x.id, label: x.id.toUpperCase() }))] as { id: Lang | 'all'; label: string }[]}
            />
            <div className="search compact grow">
              <SearchIcon size={15} />
              <input
                value={q}
                placeholder="Buscar colección, Pokémon o producto"
                onChange={(e) => setParam(route, { q: e.target.value || null })}
                aria-label="Buscar"
              />
            </div>
            <select className="select" value={col} onChange={(e) => set('col', e.target.value)} aria-label="Colección">
              <option value="all">Todas las colecciones</option>
              {[...bySeries].map(([series, cols]) => (
                <optgroup key={series} label={series}>
                  {cols.map((c) => (
                    <option key={c.id} value={c.id}>
                      {collectionName(c, l === 'all' ? 'ui' : l)}
                      {c.code ? ` (${c.code})` : ''} · {colCounts.get(c.id)}
                    </option>
                  ))}
                </optgroup>
              ))}
              {colCounts.has('none') && <option value="none">Sin colección asignada · {colCounts.get('none')}</option>}
            </select>
            <select className="select" value={store} onChange={(e) => set('s', e.target.value)} aria-label="Tienda">
              <option value="all">Todas las tiendas</option>
              {storesWith.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <div className="chips grow">
              <button className={`chip ${ty === 'all' ? 'on' : ''}`} onClick={() => set('ty', 'all')}>
                Todas las gamas
              </button>
              {data.catalog.productTypes.map((t) => {
                const n = count('ty', (g) => g.ty === t.id);
                if (!n && ty !== t.id) return null;
                return (
                  <button key={t.id} className={`chip ${ty === t.id ? 'on' : ''}`} onClick={() => set('ty', ty === t.id ? 'all' : t.id)}>
                    {t.label}
                    <span className="n">{n}</span>
                  </button>
                );
              })}
            </div>
            <Segmented
              value={origin === 'es' || origin === 'eu' ? origin : 'all'}
              onChange={(v) => set('o', v)}
              options={[
                { id: 'all', label: 'Todo el mundo' },
                { id: 'eu', label: 'UE · sin aduana' },
                { id: 'es', label: 'España' },
              ]}
            />
            <label className="toggle">
              <input type="checkbox" checked={stock} onChange={(e) => set('stock', e.target.checked ? '1' : null)} />
              Sólo con stock
            </label>
            <select className="select" value={sort} onChange={(e) => set('sort', e.target.value === 'rel' ? null : e.target.value)} aria-label="Orden">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="wrap">
        <div className="result-meta">
          <span>
            {results.length.toLocaleString('es-ES')} {results.length === 1 ? 'producto' : 'productos'} · {results.reduce((a, g) => a + g.offers.length, 0).toLocaleString('es-ES')}{' '}
            ofertas
          </span>
          {active > 0 && (
            <button className="link" onClick={() => setParam(route, { q: null, l: null, ty: null, col: null, s: null, stock: null, o: null })}>
              Quitar filtros
            </button>
          )}
        </div>
        {results.length ? (
          <div className="grid">
            {results.slice(0, limit).map((g) => (
              <ProductCard key={g.key} g={g} data={data} route={route} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>Nada por aquí.</h3>
            <p>Ninguna tienda tiene ahora mismo un producto con estos filtros.</p>
          </div>
        )}
        {results.length > limit && (
          <div style={{ textAlign: 'center', paddingBottom: 80 }}>
            <button className="btn" onClick={() => setLimit(limit + 96)}>
              Mostrar más
            </button>
          </div>
        )}
      </div>
    </>
  );
}
