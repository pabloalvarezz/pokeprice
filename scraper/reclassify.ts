// Vuelve a clasificar las ofertas guardadas con las reglas y alias actuales, sin leer las tiendas.
// (Lo que una regla nueva deje fuera se desactiva; lo que antes se descartó entra en la próxima lectura.)
import type { DatabaseSync } from 'node:sqlite';
import { openDb, tx } from './lib/db.ts';
import { Classifier } from './classify/classifier.ts';
import { loadStores } from './scrape.ts';
import { exportData } from './export.ts';

/** Aplica las reglas actuales a todas las ofertas guardadas (también las de tiendas que hoy no se pudieron leer). */
export function reclassifyAll(db: DatabaseSync, log: (m: string) => void = console.log) {
  const clf = new Classifier(db);
  const langs = new Map(loadStores().map((s) => [s.id, s.languages]));
  const rows = db.prepare("SELECT id, store_id, title, raw_meta FROM offers WHERE classified_by != 'manual'").all() as {
    id: string; store_id: string; title: string; raw_meta: string | null;
  }[];
  const up = db.prepare('UPDATE offers SET collection_id = ?, product_type = ?, language = ?, variant_key = ? WHERE id = ?');
  const off = db.prepare('UPDATE offers SET active = 0 WHERE id = ?');
  let changed = 0;
  let dropped = 0;
  tx(db, () => {
    for (const r of rows) {
      const [variant, ...meta] = (r.raw_meta ?? '').split(' | ');
      const isVariant = !!variant && r.title.endsWith(` — ${variant}`);
      const title = isVariant ? r.title.slice(0, -(variant.length + 3)) : r.title;
      const c = clf.classify({ title, variant: isVariant ? variant : '', meta: (isVariant ? meta : [variant, ...meta]).join(' '), storeLanguages: langs.get(r.store_id) });
      if (c.excluded && c.excluded !== 'otro idioma') {
        off.run(r.id);
        dropped++;
        continue;
      }
      const res = up.run(c.collectionId, c.productType, c.excluded ? 'other' : c.language, c.variantKey, r.id);
      changed += Number(res.changes);
    }
  });
  log(`Re-clasificadas ${changed} ofertas; ${dropped} descartadas con las reglas actuales.`);
}

if (import.meta.main) {
  const db = openDb();
  reclassifyAll(db);
  exportData(db);
}
