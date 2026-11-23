#!/bin/zsh
# Lee desde este Mac las tiendas que bloquean a los servidores de GitHub y republica la web.
# Lo ejecuta launchd cada día (ver scripts/com.pokeprice.local-sync.plist). Registro en data/logs/.
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "${0:A:h}/.." || exit 1
mkdir -p data/logs
exec >> "data/logs/local-sync-$(date +%F).log" 2>&1
echo "== $(date '+%F %T')"
node --disable-warning=ExperimentalWarning scraper/local-sync.ts
echo "== fin ($?)"
