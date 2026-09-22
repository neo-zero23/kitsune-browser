#!/usr/bin/env bash
# Workaround: en Node 26 el postinstall de Electron (extract-zip) deja
# dist/ a medias. Esto extrae el zip cacheado a mano y fija path.txt.
# Uso: npm install; npm run fix-electron
set -e
ELECTRON_VER=$(node -e "console.log(require('./node_modules/electron/package.json').version)")
CACHE_DIR="$HOME/.cache/electron"
ZIP=$(ls "$CACHE_DIR"/*/electron-v${ELECTRON_VER}-linux-x64.zip 2>/dev/null | head -n 1)
if [ -z "$ZIP" ]; then
  echo "No hay zip cacheado para v$ELECTRON_VER. Corre 'node node_modules/electron/install.js' con red primero."
  exit 1
fi
rm -rf node_modules/electron/dist
mkdir -p node_modules/electron/dist
unzip -q "$ZIP" -d node_modules/electron/dist
printf 'electron' > node_modules/electron/path.txt
./node_modules/electron/dist/electron --version
