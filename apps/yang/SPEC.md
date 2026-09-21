# Kitsune Yang — spec funcional (simple, LTS)

## Estado inicial (cero tabs)
- SOLO barra de búsqueda centrada. Sin logo, sin hint, sin homepage.

## Flujo
1. Escribís + Enter → **primera tab** navega directo. Aparecen tabstrip + toolbar.
2. `+` o `Ctrl+T` → **tab vacía**: chrome visible + `newtab.html` (search pelada, fondo dark/light).
   Buscar ahí navega esa misma tab.
3. `✕` en el chip o `Ctrl+W` → cierra tab. Sin tabs → vuelve al inicio pelado.
4. Toolbar: ← → ⟳ + urlbar. Un solo ✕ (el del chip).

## Reglas URL
- `algo.com` → `https://algo.com` · otro texto → DuckDuckGo.
