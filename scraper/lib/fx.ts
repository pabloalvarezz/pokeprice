// Tipos de cambio diarios del Banco Central Europeo (sin clave, públicos).
import type { DatabaseSync } from 'node:sqlite';
import { fetchText } from './http.ts';
import { today } from './db.ts';

const ECB = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

export async function refreshFx(db: DatabaseSync): Promise<number> {
  const xml = await fetchText(ECB);
  const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1] ?? today();
  const rows = [...xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)];
  const up = db.prepare(
    'INSERT INTO fx_rates (currency, per_eur, date) VALUES (?, ?, ?) ON CONFLICT(currency) DO UPDATE SET per_eur = excluded.per_eur, date = excluded.date',
  );
  up.run('EUR', 1, date);
  for (const [, cur, rate] of rows) up.run(cur, Number(rate), date);
  // El BCE no publica TWD: aproximación estable vía USD si hace falta.
  return rows.length;
}

export function fxTable(db: DatabaseSync): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of db.prepare('SELECT currency, per_eur FROM fx_rates').all() as { currency: string; per_eur: number }[]) {
    m.set(r.currency, r.per_eur);
  }
  if (!m.has('EUR')) m.set('EUR', 1);
  return m;
}

export function toEur(fx: Map<string, number>, amount: number | null, currency: string | null): number | null {
  if (amount == null) return null;
  const per = fx.get((currency ?? 'EUR').toUpperCase());
  if (!per) return null;
  return Math.round((amount / per) * 100) / 100;
}
