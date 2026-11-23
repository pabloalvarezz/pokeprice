// Complemento local de la actualización diaria.
// Algunas tiendas bloquean a los servidores de GitHub (403, verificaciones anti-bot), pero responden
// desde una conexión doméstica en España. Este script, pensado para ejecutarse en el Mac después de la
// actualización en la nube, hace:
//   1. descarga la base de datos de la rama "datos"
//   2. lee sólo las tiendas que fallaron en la nube
//   3. calcula las huellas de las fotos nuevas
//   4. sube la base de datos actualizada a "datos" (si nadie la ha cambiado entretanto)
//   5. pide a GitHub que regenere la web ("modo publicar")
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { nowIso, openDb, ROOT } from './lib/db.ts';
import { scrapeAll } from './scrape.ts';
import { hashOfferImages } from './assets.ts';

const SYNC_DIR = resolve(ROOT, 'data', 'sync');
const DB_FILE = resolve(SYNC_DIR, 'pokeprice.db');
const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);

const run = (cmd: string, args: string[], opts: { cwd?: string; buffer?: boolean } = {}) =>
  execFileSync(cmd, args, { cwd: opts.cwd ?? ROOT, maxBuffer: 1024 * 1024 * 1024, encoding: opts.buffer ? undefined : 'utf8' });

function fetchDatos(): string {
  run('git', ['fetch', '-q', 'origin', 'datos']);
  return String(run('git', ['rev-parse', 'FETCH_HEAD'])).trim();
}

async function syncOnce(): Promise<'done' | 'retry' | 'nothing'> {
  const base = fetchDatos();
  mkdirSync(SYNC_DIR, { recursive: true });
  writeFileSync(DB_FILE, run('git', ['show', 'FETCH_HEAD:pokeprice.db'], { buffer: true }) as Buffer);
  log(`Base de datos descargada (${base.slice(0, 7)})`);

  const db = openDb(DB_FILE);
  const ids = (db.prepare("SELECT id FROM stores WHERE enabled = 1 AND (last_status IS NULL OR last_status != 'ok') ORDER BY id").all() as { id: string }[]).map((r) => r.id);
  if (!ids.length) {
    log('Todas las tiendas se leyeron bien en la nube: nada que hacer.');
    db.close();
    return 'nothing';
  }
  log(`Tiendas que fallaron en la nube (${ids.length}): ${ids.join(', ')}`);
  const started = nowIso();
  const results = await scrapeAll(db, ids, log);
  await hashOfferImages(db, log);
  const ok = results.filter((r) => r.status === 'ok');
  db.prepare('INSERT INTO runs (kind, started, finished, stats) VALUES (?, ?, ?, ?)').run('local', started, nowIso(), JSON.stringify(results));
  db.exec('VACUUM');
  db.close();
  log(`Leídas desde el Mac: ${ok.length}/${ids.length} tiendas, ${ok.reduce((a, r) => a + r.kept, 0)} productos.`);
  if (!ok.length) return 'nothing';

  // ¿Ha cambiado "datos" mientras leíamos? Entonces se repite con la versión nueva.
  if (fetchDatos() !== base) {
    log('La rama "datos" ha cambiado mientras leía (otra actualización en curso): repito.');
    return 'retry';
  }

  const tmp = mkdtempSync(join(tmpdir(), 'pokeprice-datos-'));
  try {
    copyFileSync(DB_FILE, join(tmp, 'pokeprice.db'));
    if (existsSync(resolve(ROOT, 'data', 'unmatched.txt'))) copyFileSync(resolve(ROOT, 'data', 'unmatched.txt'), join(tmp, 'unmatched.txt'));
    const remote = String(run('git', ['remote', 'get-url', 'origin'])).trim();
    const name = String(run('git', ['config', 'user.name'])).trim();
    const email = String(run('git', ['config', 'user.email'])).trim();
    run('git', ['init', '-q', '-b', 'datos'], { cwd: tmp });
    run('git', ['add', '.'], { cwd: tmp });
    run('git', ['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-qm', `Datos + tiendas leídas desde el Mac (${new Date().toISOString().slice(0, 10)})`], { cwd: tmp });
    run('git', ['push', '-qf', remote, 'datos'], { cwd: tmp });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  log('Base de datos subida a la rama "datos".');

  run('gh', ['workflow', 'run', 'daily.yml', '--ref', 'main', '-f', 'modo=publicar']);
  log('Pedida a GitHub la publicación de la web.');
  return 'done';
}

for (let attempt = 1; attempt <= 3; attempt++) {
  const r = await syncOnce();
  if (r !== 'retry') break;
  await new Promise((res) => setTimeout(res, 5 * 60_000));
}
