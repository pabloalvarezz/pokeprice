#!/bin/zsh
# Lee desde este Mac las tiendas que bloquean a los servidores de GitHub y republica la web.
# Lo ejecuta launchd cada día desde una copia del proyecto en ~/Library/Application Support/PokePrice
# (fuera del disco externo, que macOS no deja leer a las tareas en segundo plano).
# Registro: ~/Library/Logs/PokePrice/
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
REPO="${0:A:h:h}"
LOGS="$HOME/Library/Logs/PokePrice"
mkdir -p "$LOGS"
exec >> "$LOGS/local-sync-$(date +%F).log" 2>&1
echo "== $(date '+%F %T') en $REPO"
cd "$REPO" || exit 1

# Al día con GitHub (código y lista de tiendas); dependencias sólo si cambian
LOCK_BEFORE=$(shasum package-lock.json | cut -d' ' -f1)
git pull -q --ff-only origin main || echo "aviso: no se pudo actualizar el código; sigo con la versión local"
if [[ ! -d node_modules || "$LOCK_BEFORE" != "$(shasum package-lock.json | cut -d' ' -f1)" ]]; then
  npm ci --silent --no-audit --no-fund
fi

node --disable-warning=ExperimentalWarning scraper/local-sync.ts "$@"
echo "== fin ($?)"
