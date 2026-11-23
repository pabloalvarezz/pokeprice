import type { ReactNode } from 'react';
import { collectionVisual, daysSince, fmtEur, fmtMoney, FLAG, LANG_SHORT, sized, type Data, type Group, type Offer } from '../data.ts';
import { href, setParam, type Route } from '../router.ts';

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented glass" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === value} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8.5" cy="8.5" r="6.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.2 13.2 18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Delta({ now, before }: { now: number; before: number }) {
  const d = now - before;
  if (Math.abs(d) < 0.005) return null;
  const pct = before ? Math.round((Math.abs(d) / before) * 100) : 0;
  return (
    <span className={`delta ${d < 0 ? 'down' : 'up'}`}>
      {d < 0 ? '▼' : '▲'} {fmtEur(Math.abs(d))}
      {pct ? ` · ${pct}%` : ''}
    </span>
  );
}

export function OfferPrice({ o }: { o: Offer }) {
  return (
    <>
      <span className="price">
        {o.c && <small>≈</small>}
        {fmtEur(o.p)}
      </span>
      {o.c && o.op != null && <div className="tiny muted">{fmtMoney(o.op, o.c)}</div>}
    </>
  );
}

export function openGroup(route: Route, key: string) {
  setParam(route, { g: key }, { push: true });
}

/** Logo o foto del sobre de una colección; si no hay nada, su código. */
export function CollectionMark({ data, col, lang, className }: { data: Data; col: Group['col']; lang: Group['l'] | 'ui'; className?: string }) {
  const v = collectionVisual(data, col, lang);
  if (v.logo) return <img className={`logo ${className ?? ''}`} src={v.logo} alt="" loading="lazy" />;
  if (v.art) return <img className={`art ${className ?? ''}`} src={v.art} alt="" loading="lazy" referrerPolicy="no-referrer" />;
  return col?.code ? <span className="code">{col.code}</span> : null;
}

export function ProductCard({ g, data, route }: { g: Group; data: Data; route: Route }) {
  const isNew = daysSince(g.firstSeen) <= 3 && !isFirstDay(data);
  const store = data.storeById.get(g.best.s);
  const v = collectionVisual(data, g.col, g.l);
  return (
    <button className="card glass fade-in" onClick={() => openGroup(route, g.key)}>
      <div className="media">
        <div className="badges">
          <span className="badge lang">{LANG_SHORT[g.l]}</span>
          {g.drop != null && Math.abs(g.drop) >= 0.01 ? (
            <span className={`badge ${g.drop > 0 ? 'down' : 'up'}`}>
              {g.drop > 0 ? '▼' : '▲'} {Math.round(Math.abs(g.dropPct ?? 0) * 100)}%
            </span>
          ) : isNew ? (
            <span className="badge new">Nuevo</span>
          ) : null}
        </div>
        {g.image ? (
          <img className="photo" src={sized(g.image, 480)} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="ph">{v.logo ? <img src={v.logo} alt="" /> : <span>{g.col?.code ?? '·'}</span>}</div>
        )}
      </div>
      <div className="body">
        <span className="kind">
          {v.logo && <img src={v.logo} alt="" loading="lazy" />}
          {g.subtitle}
        </span>
        <span className="title">{g.title}</span>
        <div className="foot">
          <span className="price">
            {g.storeCount > 1 && <small>desde</small>}
            {fmtEur(g.best.p)}
          </span>
          <span className="where">
            <span className={`dot ${g.available ? '' : 'off'}`} />
            {store && <span title={store.name}>{FLAG[store.country] ?? ''} </span>}
            {g.storeCount > 1 ? `${g.storeCount} tiendas` : store?.name}
          </span>
        </div>
      </div>
    </button>
  );
}

const firstDayCache = new WeakMap<Data, boolean>();
export function isFirstDay(data: Data): boolean {
  // el primer día de seguimiento todo es "nuevo": no lo marcamos
  let v = firstDayCache.get(data);
  if (v === undefined) {
    const f = data.offers[0]?.fs;
    v = !!f && data.offers.every((o) => o.fs === f);
    firstDayCache.set(data, v);
  }
  return v;
}

export function SeeAll({ to, params, children }: { to: string; params?: Record<string, string>; children: ReactNode }) {
  return <a href={href(to, params)}>{children} ›</a>;
}
