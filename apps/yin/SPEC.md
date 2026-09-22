# Kitsune Yin — spec (avanzado, Electron, rolling)

Esencia Zen, sin copiar código: calma visual, tabs verticales, workspaces,
todo personalizable (temas + userChrome.css), privacidad con adblock a nivel motor.

## v1 (este scaffold)
- [ ] Ventana sin menú, fondo oscuro, shell HTML (sidebar + toolbar).
- [ ] Tabs verticales en sidebar (WebContentsView por tab, show/hide).
- [ ] Workspaces: crear/renombrar/borrar/cambiar (persistidos).
- [ ] Toolbar: atrás/adelante/recargar/urlbar. Ctrl+T/W/L.
- [ ] Temas: variables CSS + `userChrome.css` + carpeta `themes/*.css`.
- [ ] Compact mode (sidebar a iconos) + sidebar izq/der.
- [ ] Adblock Ghostery (listas EasyList/uBO) con toggle.
- [ ] Newtab mínima (form puro, sin JS) + settings como overlay del shell.
- [ ] window.open → nueva tab. Permisos web denegados por defecto.

## v2 (después)
- Split view (2 vistas), Glance (preview overlay), command palette,
  containers (partitions), sincronización, PiP de medios en sidebar.

## No-objetivos
- Extensiones Firefox, motor Gecko, uBO como extensión (MV3 lo impide).
