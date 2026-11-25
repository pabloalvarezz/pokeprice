// Complemento local de la actualización diaria.
// Algunas tiendas bloquean a los servidores de GitHub (403, verificaciones anti-bot), pero responden
// desde una conexión doméstica en España. Este script, pensado para ejecutarse en el Mac varias veces al día, hace:
//   1. comprueba que la actualización en la nube de hoy esté hecha; GitHub retrasa a veces la tarea
//      programada muchas horas, así que si aún no ha empezado la lanza él y espera a que termine
//   2. descarga la base de datos de la rama "datos"
//   3. lee sólo las tiendas que fallaron en la nube y calcula las huellas de las fotos nuevas
//   4. sube la base de datos actualizada a "datos" (si nadie la ha cambiado entretanto)
//   5. pide a GitHub que regenere la web ("modo publicar")
// Si hoy ya está todo hecho, no hace nada. Con tiendas como argumentos, las lee directamente (reparaciones a mano).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { nowIso, openDb, ROOT, today } from './lib/db.ts';
import { scrapeAll } from './scrape.ts';
import { hashOfferImages } from './assets.ts';

const SYNC_DIR = resolve(ROOT, 'data', 'sync');
const DB_FILE = resolve(SYNC_DIR, 'pokeprice.db');
const MAC_MARK = 'tiendas leídas desde el Mac';
const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ningún comando puede quedarse colgado: si la red se corta a mitad (el Mac se duerme, cambia de wifi…)
// git puede esperar indefinidamente. Límite de tiempo y corte si la transferencia se queda parada.
const MIN = 60_000;
const NET = ['-c', 'http.lowSpeedLimit=1000', '-c', 'http.lowSpeedTime=60'];

function run(cmd: string, args: string[], opts: { cwd?: string; buffer?: boolean; timeout?: number } = {}): string {
  return execFileSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    maxBuffer: 1024 * 1024 * 1024,
    encoding: opts.buffer ? undefined : 'utf8',
    timeout: opts.timeout ?? 2 * MIN,
    killSignal: 'SIGKILL',
  }) as unknown as string;
}

function fetchDatos(): { sha: string; message: string } {
  run('git', [...NET, 'fetch', '-q', 'origin', 'datos'], { timeout: 10 * MIN });
  const [sha, ...msg] = run('git', ['log', '-1', '--format=%H%n%s', 'FETCH_HEAD']).trim().split('\n');
  return { sha, message: msg.join(' ') };
}

type GhRun = { databaseId: number; status: string; conclusion: string; createdAt: string; displayTitle: string };
const madridDate = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(new Date(iso));
const cloudRuns = (): GhRun[] =>
  JSON.parse(run('gh', ['run', 'list', '--workflow', 'daily.yml', '--limit', '20', '--json', 'databaseId,status,conclusion,createdAt,displayTitle']));
// Las ejecuciones "publicar" sólo regeneran la web; las demás leen todas las tiendas
const isFullUpdate = (r: GhRun) => !/publicar/i.test(r.displayTitle);

/** Se asegura de que la nube haya leído hoy las tiendas. false = mejor volver a intentarlo más tarde. */
async function ensureCloudUpdate(message: string): Promise<boolean> {
  if (message.includes(today())) return true;
  const todays = cloudRuns().filter((r) => isFullUpdate(r) && madridDate(r.createdAt) === today());
  let active = todays.find((r) => r.status !== 'completed');
  if (!active && todays.length) {
    log('La actualización en la nube de hoy terminó sin guardar datos: sigo con los que hay.');
    return true;
  }
  if (!active) {
    log('GitHub aún no ha hecho la actualización de hoy (retrasa a veces la tarea programada): la lanzo ahora.');
    const before = new Set(cloudRuns().map((r) => r.databaseId));
    run('gh', ['workflow', 'run', 'daily.yml', '--ref', 'main', '-f', 'modo=completo']);
    for (let i = 0; i < 18 && !active; i++) {
      await sleep(10_000);
      active = cloudRuns().find((r) => !before.has(r.databaseId) && isFullUpdate(r));
    }
    if (!active) {
      log('No veo la ejecución que acabo de lanzar; lo intento en la próxima pasada.');
      return false;
    }
  }
  log(`Espero a que termine la actualización en la nube (ejecución ${active.databaseId})…`);
  const limit = Date.now() + 90 * MIN;
  while (Date.now() < limit) {
    await sleep(30_000);
    const r = JSON.parse(run('gh', ['run', 'view', String(active.databaseId), '--json', 'status,conclusion'])) as GhRun;
    if (r.status === 'completed') {
      log(`Actualización en la nube terminada (${r.conclusion}).`);
      return true;
    }
  }
  log('La actualización en la nube está tardando demasiado; lo intento en la próxima pasada.');
  return false;
}

