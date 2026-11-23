import { useEffect, useState } from 'react';
import { loadData, fmtDate, type Data } from './data.ts';
import { useRoute, href } from './router.ts';
import { Home } from './views/Home.tsx';
import { Explore } from './views/Explore.tsx';
import { Coverage } from './views/Coverage.tsx';
import { Changes } from './views/Changes.tsx';
import { Stores } from './views/Stores.tsx';
import { ProductSheet } from './components/ProductSheet.tsx';

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="15" fill="currentColor" />
      <path d="M19 45V19h14a9 9 0 0 1 0 18H25" fill="none" stroke="var(--bg)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="44.5" cy="44.5" r="4.5" fill="#2997ff" />
    </svg>
  );
}

const NAV = [
  ['explorar', 'Explorar', 'Explorar'],
  ['cobertura', 'Cobertura', 'Cobertura'],
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

  const groupKey = route.params.get('g');
  const group = data && groupKey ? data.groups.find((g) => g.key === groupKey) : null;

  let view = null;
  if (data) {
    if (route.path === 'explorar') view = <Explore data={data} route={route} />;
    else if (route.path === 'cobertura') view = <Coverage data={data} route={route} />;
    else if (route.path === 'cambios') view = <Changes data={data} route={route} />;
    else if (route.path === 'tiendas') view = <Stores data={data} />;
    else view = <Home data={data} route={route} />;
  }

  return (
    <>
      <header className="gnav">
        <div className="wrap">
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
            <span className="updated">Actualizado {fmtDate(data.catalog.lastUpdate, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
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
          <p>
            PokéPrice compara producto sellado de Pokémon TCG en tiendas que envían a España. Los precios se leen una vez al día de cada tienda y pueden haber
            cambiado desde entonces; el envío y, fuera de la UE, el IVA y la aduana no están incluidos. Los precios en otras divisas se convierten a euros con
            el cambio del BCE.
          </p>
          <p>Pokémon y sus marcas son de Nintendo, Creatures y GAME FREAK. PokéPrice es un proyecto independiente, sin relación con The Pokémon Company.</p>
        </div>
      </footer>
    </>
  );
}
