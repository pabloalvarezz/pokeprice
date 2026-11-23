// Actualización diaria completa: colecciones nuevas → precios de todas las tiendas → exportación web.
import { openDb, nowIso } from './lib/db.ts';
import { syncCollections } from './sync-collections.ts';
import { scrapeAll } from './scrape.ts';
import { exportData } from './export.ts';

const db = openDb();
const started = nowIso();
const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);

let collections: Awaited<ReturnType<typeof syncCollections>> | null = null;
try {
  collections = await syncCollections(db, log);
} catch (e) {
  log(`Aviso: sincronización de colecciones fallida (${(e as Error).message}); sigo con las conocidas.`);
}
const results = await scrapeAll(db, [], log);
const ok = results.filter((r) => r.status === 'ok');
const stats = {
  collections,
  stores: results.length,
  storesOk: ok.length,
  offers: ok.reduce((a, r) => a + r.kept, 0),
  changes: ok.reduce((a, r) => a + r.changes, 0),
  failed: results.filter((r) => r.status !== 'ok').map((r) => `${r.id}: ${r.status}`),
};
db.prepare('INSERT INTO runs (kind, started, finished, stats) VALUES (?, ?, ?, ?)').run('update', started, nowIso(), JSON.stringify(stats));
exportData(db, log);
db.exec('VACUUM'); // compacta la base tras desactivar ofertas
log(`Listo: ${stats.storesOk}/${stats.stores} tiendas, ${stats.offers} productos, ${stats.changes} cambios de precio.`);
if (stats.failed.length) log(`Tiendas con error:\n  ${stats.failed.join('\n  ')}`);
