import { useMemo } from 'react';
import { daysSince, fmtDate, fmtEur, FLAG, LANG_SHORT, type Data, type Group, type Offer } from '../data.ts';
import { setParam, type Route } from '../router.ts';
import { Delta, Segmented, openGroup } from '../components/ui.tsx';

export type Change = { offer: Offer; group: Group; delta: number; pct: number; date: string };

export function collectChanges(data: Data, days: number): Change[] {
  const byOffer = new Map<string, Group>();
  for (const g of data.groups) for (const o of g.offers) byOffer.set(o.id, g);
  const out: Change[] = [];
  for (const o of data.offers) {
    if (o.pp == null || !o.pd || daysSince(o.pd) > days) continue;
    const delta = o.p - o.pp;
    if (Math.abs(delta) < 0.01) continue;
    out.push({ offer: o, group: byOffer.get(o.id)!, delta, pct: delta / o.pp, date: o.pd });
  }
  return out.sort((a, b) => a.pct - b.pct);
}

export function ChangeList({ data, route, items }: { data: Data; route: Route; items: Change[] }) {
  return (
    <div className="list">
      {items.map(({ offer: o, group: g }) => {
        const s = data.storeById.get(o.s);
        return (
          <div className="list-row" key={o.id} onClick={() => openGroup(route, g.key)}>
            <div className="thumb">{o.i ? <img src={o.i} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}</div>
            <div>
              <div className="t">
                {g.title} <span className="muted small">· {data.typeLabel.get(g.ty)} · {LANG_SHORT[g.l]}</span>
              </div>
              <div className="s">
                {s ? `${FLAG[s.country] ?? ''} ${s.name}` : o.s} · {fmtDate(o.pd, { day: 'numeric', month: 'short' })}
                {!o.a && ' · sin stock'}
              </div>
            </div>
            <div className="r">
              <div>
                <span className="strike">{fmtEur(o.pp)}</span>
                <span className="price" style={{ fontSize: 17 }}>{fmtEur(o.p)}</span>
              </div>
              <Delta now={o.p} before={o.pp!} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Changes({ data, route }: { data: Data; route: Route }) {
  const dir = route.params.get('dir') ?? 'down';
  const days = Number(route.params.get('d') ?? 7);
  const all = useMemo(() => collectChanges(data, days), [data, days]);
  const newOffers = useMemo(
    () =>
      data.groups
        .flatMap((g) => g.offers.map((o) => ({ o, g })))
        .filter(({ o }) => daysSince(o.fs) <= days)
        .sort((a, b) => b.o.fs.localeCompare(a.o.fs)),
    [data, days],
  );
  const firstDay = data.offers.length > 0 && data.offers.every((o) => o.fs === data.offers[0].fs);
  const items = dir === 'up' ? all.filter((c) => c.delta > 0).reverse() : all.filter((c) => c.delta < 0);

  return (
    <>
      <div className="wrap page-title">
        <h1>Cambios de precio</h1>
        <p>Lo que ha subido, bajado o aparecido desde la última revisión. Las tiendas se leen cada día.</p>
      </div>
      <div className="wrap" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '24px 22px 20px' }}>
        <Segmented
          value={dir}
          onChange={(v) => setParam(route, { dir: v === 'down' ? null : v })}
          options={[
            { id: 'down', label: `Bajadas · ${all.filter((c) => c.delta < 0).length}` },
            { id: 'up', label: `Subidas · ${all.filter((c) => c.delta > 0).length}` },
            { id: 'new', label: `Nuevos · ${firstDay ? 0 : newOffers.length}` },
          ]}
        />
        <Segmented
          value={String(days)}
          onChange={(v) => setParam(route, { d: v === '7' ? null : v })}
          options={[
            { id: '1', label: '24 h' },
            { id: '7', label: '7 días' },
            { id: '30', label: '30 días' },
          ]}
        />
      </div>
      <div className="wrap" style={{ paddingBottom: 80 }}>
        {dir === 'new' ? (
          firstDay || !newOffers.length ? (
            <div className="empty">
              <h3>Todavía nada nuevo.</h3>
              <p>{firstDay ? 'Hoy es el primer día de seguimiento: los productos nuevos aparecerán aquí a partir de mañana.' : 'No ha entrado producto nuevo en este periodo.'}</p>
            </div>
          ) : (
            <div className="list">
              {newOffers.slice(0, 300).map(({ o, g }) => {
                const s = data.storeById.get(o.s);
                return (
                  <div className="list-row" key={o.id} onClick={() => openGroup(route, g.key)}>
                    <div className="thumb">{o.i ? <img src={o.i} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}</div>
                    <div>
                      <div className="t">
                        {g.title} <span className="muted small">· {data.typeLabel.get(g.ty)} · {LANG_SHORT[g.l]}</span>
                      </div>
                      <div className="s">
                        {s ? `${FLAG[s.country] ?? ''} ${s.name}` : o.s} · desde {fmtDate(o.fs, { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <div className="r">
                      <span className="price" style={{ fontSize: 17 }}>{fmtEur(o.p)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : items.length ? (
          <ChangeList data={data} route={route} items={items.slice(0, 300)} />
        ) : (
          <div className="empty">
            <h3>Sin cambios.</h3>
            <p>{firstDay ? 'El historial empieza hoy. Mañana verás aquí las primeras variaciones.' : 'Ningún precio se ha movido en este periodo.'}</p>
          </div>
        )}
      </div>
    </>
  );
}
