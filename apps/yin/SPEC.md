# Kitsune Yin — spec (avanzado, Electron, rolling)

Esencia Zen, sin copiar código: calma visual, tabs verticales, workspaces,
todo personalizable (temas + userChrome.css), privacidad con adblock a nivel motor.

## v1 (este scaffold)
- [x] Ventana sin menú, fondo oscuro, shell HTML (sidebar + toolbar).
- [x] Tabs verticales en sidebar (WebContentsView por tab, show/hide).
- [x] Workspaces: crear/renombrar/borrar/cambiar (persistidos).
- [x] Toolbar: atrás/adelante/recargar/urlbar. Ctrl+T/W/L.
- [x] Temas: variables CSS + `userChrome.css` + carpeta `themes/*.css`.
- [x] Compact mode (sidebar a iconos) + sidebar izq/der.
- [x] Adblock Ghostery (listas EasyList/uBO) con toggle.
- [x] Newtab con reloj + gradiente (form puro) + settings como overlay.
- [x] window.open → nueva tab. Permisos web denegados por defecto.
- [x] Belleza: Boosts por sitio (`boosts/DOMINIO.css`), tema sistema/
  programado, acento custom, escala UI, toggle animaciones, oscuro forzado.
- [x] Belleza 2 (Brave/Helium): newtab auto-customizable (reloj/buscador/
  fondo/imagen, todo en localStorage sin IPC), frameless + controles propios,
  toggles de botones de toolbar.

## v2 (después)
- Split view (2 vistas), Glance (preview overlay), command palette,
  containers (partitions), sincronización, PiP de medios en sidebar.

## No-objetivos
- Extensiones Firefox, motor Gecko, uBO como extensión (MV3 lo impide).
