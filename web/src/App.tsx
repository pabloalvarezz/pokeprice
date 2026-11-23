import { useEffect, useState } from 'react';
import { loadData, fmtDate, type Data } from './data.ts';
import { useRoute, href } from './router.ts';
import { Home } from './views/Home.tsx';
import { Explore } from './views/Explore.tsx';
import { Collections } from './views/Collections.tsx';
import { Coverage } from './views/Coverage.tsx';
import { Changes } from './views/Changes.tsx';
import { Stores } from './views/Stores.tsx';
import { ProductSheet } from './components/ProductSheet.tsx';

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b8cff" />
          <stop offset="0.55" stopColor="#bf5af2" />
          <stop offset="1" stopColor="#ff9f0a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#lg)" />
      <rect x="1" y="1" width="62" height="62" rx="17" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.5" />
      <path d="M20 46V19h13.5a9 9 0 0 1 0 18H26" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="45" cy="45" r="4.5" fill="#fff" />
    </svg>
  );
}

const NAV = [
  ['explorar', 'Explorar', 'Explorar'],
  ['colecciones', 'Colecciones', 'Sets'],
  ['cobertura', 'Cobertura', 'Huecos'],
  ['cambios', 'Cambios de precio', 'Cambios'],
  ['tiendas', 'Tiendas', 'Tiendas'],
] as const;

export function App() {
  const route = useRoute();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData().then(setData, (e) => setError(String(e)));
  }, []);

  // Al cambiar de sección, arriba del todo (la ficha de producto no cuenta como cambio de sección)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);

  const groupKey = route.params.get('g');
  const group = data && groupKey ? data.groups.find((g) => g.key === groupKey) : null;

  let view = null;
  if (data) {
    if (route.path === 'explorar') view = <Explore data={data} route={route} />;
    else if (route.path === 'colecciones') view = <Collections data={data} route={route} />;
    else if (route.path === 'cobertura') view = <Coverage data={data} route={route} />;
    else if (route.path === 'cambios') view = <Changes data={data} route={route} />;
    else if (route.path === 'tiendas') view = <Stores data={data} />;
    else view = <Home data={data} route={route} />;
  }

  return (
    <>
      <div className="ambient" aria-hidden />
      <header className="gnav">
        <div className="bar glass">
          <a className="brand" href={href('')}>
            <Logo />
            <span className="word">PokéPrice</span>
          </a>
          <nav>
            {NAV.map(([p, label, short]) => (
              <a key={p} href={href(p)} className={route.path === p ? 'on' : ''}>
                <span className="long">{label}</span>
                <span className="short">{short}</span>
              </a>
            ))}
          </nav>
          {data?.catalog.lastUpdate && (
            <span className="updated">{fmtDate(data.catalog.lastUpdate, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
      </header>

      <main>
        {error && (
          <div className="wrap empty">
            <h3>No se pudieron cargar los datos</h3>
            <p>{error}</p>
          </div>
        )}
        {!data && !error && <div className="wrap empty muted">Cargando precios…</div>}
        {view}
      </main>

      {group && data && <ProductSheet data={data} group={group} route={route} />}

      <footer>
        <div className="wrap">
          <div className="note glass thin">
            <p>
              PokéPrice compara producto sellado de Pokémon TCG en tiendas que envían a España. Los precios se leen una vez al día de cada tienda y pueden haber
              cambiado desde entonces; el envío y, fuera de la UE, el IVA y la aduana no están incluidos. Los precios en otras divisas se convierten a euros con
              el cambio del BCE. Logos de colección: TCGdex. Imágenes de referencia: TCGplayer.
            </p>
            <p>Pokémon y sus marcas son de Nintendo, Creatures y GAME FREAK. PokéPrice es un proyecto independiente, sin relación con The Pokémon Company.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
