import { useState } from 'react';
import { collectionLocalName, collectionName, collectionVisual, daysSince, fmtDate, LANG_FLAG, LANG_NAME, LANG_SHORT, LINE_LANGS, type Data, type Lang } from '../data.ts';
import { go, href, type Route } from '../router.ts';
import { ProductCard, SearchIcon, SeeAll, isFirstDay } from '../components/ui.tsx';
import { ChangeList, collectChanges } from './Changes.tsx';

export function Home({ data, route }: { data: Data; route: Route }) {
  const [q, setQ] = useState('');
  const { groups, catalog, offers } = data;
  const activeStores = catalog.stores.filter((s) => s.enabled && s.count > 0).length;

  const perLang = new Map<Lang, number>();
  for (const g of groups) perLang.set(g.l, (perLang.get(g.l) ?? 0) + 1);

  const withProduct = new Set(groups.map((g) => g.col?.id).filter(Boolean));
  const yearAgo = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const recentCols = catalog.collections.filter((c) => withProduct.has(c.id) && (c.date ?? '') >= yearAgo);

  // Cinta: logos internacionales y sobres japoneses recientes, intercalados
  const intl = recentCols.filter((c) => c.line === 'intl' && collectionVisual(data, c, 'es').logo).slice(0, 12);
  const asia = recentCols.filter((c) => c.line !== 'intl' && collectionVisual(data, c, 'ja').art).slice(0, 12);
  const ribbon: typeof recentCols = [];
  for (let i = 0; i < Math.max(intl.length, asia.length); i++) {
    if (intl[i]) ribbon.push(intl[i]);
    if (asia[i]) ribbon.push(asia[i]);
  }

  const drops = collectChanges(data, 7).filter((c) => c.delta < 0).slice(0, 6);
  const firstDay = isFirstDay(data);
  const fresh = firstDay
    ? [...groups].filter((g) => g.available && g.col && g.image).sort((a, b) => (b.col?.date ?? '').localeCompare(a.col?.date ?? '') || b.storeCount - a.storeCount).slice(0, 8)
    : [...groups].filter((g) => daysSince(g.firstSeen) <= 7).sort((a, b) => b.firstSeen.localeCompare(a.firstSeen)).slice(0, 8);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">Pokémon TCG · Envío a España</p>
          <h1>
            Todos los precios. <span className="grad">Un solo lugar.</span>
          </h1>
          <p className="lead">Producto sellado en español, inglés, japonés, chino y coreano, comparado cada día en {activeStores} tiendas.</p>
          <form
            className="search glass"
            onSubmit={(e) => {
              e.preventDefault();
              go('explorar', { q: q.trim() || null });
            }}
          >
            <SearchIcon size={20} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fuegos Fantasmales, Inferno X, ETB…" aria-label="Buscar" />
          </form>
          <div className="stats glass thin">
            {[
              [groups.length, 'productos'],
              [offers.length, 'precios seguidos'],
              [activeStores, 'tiendas'],
              [withProduct.size, 'colecciones'],
            ].map(([n, label]) => (
              <div className="stat" key={label}>
                <b>{Number(n).toLocaleString('es-ES')}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        {ribbon.length > 3 && (
          <div className="marquee" aria-label="Colecciones recientes">
            <div className="track">
              {[...ribbon, ...ribbon].map((c, i) => {
                const v = collectionVisual(data, c, c.line === 'intl' ? 'es' : 'ja');
                return (
                  <a key={`${c.id}-${i}`} className="glass" href={href('explorar', { col: c.id })} title={collectionName(c)} aria-hidden={i >= ribbon.length}>
                    {v.logo ? <img src={v.logo} alt={collectionName(c)} /> : <img className="art" src={v.art} alt={collectionName(c)} referrerPolicy="no-referrer" />}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="band">
        <div className="wrap">
          <div className="section-head">
            <h2>Por idioma.</h2>
            <SeeAll to="cobertura">Ver qué falta en cada idioma</SeeAll>
          </div>
          <div className="lang-tiles">
            {catalog.languages.map((l) => (
              <a key={l.id} className="lang-tile glass" href={href('explorar', { l: l.id })}>
                <div className="flag">{LANG_FLAG[l.id]}</div>
                <div className="code">{LANG_SHORT[l.id]}</div>
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
              <SeeAll to="colecciones">Todas las colecciones</SeeAll>
            </div>
            <div className="col-grid" style={{ paddingBottom: 0 }}>
              {recentCols.slice(0, 8).map((c) => {
                const lang: Lang = c.line === 'intl' ? 'es' : c.line === 'jp' ? 'ja' : 'zh';
                const v = collectionVisual(data, c, lang);
                const n = groups.filter((g) => g.col?.id === c.id).length;
                const local = collectionLocalName(c, lang);
                return (
                  <a key={c.id} className="col-tile glass" href={href('explorar', { col: c.id })}>
                    <div className="visual">
                      {v.art && <div className="bgart" style={{ backgroundImage: `url("${v.art}")` }} />}
                      {v.logo && <div className="bgart" style={{ backgroundImage: `url("${v.logo}")`, opacity: 0.35 }} />}
                      {v.logo ? <img className="logo" src={v.logo} alt="" loading="lazy" /> : v.art ? <img className="art" src={v.art} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="code">{c.code}</span>}
                      {c.upcoming && <span className="badge new tag">Próximamente</span>}
                    </div>
                    <div className="info">
                      <span className="nm">{collectionName(c, lang)}</span>
                      {local && <span className="local">{local}</span>}
                      <div className="meta">
                        <span>{LINE_LANGS[c.line]}</span>
                        <span>
                          {n} prod. · {c.upcoming ? `sale ${fmtDate(c.date, { day: 'numeric', month: 'short' })}` : fmtDate(c.date, { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {drops.length > 0 && (
        <section className="band">
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
