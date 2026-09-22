# Decisiones de optimización — Kitsune Yang

Fecha: 2026-09-21. Propuesta original de DeepSeek, revisada contra código y docs.
Regla: nada que rompa funcionalidad esencial de un navegador.

## Nivel 1 — Binario Rust: RECHAZADO (casi todo)
- Estado actual (`opt-level="s"`, `lto="thin"`, `strip=true`) → **binario 5.8 MB**.
- `lto="fat"` + `codegen-units=1`: builds de 20-40 min en CI por ganancia de
  un dígito %. No vale la pena en esta etapa.
- `panic="abort"`: mata el proceso sin unwind ante cualquier panic. Riesgo
  sin beneficio medible. No.
- `opt-level="z"`: ganancia marginal sobre "s". No.
- **Conclusión: el binario ya es chico; el tamaño del .exe NO es la RAM.**
  La RAM la ponen los procesos del motor web, que estos flags no tocan.

## Nivel 2a — Flags WebView2 (Windows): PARIDAD CON ZAR (2026-09-22)
- Revisado `zar-browser/optimizations.js`: Zar corre switches equivalentes en
  producción. Portados a Yang vía `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`:
  renderer-process-limit=4, disable-extensions/print/speech/component-update/
  domain-reliability/breakpad, disable-features (Translate,MediaRouter,
  OptimizationHints,DialMediaRouteProvider — SIN lo de Vulkan/ANGLE que es
  específico de Linux Intel), js heap 512 (no 256), disk-cache 50MB.
- Siguen rechazados: background-throttling off, renderer-backgrounding off,
  gpu-compositing off, DoH (no es tema RAM).
- `--disable-background-timer-throttling`, `--disable-renderer-backgrounding`,
  `--disable-backgrounding-occluded-windows`: hacen LO CONTRARIO (impiden que
  Chromium ahorre en background = MÁS consumo). No.
- `--js-flags=--max-old-space-size=256`: crashea por OOM páginas reales
  (Gmail, YouTube, Figma). No.
- `--disable-features=Translate,...`: mata función visible del navegador. No.
- `HeavyAdIntervention` dentro de la lista: desactivar la intervención
  anti-ads pesadas GASTA más. No.
- `--disable-gpu-compositing`: rompe video. No.
- `--disk-cache-size`: inofensivo pero irrelevante para RAM. No aplicado.

## Nivel 2b — Settings WebKitGTK (Linux): RECHAZADO (casi todo)
- `set_enable_media(false)`: mata TODO audio/video (YouTube muerto). No.
- `set_enable_media_stream(false)` + `set_enable_webrtc(false)`: mata
  Meet/Discord/WhatsApp calls. Esencial en 2026. No.
- `set_enable_page_cache(true)`: la page-cache GASTA RAM (guarda páginas
  renderizadas). Dirección contraria al objetivo. No.
- `set_enable_plugins/offline-cache/websql`: APIs muertas o sin efecto. No.
- `set_javascript_can_open_windows_automatically(false)`: es el default de
  WebKitGTK. No hace falta.

## Nivel 3 — Frontend: YA ÓPTIMO (verificado, 0 cambios)
- Vanilla sin framework (194 líneas JS), system-ui, sin @import, sin
  backdrop-filter, sin assets externos. Auditoría con grep, nada que quitar.

## Nivel 4 — Runtime: DIFERIDO
- Tab discarding / auto-close: pierden estado de página (scroll, formularios,
  videos) y cambian semántica de tabs. Diseño pendiente, no para LTS 1.0.
- "Suspender con visibility:hidden por eval": no detiene timers (no dispara
  Page Visibility API). Snake oil. No.
- Lazy loading: ya existe (las tabs solo se crean al abrirlas).

## Meta <100 MB (PCs de 2GB): MODO PATATA experimental (`YANG_POTATO=1`)
- Single-process + sin GPU + sin sandbox (Windows) / single web process +
  sin compositing (Linux). Solo reduce procesos; el motor es el mismo.
- COSTOS (leer antes de usar): sin sandbox = cualquier RCE web compromete
  al usuario; single-process = un crash de renderer mata todo; sin GPU =
  video/Canvas por CPU (más CPU, menos RAM).
- NUNCA por defecto. Medir: baseline normal vs `YANG_POTATO=1` en la misma
  máquina y decidir si el trade-off vale para la edición patata.

## Baseline medido (Windows, Task Manager, con búsqueda DDG abierta)
- Fila "Administrador de WebView2" (215 MB) = **total del grupo**, no un
  proceso (los hijos suman lo mismo: GPU 68 + renderer DDG 66 + browser 43
  + UI 25 + network/storage/crashpad ~12).
- Binario Rust aparte: ~4 MB.
- **Total Yang: ~220 MB vs Zen: 1143 MB (~19%).** Y sin YouTube abierto:
  el renderer de 66 MB era solo resultados de DDG.
- Conclusión: el costo lo pone WebView2 (~215 MB fijos); nuestro código
  (~4 MB) es irrelevante. Único lever real futuro: menos procesos
  (tab discarding, diferido).
