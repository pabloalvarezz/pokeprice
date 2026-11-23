import { useEffect } from 'react';
import { collectionLocalName, collectionName, fmtDate, FLAG, LANG_NAME, regionOf, shippingNote, type Data, type Group } from '../data.ts';
import { href, setParam, type Route } from '../router.ts';
import { Delta, OfferPrice } from './ui.tsx';
import { PriceChart } from './PriceChart.tsx';

export function ProductSheet({ data, group: g, route }: { data: Data; group: Group; route: Route }) {
  const close = () => setParam(route, { g: null });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  });
  const local = collectionLocalName(g.col, g.l);
  const type = data.typeLabel.get(g.ty) ?? g.ty;
  const cheapest = g.best;
  const priciest = g.offers.filter((o) => o.a).reduce((m, o) => Math.max(m, o.p), 0);

  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={g.title} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close} aria-label="Cerrar">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <div className="head">
          <div className="media">{g.image ? <img src={g.image} alt="" referrerPolicy="no-referrer" /> : null}</div>
          <div>
            <div className="eyebrow" style={{ fontSize: 14 }}>{type}</div>
            <h2>{g.title}</h2>
            {local && <div className="muted">{local}</div>}
            <div className="facts">
              <span>{LANG_NAME[g.l]}</span>
              {g.col && (
                <a href={href('explorar', { l: g.l, col: g.col.id })} onClick={close}>
                  <span>{collectionName(g.col, g.l)}{g.col.code ? ` · ${g.col.code}` : ''}</span>
                </a>
              )}
              {g.col?.date && <span>{g.col.upcoming ? 'Sale el' : 'Salió el'} {fmtDate(g.col.date)}</span>}
              <span>{g.storeCount} {g.storeCount === 1 ? 'tienda' : 'tiendas'}</span>
            </div>
            <div className="best">
              <OfferPrice o={cheapest} />
              <span className="muted small">
                {cheapest.a ? 'el más barato disponible' : 'sin stock ahora mismo'}
                {priciest > cheapest.p && cheapest.a ? ` · hasta ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(priciest)}` : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="sec">
          <h3>Dónde comprarlo</h3>
          {g.offers.map((o) => {
            const s = data.storeById.get(o.s);
            return (
              <div className="offer" key={o.id}>
                <div>
                  <div className="st">
                    <span className={`dot ${o.a ? '' : 'off'}`} />
                    {s ? `${FLAG[s.country] ?? ''} ${s.name}` : o.s}
                  </div>
                  <div className="ti">{o.t}</div>
                  {o.x && <div className="tiny warn">Precio muy por debajo del resto: puede ser una reserva con señal o un error de la tienda.</div>}
                  {s && <div className={`tiny ${regionOf(s.country) === 'world' ? 'warn' : 'muted'}`}>{shippingNote(s.country)}</div>}
                </div>
                <div className="pr">
                  <OfferPrice o={o} />
                  {o.pp != null && <Delta now={o.p} before={o.pp} />}
                </div>
                <a className={`btn ${o.a ? '' : 'ghost'}`} href={o.u} target="_blank" rel="noopener noreferrer nofollow">
                  {o.a ? 'Ver en tienda' : 'Agotado ›'}
                </a>
              </div>
            );
          })}
        </div>

        <div className="sec">
          <h3>Evolución del mejor precio</h3>
          <PriceChart offers={g.offers} />
        </div>
      </div>
    </div>
  );
}
