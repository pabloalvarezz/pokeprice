import { useState } from 'react';
import { collectionName, daysSince, fmtDate, LANG_NAME, type Data, type Lang } from '../data.ts';
import { go, href, type Route } from '../router.ts';
import { ProductCard, SearchIcon, SeeAll, isFirstDay } from '../components/ui.tsx';
import { ChangeList, collectChanges } from './Changes.tsx';

export function Home({ data, route }: { data: Data; route: Route }) {
  const [q, setQ] = useState('');
  const { groups, catalog, offers } = data;
  const activeStores = catalog.stores.filter((s) => s.enabled && s.count > 0).length;

  const perLang = new Map<Lang, number>();
  for (const g of groups) perLang.set(g.l, (perLang.get(g.l) ?? 0) + 1);

  // Colecciones recientes o por salir que ya tienen producto (o preventa)
  const withProduct = new Set(groups.map((g) => g.col?.id).filter(Boolean));
  const recentCols = catalog.collections
    .filter((c) => withProduct.has(c.id) && (c.date ?? '') >= new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10))
    .slice(0, 14);

  const drops = collectChanges(data, 7).filter((c) => c.delta < 0).slice(0, 6);
  const firstDay = isFirstDay(data);
  const fresh = firstDay
    ? [...groups].filter((g) => g.available && g.col).sort((a, b) => (b.col?.date ?? '').localeCompare(a.col?.date ?? '') || b.storeCount - a.storeCount).slice(0, 8)
    : [...groups].filter((g) => daysSince(g.firstSeen) <= 7).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen)).slice(0, 8);

  return (
    <>
      <section className="hero wrap">
        <p className="eyebrow">Pokémon TCG · Envío a España</p>
        <h1>Todos los precios. Un solo lugar.</h1>
        <p className="lead">
          Producto sellado en español, inglés, japonés, chino y coreano, comparado cada día en {activeStores} tiendas.
        </p>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            go('explorar', { q: q.trim() || null });
          }}
        >
          <SearchIcon size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fuegos Fantasmales, Inferno X, ETB…" aria-label="Buscar" />
        </form>
        <div className="stats">
          <div className="stat">
            <b>{groups.length.toLocaleString('es-ES')}</b>
            <span>productos</span>
          </div>
          <div className="stat">
            <b>{offers.length.toLocaleString('es-ES')}</b>
            <span>precios seguidos</span>
          </div>
          <div className="stat">
            <b>{activeStores}</b>
            <span>tiendas</span>
          </div>
          <div className="stat">
            <b>{withProduct.size}</b>
            <span>colecciones</span>
          </div>
        </div>
      </section>

      <section className="band alt">
        <div className="wrap">
          <div className="section-head">
            <h2>Por idioma.</h2>
            <SeeAll to="cobertura">Ver qué falta en cada idioma</SeeAll>
          </div>
          <div className="lang-tiles">
            {catalog.languages.map((l) => (
              <a key={l.id} className="lang-tile" href={href('explorar', { l: l.id })}>
                <div className="code">{l.id.toUpperCase()}</div>
                <div className="name">{LANG_NAME[l.id]}</div>
                <div className="count">{(perLang.get(l.id) ?? 0).toLocaleString('es-ES')} productos</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {recentCols.length > 0 && (
        <section className="band">
          <div className="wrap">
            <div className="section-head">
              <h2>Colecciones recientes.</h2>
              <SeeAll to="cobertura">Todas</SeeAll>
            </div>
            <div className="rail">
              {recentCols.map((c) => {
                const lang: Lang = c.line === 'intl' ? 'es' : c.line === 'jp' ? 'ja' : 'zh';
                const n = groups.filter((g) => g.col?.id === c.id).length;
                return (
                  <a key={c.id} className="col-card" href={href('explorar', { col: c.id })}>
                    <div className="logo">{c.logo ? <img src={c.logo} alt="" loading="lazy" /> : <span className="code">{c.code}</span>}</div>
                    <div className="nm">{collectionName(c, lang)}</div>
                    <div className="meta">
                      {c.line === 'intl' ? 'ES · EN' : c.line === 'jp' ? 'JA · KO · ZH' : 'ZH'} · {n} {n === 1 ? 'producto' : 'productos'}
                      <br />
                      {c.upcoming ? `Sale el ${fmtDate(c.date)}` : fmtDate(c.date)}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="band alt">
          <div className="wrap">
            <div className="section-head">
              <h2>Bajadas de precio.</h2>
              <SeeAll to="cambios">Ver todos los cambios</SeeAll>
            </div>
            <ChangeList data={data} route={route} items={drops} />
          </div>
        </section>
      )}

      {fresh.length > 0 && (
        <section className="band">
          <div className="wrap">
            <div className="section-head">
              <h2>{firstDay ? 'Lo último en tiendas.' : 'Recién llegados.'}</h2>
              <SeeAll to="explorar">Explorar todo</SeeAll>
            </div>
            <div className="grid" style={{ paddingBottom: 0 }}>
              {fresh.map((g) => (
                <ProductCard key={g.key} g={g} data={data} route={route} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
