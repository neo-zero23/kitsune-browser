#!/bin/bash
# benchmark.sh — mide RAM de Kitsune Yang (Linux).
# Uso: ./benchmark.sh   (compila dev si no hay binario release)
# Requiere: binario release en apps/yang/src-tauri/target/release/kitsune-yang
set -u
cd "$(dirname "$0")"
BIN="apps/yang/src-tauri/target/release/kitsune-yang"

if [ ! -x "$BIN" ]; then
  echo "No hay binario release. Compilá primero:"
  echo "  cd apps/yang/src-tauri && cargo build --release"
  exit 1
fi

mem() {
  # RSS total (KB) de yang + procesos WebKit
  ps -o rss=,comm= -C kitsune-yang -C WebKitWebProcess -C WebKitNetworkProcess 2>/dev/null \
    | awk '{kb+=$1; n++} END {printf "%d KB en %d procs (%.1f MB)\n", kb, n, kb/1024}'
}

run_case() {
  local name="$1"; shift
  pkill -f kitsune-yang 2>/dev/null; sleep 1
  if [ $# -gt 0 ]; then
    YANG_AUTOTAB="$1" "$BIN" >/dev/null 2>&1 &
  else
    "$BIN" >/dev/null 2>&1 &
  fi
  sleep 8
  echo "== $name =="
  mem
  echo "   binario: $(du -h "$BIN" | cut -f1)"
  pkill -f kitsune-yang 2>/dev/null
  sleep 1
}

echo "--- Kitsune Yang benchmark ($(date +%F_%T)) ---"
run_case "idle (0 tabs)"
run_case "1 tab" "https://example.com"
run_case "3 tabs" "https://example.com,https://duckduckgo.com,https://es.wikipedia.org"
echo "--- fin ---"
