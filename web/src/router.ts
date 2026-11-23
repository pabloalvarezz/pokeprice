import { useEffect, useState } from 'react';

export type Route = { path: string; params: URLSearchParams };

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path || '', params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function href(path: string, params: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const qs = q.toString();
  return `#/${path}${qs ? `?${qs}` : ''}`;
}

export function go(path: string, params: Record<string, string | null | undefined> = {}, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  const url = href(path, params);
  if (opts.replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}

/** Cambia un parámetro de la ruta actual sin añadir entrada al historial. */
export function setParam(route: Route, changes: Record<string, string | null | undefined>, opts: { push?: boolean } = {}) {
  const p: Record<string, string> = {};
  route.params.forEach((v, k) => (p[k] = v));
  for (const [k, v] of Object.entries(changes)) {
    if (v == null || v === '') delete p[k];
    else p[k] = v;
  }
  go(route.path, p, { replace: !opts.push, keepScroll: true });
}