function pushDatos(): void {
  const tmp = mkdtempSync(join(tmpdir(), 'pokeprice-datos-'));
  try {
    copyFileSync(DB_FILE, join(tmp, 'pokeprice.db'));
    if (existsSync(resolve(ROOT, 'data', 'unmatched.txt'))) copyFileSync(resolve(ROOT, 'data', 'unmatched.txt'), join(tmp, 'unmatched.txt'));
    const remote = run('git', ['remote', 'get-url', 'origin']).trim();
    const name = run('git', ['config', 'user.name']).trim();
    const email = run('git', ['config', 'user.email']).trim();
    run('git', ['init', '-q', '-b', 'datos'], { cwd: tmp });
    run('git', ['add', '.'], { cwd: tmp });
    run('git', ['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-qm', `Datos + ${MAC_MARK} (${today()})`], { cwd: tmp });
    const sha = run('git', ['rev-parse', 'HEAD'], { cwd: tmp }).trim();
    for (let attempt = 1; ; attempt++) {
      try {
        run('git', [...NET, 'push', '-qf', remote, 'datos'], { cwd: tmp, timeout: 15 * MIN });
        return;
      } catch (e) {
        // A veces GitHub ya ha recibido todo y es la respuesta final la que se pierde
        const there = run('git', [...NET, 'ls-remote', remote, 'refs/heads/datos']).split(/\s/)[0];
        if (there === sha) return log('La subida no confirmó, pero GitHub ya tiene la base de datos nueva.');
        if (attempt >= 3) throw e;
        log(`La subida falló (${(e as Error).message.slice(0, 80)}); reintento.`);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

async function syncOnce(forced: string[]): Promise<'done' | 'retry' | 'nothing'> {
  const base = fetchDatos();
  mkdirSync(SYNC_DIR, { recursive: true });
  writeFileSync(DB_FILE, run('git', ['show', 'FETCH_HEAD:pokeprice.db'], { buffer: true }));
  log(`Base de datos descargada (${base.sha.slice(0, 7)}: ${base.message})`);

  const db = openDb(DB_FILE);
  const ids = forced.length
    ? forced
    : (db.prepare("SELECT id FROM stores WHERE enabled = 1 AND (last_status IS NULL OR last_status != 'ok') ORDER BY id").all() as { id: string }[]).map((r) => r.id);
  if (!ids.length) {
    log('Todas las tiendas se leyeron bien en la nube: nada que hacer.');
    db.close();
    return 'nothing';
  }
  log(`${forced.length ? 'Tiendas pedidas' : 'Tiendas que fallaron en la nube'} (${ids.length}): ${ids.join(', ')}`);
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
  if (fetchDatos().sha !== base.sha) {
    log('La rama "datos" ha cambiado mientras leía (otra actualización en curso): repito.');
    return 'retry';
  }
  pushDatos();
  log('Base de datos subida a la rama "datos".');

  run('gh', ['workflow', 'run', 'daily.yml', '--ref', 'main', '-f', 'modo=publicar']);
  log('Pedida a GitHub la publicación de la web.');
  return 'done';
}

const forced = process.argv.slice(2);
if (!forced.length) {
  const head = fetchDatos();
  if (head.message.includes(MAC_MARK) && head.message.includes(today())) {
    log('Hoy ya se leyeron desde el Mac las tiendas que fallaron en la nube: nada que hacer.');
    process.exit(0);
  }
  if (!(await ensureCloudUpdate(head.message))) process.exit(0);
}
for (let attempt = 1; attempt <= 3; attempt++) {
  const r = await syncOnce(forced);
  if (r !== 'retry') break;
  await sleep(5 * MIN);
}
