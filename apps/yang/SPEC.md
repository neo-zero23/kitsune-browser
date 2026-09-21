# Kitsune Yang — spec funcional (simple, LTS)

Navegador normal: chrome siempre visible (título nativo + tabstrip +
toolbar con urlbar). Sin estados especiales, sin homepage con búsqueda.

## Flujo
1. Al abrir: se crea sola la primera tab vacía (página en blanco).
   Todo se navega desde la urlbar de arriba.
2. Escribís en la urlbar + Enter:
   - `algo.com` → `https://algo.com`
   - otro texto → DuckDuckGo
3. `+` o `Ctrl+T` → nueva tab vacía.
4. `✕` del chip o `Ctrl+W` → cierra. Al cerrar la última, se abre
   otra vacía (la ventana nunca queda sin tabs).
5. Toolbar: ← → ⟳ + urlbar (spinner en ⟳ al recargar).

## No-objetivos
Adblock de red, extensiones, workspaces, splits, sync, containers,
homepage con búsqueda, burbujas.
