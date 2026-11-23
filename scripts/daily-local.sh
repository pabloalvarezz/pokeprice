#!/bin/zsh
# Actualización diaria en este Mac (alternativa a GitHub Actions).
# Requiere que el disco "dureza" esté montado a la hora programada.
set -e
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
mkdir -p data/logs
npm run -s update >> "data/logs/$(date +%F).log" 2>&1
npm run -s build >> "data/logs/$(date +%F).log" 2>&1
