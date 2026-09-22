# kitsune-browser 🦊☯️

**Kitsune Yang** — navegador simple y liviano (Tauri). El único activo.

## Estado
- ✅ **Yang** (`apps/yang/`): estable, LTS. Tauri 2 + webview del sistema.
- 🧊 **Yin** (`apps/yin/`): ARCHIVADO (código v1 conservado, sin desarrollo).
- 🧊 **Launcher** (`apps/launcher/`): ARCHIVADO (vacío, sin desarrollo).

## Por qué solo Yang
Alcance. Llevar 4 navegadores (prism, neutron, zar + kitsune×2) es scope
creep garantizado: cada edición multiplica mantenimiento, CI y releases.
Yang ya cumple su misión (liviano, simple, medido) y es lo único que se
mantiene. Yin y Launcher quedan congelados sin fecha de retorno; su código
sigue en el repo por si algún día se retoman.

Ver `PLAN.md`, `apps/yang/SPEC.md` y `docs/ROADMAP.md`.

## Correr Yang (dev)
```bash
# Requiere Rust (rustup) + webkit2gtk dev
export PATH="$HOME/.cargo/bin:$PATH"
cd apps/yang && npm install && npx tauri dev
```
