# PokéPrice

Comparador diario de precios de **producto sellado de Pokémon TCG** (sobres, displays, ETB, latas, colecciones, barajas…)
en tiendas online que envían a España, en **español, inglés, japonés, chino y coreano**.

Todo está separado por **colección**, **gama de producto** e **idioma**. La vista *Cobertura* cruza colecciones y gamas
para ver de un vistazo qué falta.

## Cómo funciona

```
TCGdex + tcgcsv ──► colecciones (ES/EN · JA/KO/ZH-TW · ZH simplificado)
                         │
tiendas (stores.json) ──► adaptadores ──► clasificador ──► SQLite (data/pokeprice.db)
  Shopify · WooCommerce · PrestaShop · Magento · HTML       colección · gama · idioma · variante
                                                             historial de precios (sólo cambios)
                         │
                         └─► export ──► web/public/data/*.json ──► web estática (Vite + React)
```

- **Colecciones**: se sincronizan cada día desde [TCGdex](https://tcgdex.dev) (nombres en cada idioma, logos y fechas)
  y [tcgcsv](https://tcgcsv.com) (espejo de TCGplayer: nombres en inglés de los sets japoneses y sets anunciados).
  Las colecciones nuevas aparecen solas, también en preventa.
- **Tiendas**: `scraper/stores.json`. Cada tienda indica su plataforma y la colección o categoría de Pokémon.
  Shopify, WooCommerce, PrestaShop y Magento se leen por su API pública; el resto, por HTML.
- **Clasificador** (`scraper/classify/`): deduce colección, gama e idioma del título y descarta cartas sueltas,
  gradeadas, accesorios, lotes de tienda, producto usado y otros idiomas (FR/DE/IT/PT…).
- **Precios**: en euros; otras divisas se convierten con el cambio diario del BCE. El historial guarda sólo los días con cambios.

## Comandos

| | |
|---|---|
| `npm run update` | Actualización completa: colecciones + todas las tiendas + exportación |
| `npm run collections` | Sólo sincronizar colecciones |
| `npm run scrape [ids…]` | Leer todas las tiendas, o sólo las indicadas |
| `npm run export` | Regenerar los JSON de la web |
| `npm run reclassify` | Re-clasificar todo con las reglas actuales (sin volver a leer tiendas) |
| `npm run dev` | Web en local (http://localhost:5173) |
| `npm run build` | Web estática en `dist/` |

Requiere Node 24 o superior (trae SQLite y TypeScript integrados).

## Añadir una tienda

Añade un objeto a `scraper/stores.json`:

```json
{ "id": "mi-tienda", "name": "Mi Tienda", "url": "https://mitienda.es", "country": "ES", "currency": "EUR",
  "platform": "shopify", "collection": "pokemon", "languages": ["es", "en", "ja"] }
```

- `shopify`: `collection` es el *handle* (`/collections/<handle>`). Varias: `"collections": ["a", "b"]`.
- `woocommerce`: id de categoría.
- `prestashop` / `html`: URL del listado. En `html` se pueden dar selectores CSS en `selectors`.

Prueba con `npm run scrape mi-tienda` y revisa `data/unmatched.txt`, que lista los títulos sin colección
reconocida. Para enseñarle nombres nuevos al clasificador, añádelos a `scraper/classify/aliases.ts`.

## Actualización diaria

- **GitHub Actions** (`.github/workflows/daily.yml`): cada día a las 06:15 lee las tiendas, guarda la base de datos en la rama `datos` (reescrita a diario, sin historial de git) y publica la web en GitHub Pages.
- **Complemento desde el Mac** (`scripts/local-sync.sh`, programado con launchd a las 07:45): algunas tiendas bloquean
  a los servidores de GitHub. El Mac descarga la base de datos de `datos`, lee sólo las tiendas que fallaron en la nube,
  la vuelve a subir y lanza el workflow en modo `publicar` para regenerar la web. Se instala con
  `scripts/install-local-sync.sh` (copia del proyecto en `~/Library/Application Support/PokePrice`, porque macOS no deja
  a las tareas en segundo plano leer discos externos). Registro en `~/Library/Logs/PokePrice/`. Para quitarlo, ver la
  cabecera de ese script.
- Alternativa sin nube: `scripts/daily-local.sh` hace la actualización completa en el Mac.

## Aviso

Los precios son orientativos y no incluyen envío. Fuera de la UE (Japón, Reino Unido, EE. UU., Canadá, Taiwán…)
hay que sumar IVA de importación y gastos de aduana. Pokémon es marca de Nintendo, Creatures y GAME FREAK;
PokéPrice no tiene relación con The Pokémon Company.
