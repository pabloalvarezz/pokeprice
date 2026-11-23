import { useState } from 'react';
import { fmtDate, FLAG, LANG_SHORT, shippingNote, type Data, type Lang } from '../data.ts';
import { href } from '../router.ts';
import { Segmented } from '../components/ui.tsx';

export function Stores({ data }: { data: Data }) {
  const [lang, setLang] = useState<Lang | 'all'>('all');
  const [where, setWhere] = useState<'all' | 'es' | 'eu' | 'world'>('all');
  const perStoreLang = new Map<string, Set<string>>();
  for (const o of data.offers) {
    if (!perStoreLang.has(o.s)) perStoreLang.set(o.s, new Set());
    perStoreLang.get(o.s)!.add(o.l);
  }
  const EU = new Set(['DE', 'FR', 'IT', 'PT', 'NL', 'BE', 'AT', 'PL', 'IE', 'DK', 'SE', 'FI', 'CZ', 'LU', 'GR', 'HU', 'SK', 'LT', 'LV', 'EE', 'SI', 'HR', 'RO', 'BG', 'MT', 'CY']);
  const stores = data.catalog.stores
    .filter((s) => s.enabled)
    .filter((s) => lang === 'all' || perStoreLang.get(s.id)?.has(lang))
    .filter((s) => where === 'all' || (where === 'es' ? s.country === 'ES' : where === 'eu' ? EU.has(s.country) : s.country !== 'ES' && !EU.has(s.country)))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const errors = data.catalog.stores.filter((s) => s.enabled && s.status && s.status !== 'ok').length;

  return (
    <>
      <div className="wrap page-title">
        <h1>Tiendas</h1>
        <p>
          {data.catalog.stores.filter((s) => s.enabled).length} tiendas que envían a España, leídas automáticamente cada día.
          {errors ? ` ${errors} no respondieron en la última revisión.` : ''}
        </p>
      </div>
      <div className="wrap" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '24px 22px 20px' }}>
        <Segmented
          value={where}
          onChange={setWhere}
          options={[
            { id: 'all', label: 'Todas' },
            { id: 'es', label: 'España' },
            { id: 'eu', label: 'Resto de la UE' },
            { id: 'world', label: 'Fuera de la UE' },
          ]}
        />
        <Segmented
          value={lang}
          onChange={setLang}
          options={[{ id: 'all', label: 'Todos' }, ...data.catalog.languages.map((l) => ({ id: l.id, label: l.id.toUpperCase() }))] as { id: Lang | 'all'; label: string }[]}
        />
      </div>
      <div className="wrap">
        <div className="stores">
          {stores.map((s) => {
            const langs = [...(perStoreLang.get(s.id) ?? [])] as Lang[];
            const ok = s.status === 'ok';
            return (
              <div className="store" key={s.id}>
                <div className="top">
                  <span className="flag">{FLAG[s.country] ?? '🌐'}</span>
                  <div style={{ flex: 1 }}>
                    <div className="nm">{s.name}</div>
                    <a className="small" href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                      {s.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                    </a>
                  </div>
                </div>
                <div className="langs">
                  {(langs.length ? langs : (s.languages as Lang[])).map((l) => (
                    <span key={l}>{LANG_SHORT[l] ?? l}</span>
                  ))}
                  {s.currency !== 'EUR' && <span>{s.currency}</span>}
                </div>
                <div className="row">
                  <span>
                    {s.count > 0 ? (
                      <a href={href('explorar', { s: s.id })}>{s.count.toLocaleString('es-ES')} productos ›</a>
                    ) : (
                      'Sin productos'
                    )}
                  </span>
                  <span className={ok ? 'status-ok' : s.status ? 'status-err' : ''} title={s.status ?? ''}>
                    {ok ? `● ${fmtDate(s.lastRun, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : s.status ? '● Sin respuesta' : 'Pendiente'}
                  </span>
                </div>
                <div className="tiny muted">{shippingNote(s.country)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
