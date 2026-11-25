#!/bin/zsh
# Instala (o actualiza) la lectura diaria desde este Mac:
#  · copia del proyecto en ~/Library/Application Support/PokePrice (clonada de GitHub)
#  · tarea de launchd com.pokeprice.local-sync a las 07:45 y, por si el Mac estaba apagado o la nube iba tarde,
#    otra pasada cada tres horas hasta las 22:45 (si ya está todo hecho, no hace nada)
# Desinstalar:
#   launchctl bootout gui/$(id -u)/com.pokeprice.local-sync
#   rm ~/Library/LaunchAgents/com.pokeprice.local-sync.plist
#   rm -rf ~/Library/Application\ Support/PokePrice
set -e
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
SRC="${0:A:h:h}"
DEST="$HOME/Library/Application Support/PokePrice"
REMOTE=$(git -C "$SRC" remote get-url origin)

if [[ -d "$DEST/.git" ]]; then
  git -C "$DEST" pull -q --ff-only origin main
else
  git clone -q "$REMOTE" "$DEST"
fi
git -C "$DEST" config user.name "$(git -C "$SRC" config user.name)"
git -C "$DEST" config user.email "$(git -C "$SRC" config user.email)"
(cd "$DEST" && npm ci --silent --no-audit --no-fund)

PLIST="$HOME/Library/LaunchAgents/com.pokeprice.local-sync.plist"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pokeprice.local-sync</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$DEST/scripts/local-sync.sh</string></array>
  <key>StartCalendarInterval</key>
  <array>
$(for h in 7 10 13 16 19 22; do echo "    <dict><key>Hour</key><integer>$h</integer><key>Minute</key><integer>45</integer></dict>"; done)
  </array>
  <key>StandardOutPath</key><string>/tmp/pokeprice-local-sync.out</string>
  <key>StandardErrorPath</key><string>/tmp/pokeprice-local-sync.err</string>
</dict>
</plist>
PL
launchctl bootout "gui/$(id -u)/com.pokeprice.local-sync" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Instalado: $DEST · cada día a las 07:45 (y repaso cada 3 h) · registro en ~/Library/Logs/PokePrice/"
