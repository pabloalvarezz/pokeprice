// Lista de nombres de Pokémon (PokeAPI) para agrupar colecciones/latas por el Pokémon protagonista.
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from '../lib/db.ts';
import { fetchJson } from '../lib/http.ts';
import { norm } from '../lib/text.ts';

const PATH = resolve(ROOT, 'data', 'pokemon-names.json');

export async function ensurePokemonNames(log = console.log) {
  if (existsSync(PATH)) return;
  try {
    const data = await fetchJson<{ results: { name: string }[] }>('https://pokeapi.co/api/v2/pokemon-species?limit=2000');
    const names = data.results
      .map((r) => norm(r.name.replace(/-/g, ' ')))
      .filter((n) => n.length >= 3);
    writeFileSync(PATH, JSON.stringify([...new Set(names)].sort((a, b) => b.length - a.length)));
    log(`Nombres de Pokémon: ${names.length}`);
  } catch (e) {
    log(`Aviso: sin lista de Pokémon (${(e as Error).message})`);
  }
}
