import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');
export const DB_PATH = process.env.POKEPRICE_DB ?? resolve(ROOT, 'data', 'pokeprice.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
  id            TEXT PRIMARY KEY,         -- 'intl:phantasmal-flames', 'jp:m2', 'cn:csv9c'
  line          TEXT NOT NULL,            -- intl (EN/ES) | jp (JA/KO/ZH-TW) | cn (ZH simplificado)
  code          TEXT,                     -- me02, M2, CSV9C
  series        TEXT,
  name_en       TEXT,
  name_es       TEXT,
  name_ja       TEXT,
  name_ko       TEXT,
  name_zh       TEXT,
  names_other   TEXT,                     -- JSON {fr,de,it,pt}: sólo para detectar idiomas excluidos
  aliases       TEXT,                     -- JSON array de alias extra
  release_date  TEXT,
  logo          TEXT,
  symbol        TEXT,
  card_count    INTEGER,
  is_base       INTEGER NOT NULL DEFAULT 0, -- set que se llama igual que su serie ("Escarlata y Púrpura")
  first_seen    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  country       TEXT,
  currency      TEXT,
  platform      TEXT NOT NULL,
  collection    TEXT,
  languages     TEXT,                     -- JSON array
  shipping_note TEXT,
  notes         TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1,
  last_run      TEXT,
  last_status   TEXT,
  last_count    INTEGER
);

CREATE TABLE IF NOT EXISTS offers (
  id            TEXT PRIMARY KEY,         -- store_id:external_id
  store_id      TEXT NOT NULL REFERENCES stores(id),
  external_id   TEXT NOT NULL,
  url           TEXT,
  title         TEXT NOT NULL,
  raw_meta      TEXT,                     -- texto extra (tipo, tags, variante) usado para clasificar
  image         TEXT,
  price         REAL,
  currency      TEXT,
  price_eur     REAL,
  available     INTEGER,
  collection_id TEXT,
  product_type  TEXT,
  language      TEXT,
  variant_key   TEXT,
  classified_by TEXT DEFAULT 'auto',      -- auto | manual
  first_seen    TEXT NOT NULL,
  last_seen     TEXT NOT NULL,
  last_change   TEXT,
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS offers_store ON offers(store_id);
CREATE INDEX IF NOT EXISTS offers_class ON offers(collection_id, product_type, language);

-- Una fila por cambio (precio o disponibilidad). El primer avistamiento también cuenta.
CREATE TABLE IF NOT EXISTS price_history (
  offer_id      TEXT NOT NULL,
  date          TEXT NOT NULL,            -- YYYY-MM-DD
  price         REAL,
  price_eur     REAL,
  available     INTEGER,
  PRIMARY KEY (offer_id, date)
);

CREATE TABLE IF NOT EXISTS fx_rates (
  currency      TEXT PRIMARY KEY,
  per_eur       REAL NOT NULL,            -- unidades de la divisa por 1 EUR (formato BCE)
  date          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL,
  started       TEXT NOT NULL,
  finished      TEXT,
  stats         TEXT
);
`;

export function openDb(path = DB_PATH): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = DELETE; PRAGMA foreign_keys = ON;'); // un solo fichero: fácil de versionar
  db.exec(SCHEMA);
  // Migraciones ligeras
  const cols = (db.prepare('PRAGMA table_info(stores)').all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes('last_ok')) {
    db.exec("ALTER TABLE stores ADD COLUMN last_ok TEXT; UPDATE stores SET last_ok = last_run WHERE last_status = 'ok';");
  }
  return db;
}

export function today(): string {
  // Fecha en horario de Madrid, que es donde vive la web.
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date());
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
