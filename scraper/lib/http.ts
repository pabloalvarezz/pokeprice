// Cliente HTTP educado: identifica el bot, reintenta con espera y respeta un ritmo por dominio.

// Identificador honesto: imitar a Chrome hace que algunos cortafuegos corten la conexión.
export const USER_AGENT = 'Mozilla/5.0 PokePriceBot';

const lastHit = new Map<string, number>();
const MIN_GAP_MS = Number(process.env.POKEPRICE_GAP_MS ?? 700);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pace(url: string) {
  const host = new URL(url).host;
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} en ${url}`);
    this.status = status;
  }
}

export async function fetchText(
  url: string,
  opts: { headers?: Record<string, string>; method?: string; body?: string; retries?: number; timeoutMs?: number } = {},
): Promise<string> {
  const retries = opts.retries ?? 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await pace(url);
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        body: opts.body,
        redirect: 'follow',
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
          // sin Brotli: algunos servidores cortan la conexión si se pide "br"
          'accept-encoding': 'gzip, deflate',
          ...opts.headers,
        },
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(res.status, url);
        // 429 = la tienda pide que bajemos el ritmo: respetamos Retry-After o esperamos cada vez más
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = res.status === 429 ? (retryAfter > 0 ? retryAfter * 1000 : 15_000 * (attempt + 1)) : 3000 * (attempt + 1);
        await sleep(Math.min(wait, 90_000));
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, url);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function fetchJson<T = any>(url: string, opts: Parameters<typeof fetchText>[1] = {}): Promise<T> {
  const text = await fetchText(url, { ...opts, headers: { accept: 'application/json', ...opts.headers } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta no JSON en ${url}: ${text.slice(0, 120)}`);
  }
}

/** Ejecuta tareas con un máximo de `n` en paralelo. */
export async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
