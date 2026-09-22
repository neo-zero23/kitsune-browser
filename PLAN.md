# Kitsune Browser — Plan Yin / Yang

> Minecraft-modelo: un launcher, dos ediciones, vidas separadas. Sin estado compartido.
> Logos en progreso (por neo-zero23). `Yang` = simple/luz, `Yin` = avanzado/oscuridad.

## Ediciones

| | Kitsune Yang (simple) | Kitsune Yin (avanzado) |
|---|---|---|
| Motor | Tauri 2 + webview del sistema (WebKitGTK / WebView2 / WKWebView) | Electron (Chromium) |
| Ritmo | **LTS**: updates pequeños y grandes solo cuando se decida | Rolling normal |
| Target | PCs patata (4GB RAM, HDD, antiX 64-bit) | PCs normales |
| UI | Solo 4 cosas: barra de título, barra de pestañas, barra de herramientas, páginas + dark/light. Lo demás pa' fuera | Mega-custom pro max: workspaces, splits, temas, flags (spec: Zen) |
| Perfil | `~/.config/kitsune-yang/` (propio) | `~/.config/kitsune-yin/` (propio) |
| Adblock/extensiones | No (el webview no expone capa de red — aceptado) | Sí (Ghostery lib a nivel sesión, Fase posterior) |

## Repo

```
kitsune-browser/
  apps/
    launcher/   → Tauri tiny: 2 botones + recordar última edición + autolanzar
    yang/       → Tauri: el simple (PRIMERO)
    yin/        → Electron: lo actual se muda aquí (DESPUÉS)
  docs/
    SPEC-ZEN-MAP.md   → spec visual solo para Yin
    reference/        → capturas de referencia
  vendor/             → zen desktop-dev (spec, no se compila)
```

## Yang (simple) — alcance cerrado

- [ ] Ventana + 1 webview + navegación (urlbar mínima)
- [ ] Tira de pestañas (crear/cerrar/cambiar, 1 webview por tab)
- [ ] Barra de título nativa + dark/light (sigue al sistema)
- [ ] Historial mínimo + bookmarks simple (sqlite propio, formato propio)
- [ ] Releases: AppImage / .deb / AUR `kitsune-yang`, MSI Windows (WebView2 preinstalado), .dmg
- [ ] Test en PC antiX 64-bit: debe abrir con <150MB RAM en reposo

No-objetivos Yang: adblock de red, extensiones, workspaces, splits, sync, containers.

## Launcher — alcance cerrado

- [ ] Ventana única, <10MB binario, ~50MB RAM
- [ ] Botones Yang / Yin + "recordar elección" + `--skip-launcher`
- [ ] Spawn del binario hermano (`../yang/kitsune-yang`, `../yin/kitsune-yin`)
- [ ] Chequeo de updates por edición (ritmos distintos)

## Releases

1. `kitsune` (launcher + yang + yin juntos)
2. `kitsune-yang` (solo simple)
3. `kitsune-yin` (solo avanzado)
4. AUR: 3 paquetes del mismo source, 3 `package_*()`.

## Orden

1. ~~Reestructurar repo a `apps/`~~ ✅ hecho.
2. ~~Scaffold `apps/yang/` Tauri + correr~~ ✅ LTS funcional (Linux + Windows).
3. ~~Yang funcional mínimo → release LTS 1.0~~ ✅ en uso, baseline medido.
4. Launcher (pendiente).
5. **Yin (en progreso)**: scaffold Electron en `apps/yin/` — vertical tabs,
   workspaces, temas + userChrome.css, adblock Ghostery. Ver `apps/yin/SPEC.md`.
