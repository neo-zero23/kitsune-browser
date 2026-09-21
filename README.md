# kitsune-browser 🦊☯️

Un launcher, dos ediciones, vidas separadas (modelo Minecraft: Java/Bedrock comparten launcher, nada más).

| Edición | Motor | Ritmo | Target |
|---|---|---|---|
| **Kitsune Yang** ☀️ (simple) | Tauri 2 + webview del sistema | LTS | PCs patata (4GB RAM, HDD) |
| **Kitsune Yin** 🌙 (avanzado) | Electron (Chromium) | Rolling | PCs normales |
| **Launcher** | Tauri tiny | — | Elige edición y lanza |

## Estado
- `apps/yang/` — en desarrollo (primero). Sin homepage: búsqueda flotante centrada → Enter abre tab. `Ctrl+T` = inicio + burbuja reabrible, `Ctrl+W` = cerrar tab.
- `apps/yin/` — pendiente (spec visual: Zen Browser).
- `apps/launcher/` — pendiente.

Ver `PLAN.md` y `apps/yang/SPEC.md`.

## Correr Yang (dev)
```bash
# Requiere Rust (rustup) + webkit2gtk dev (Cachy: ya viene / sudo pacman -S webkit2gtk-4.1)
export PATH="$HOME/.cargo/bin:$PATH"
cd apps/yang && npm install && npx tauri dev
```
