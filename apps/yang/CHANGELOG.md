# Changelog — Kitsune Yang

## yang-v0.1.0 (LTS inicial)
Navegador simple y liviano (Tauri 2 + webview del sistema).
- Inicio instantáneo: una tab vacía, todo por la barra de direcciones.
- Tabs múltiples, atrás/adelante/recargar, Ctrl+T/W.
- Búsqueda DuckDuckGo (dominios van directo, resto a búsqueda).
- Claro/oscuro según el sistema. Binario ~6 MB, ~220 MB RAM total.
- Medido en Windows contra Chromium pelado: a la par (ver docs/DECISIONS.md).
- `YANG_POTATO=1`: modo experimental mínimo consumo (sin sandbox, solo testeo).
