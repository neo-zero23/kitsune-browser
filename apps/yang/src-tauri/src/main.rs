//! Kitsune Yang — backend: tab manager con webviews hijo.
//! La UI (webview "main") solo invoca comandos; cada tab es un Webview
//! posicionado debajo del chrome (tabstrip + toolbar).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State, Webview, WebviewUrl, Window};

/// Altura del chrome (tabstrip + toolbar). Debe coincidir con el CSS.
const CHROME_H: f64 = 84.0;

struct Tabs {
    views: HashMap<String, Webview>,
    /// Alto real del chrome, medido por la UI (puede diferir del CSS teórico).
    chrome_h: f64,
    /// Label de la tab visible (None = estado inicial, UI a pantalla completa).
    visible: Option<String>,
}

// Linux: UI y tabs comparten un GtkBox que reparte el espacio ignorando
// posiciones. Solución: montar un GtkOverlay sobre la ventana; la UI queda sola en la
// caja (pantalla completa) y cada tab vive en un GtkFixed con x/y/w/h
// absolutos. Sin tabs, la UI a pantalla completa muestra la vista inicial.
//
// El Fixed se guarda en thread-local (todo el acceso GTK ocurre en el main
// thread vía with_webview): así no hay que buscarlo por el árbol y nunca se
// desengancha un widget sin destino confirmado.
#[cfg(target_os = "linux")]
thread_local! {
    static YANG_FIXED: std::cell::RefCell<Option<gtk::Fixed>> =
        const { std::cell::RefCell::new(None) };
}

#[cfg(target_os = "linux")]
fn yang_fixed() -> Option<gtk::Fixed> {
    YANG_FIXED.with(|f| f.borrow().clone())
}

/// Crea el overlay una sola vez (idempotente). Debe llamarse con ventana
/// realizada (p.ej. al crear la primera tab, no en setup).
#[cfg(target_os = "linux")]
fn ensure_overlay(app: &AppHandle) {
    use gtk::prelude::*;
    let Some(ui) = app.get_webview("main") else {
        eprintln!("[yang] overlay: sin webview main");
        return;
    };
    let _ = ui.with_webview(|w| {
        let widget: webkit2gtk::WebView = w.inner();
        if yang_fixed().is_some() {
            return;
        }
        let toplevel = match widget
            .toplevel()
            .and_then(|t| t.dynamic_cast::<gtk::Window>().ok())
        {
            Some(t) => t,
            None => {
                eprintln!("[yang] overlay: sin toplevel");
                return;
            }
        };
        let vbox = match widget
            .parent()
            .and_then(|p| p.dynamic_cast::<gtk::Box>().ok())
        {
            Some(b) => b,
            None => {
                eprintln!("[yang] overlay: UI no esta en Box");
                return;
            }
        };
        // UI neutra: que llene la caja (luego queda sola en ella).
        vbox.set_child_packing(&widget, true, true, 0, gtk::PackType::Start);
        widget.set_size_request(-1, -1);
        let overlay = gtk::Overlay::new();
        let fixed = gtk::Fixed::new();
        fixed.set_hexpand(true);
        fixed.set_vexpand(true);
        #[allow(deprecated)]
        {
            toplevel.remove(&vbox);
            overlay.add(&vbox);
            overlay.add_overlay(&fixed);
            toplevel.add(&overlay);
        }
        overlay.show_all();
        YANG_FIXED.with(|f| *f.borrow_mut() = Some(fixed));
        eprintln!("[yang] overlay creado");
    });
}

/// Coloca un webview en el fixed con geometría absoluta, preservando visibilidad.
#[cfg(target_os = "linux")]
fn place_tab(view: &Webview, x: i32, y: i32, w: i32, h: i32) {
    use gtk::prelude::*;
    let _ = view.with_webview(move |c| {
        let widget: webkit2gtk::WebView = c.inner();
        let vis = widget.is_visible();
        // NUNCA desenganchar sin destino confirmado (eso huérfana el widget
        // y cuelga la ventana).
        let Some(fixed) = yang_fixed() else {
            eprintln!("[yang] place sin fixed (overlay no montado?)");
            return;
        };
        match widget.parent() {
            Some(p) if p.type_().name() == "GtkFixed" => {
                if let Some(f) = p.dynamic_cast::<gtk::Fixed>().ok() {
                    f.move_(&widget, x, y);
                }
            }
            Some(p) => {
                if let Some(b) = p.clone().dynamic_cast::<gtk::Box>().ok() {
                    b.remove(&widget);
                } else if let Some(cc) = p.clone().dynamic_cast::<gtk::Container>().ok() {
                    cc.remove(&widget);
                } else {
                    eprintln!("[yang] place: padre desconocido, no toco nada");
                    return;
                }
                #[allow(deprecated)]
                fixed.put(&widget, x, y);
            }
            None => {
                eprintln!("[yang] place sin padre");
                return;
            }
        }
        widget.set_size_request(w, h);
        if vis {
            widget.show();
        } else {
            widget.hide();
        }
        eprintln!("[yang] place ({x},{y}) {w}x{h}");
    });
}

/// Tamaño total de la ventana (sin restar chrome), en px lógicos.
#[cfg(target_os = "linux")]
fn full_rect(window: &Window) -> Result<(f64, f64), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    Ok((size.width as f64 / scale, size.height as f64 / scale))
}

/// Recoloca UI (siempre a pantalla completa en el fixed) + tabs.
/// No-op fuera de Linux.
fn apply_layout(app: &AppHandle, tabs: &Tabs) {
    #[cfg(target_os = "linux")]
    {
        ensure_overlay(app);
        let Some(ui) = app.get_webview("main") else {
            eprintln!("[yang] layout sin webview main");
            return;
        };
        if let Some(win) = app.get_window("main") {
            if let Ok((fw, fh)) = full_rect(&win) {
                // UI abajo del todo, a pantalla completa.
                place_tab(&ui, 0, 0, fw as i32, fh as i32);
            }
            if let Ok((w, h)) = content_rect(&win, tabs.chrome_h) {
                let y = ((tabs.chrome_h + y_offset()).max(0.0)) as i32;
                for v in tabs.views.values() {
                    place_tab(v, 0, y, w as i32, h as i32);
                }
            }
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = (app, tabs);
    }
}

fn parse_url(input: &str) -> Result<tauri::Url, String> {
    let t = input.trim();
    if t.is_empty() {
        return Err("url vacía".into());
    }
    if t.starts_with("http://") || t.starts_with("https://") {
        t.parse().map_err(|e| format!("url inválida: {e}"))
    } else if !t.contains(' ') && t.contains('.') {
        format!("https://{t}").parse().map_err(|e| format!("url inválida: {e}"))
    } else {
        let q: String =
            urlencoding_escape(t);
        format!("https://duckduckgo.com/?q={q}")
            .parse()
            .map_err(|e| format!("búsqueda inválida: {e}"))
    }
}

fn urlencoding_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
            out.push(b as char);
        } else if b == b' ' {
            out.push('+');
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Offset manual de prueba (YANG_YOFF, en px lógicos) para calibrar el origen Y
/// del webview hijo en cada backend (Wayland/X11/decoraciones).
fn y_offset() -> f64 {
    std::env::var("YANG_YOFF")
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(0.0)
}

fn content_rect(window: &Window, chrome_h: f64) -> Result<(f64, f64), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let w = size.width as f64 / scale;
    let h = (size.height as f64 / scale - chrome_h).max(100.0);
    eprintln!("[yang] win: scale={scale} inner={}x{} chrome_h={chrome_h}", size.width, size.height);
    Ok((w, h))
}

/// OJO Windows: crear webviews desde un comando SÍNCRONO hace deadlock con
/// WebView2 (ver "Known issues" en docs de WebviewBuilder). Por eso es async.
#[tauri::command]
async fn tab_new(
    app: AppHandle,
    tabs: State<'_, Mutex<Tabs>>,
    label: String,
    url: String,
) -> Result<(), String> {
    create_tab_view(&app, &tabs, label, WebviewUrl::External(parse_url(&url)?))
}

/// Tab vacía: muestra newtab.html (search pelada, sin homepage).
/// Async por lo mismo que tab_new (deadlock WebView2 en Windows).
#[tauri::command]
async fn tab_new_empty(
    app: AppHandle,
    tabs: State<'_, Mutex<Tabs>>,
    label: String,
) -> Result<(), String> {
    create_tab_view(
        &app,
        &tabs,
        label,
        WebviewUrl::App("newtab.html".into()),
    )
}

fn log_path() -> std::path::PathBuf {
    let mut p = std::env::temp_dir();
    p.push("kitsune-yang-debug.log");
    p
}

fn uptime_secs() -> f64 {
    use std::sync::OnceLock;
    static T0: OnceLock<std::time::Instant> = OnceLock::new();
    T0.get_or_init(std::time::Instant::now).elapsed().as_secs_f64()
}

/// Log dual: consola (dev) + archivo (release sin consola, ej. Windows).
/// Ver en Windows con Win+R → %TEMP% → kitsune-yang-debug.log
fn log_line(msg: &str) {
    let t = uptime_secs();
    eprintln!("[yang][{t:.1}s] {msg}");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path())
    {
        use std::io::Write;
        let _ = writeln!(f, "[{t:.1}s] {msg}");
    }
}

fn create_tab_view(
    app: &AppHandle,
    tabs: &State<'_, Mutex<Tabs>>,
    label: String,
    url: WebviewUrl,
) -> Result<(), String> {
    log_line(&format!("new {label}: inicio"));
    let window = app.get_window("main").ok_or("sin ventana main")?;
    let chrome_h = tabs.lock().unwrap().chrome_h;
    let y = (chrome_h + y_offset()).max(0.0);
    let (w, h) = content_rect(&window, chrome_h)?;
    log_line(&format!("new {label}: pos=(0,{y}) size=({w}x{h})"));

    // Cierra la anterior con el mismo label si existiera.
    if let Some(old) = tabs.lock().unwrap().views.remove(&label) {
        let _ = old.close();
    }

    let builder = tauri::webview::WebviewBuilder::new(&label, url);
    // add_child puede colgarse eternamente si el WebView2 está roto/viejo
    // (el callback de creación nunca llega). Hilo + timeout para no congelar.
    let (tx, rx) = std::sync::mpsc::channel::<Result<Webview, String>>();
    let window_c = window.clone();
    std::thread::spawn(move || {
        let res = window_c
            .add_child(
                builder,
                tauri::LogicalPosition::new(0.0, y),
                tauri::LogicalSize::new(w, h),
            )
            .map_err(|e| e.to_string());
        let _ = tx.send(res);
    });
    // WebView2 en Windows puede tardar mucho en crear el primer webview;
    // 60s para máquinas lentas (el invoke es async, la UI no se congela).
    let view = match rx.recv_timeout(std::time::Duration::from_secs(60)) {
        Ok(Ok(v)) => {
            log_line(&format!("new {label}: child ok"));
            v
        }
        Ok(Err(e)) => {
            log_line(&format!("new {label}: add_child ERROR: {e}"));
            return Err(e);
        }
        Err(_) => {
            log_line(&format!("new {label}: TIMEOUT creando webview"));
            return Err("timeout creando la tab (¿WebView2 desactualizado?)".into());
        }
    };
    if let Err(e) = view.set_auto_resize(true) {
        log_line(&format!("new {label}: auto_resize ERROR: {e}"));
    }

    tabs.lock().unwrap().views.insert(label.clone(), view);
    apply_layout(app, &tabs.lock().unwrap());
    log_line(&format!("new {label}: fin ok"));
    Ok(())
}

/// La UI reporta el alto REAL del chrome medido en DOM; se recolocan las tabs.
/// Esto corrige cualquier desajuste (escalado, decoraciones, Wayland/X11).
#[tauri::command]
fn tab_set_chrome(
    app: AppHandle,
    tabs: State<'_, Mutex<Tabs>>,
    h: f64,
) -> Result<(), String> {
    let window = app.get_window("main").ok_or("sin ventana main")?;
    let h = h.clamp(0.0, 400.0);
    let y = (h + y_offset()).max(0.0);
    tabs.lock().unwrap().chrome_h = h;
    let (w, ch) = content_rect(&window, h)?;
    let tabs = tabs.lock().unwrap();
    for v in tabs.views.values() {
        if let Err(e) = v.set_position(tauri::LogicalPosition::new(0.0, y)) {
            eprintln!("[yang] set_position error: {e}");
            return Err(e.to_string());
        }
        if let Err(e) = v.set_size(tauri::LogicalSize::new(w, ch)) {
            eprintln!("[yang] set_size error: {e}");
            return Err(e.to_string());
        }
    }
    #[cfg(target_os = "linux")]
    apply_layout(&app, &tabs);
    Ok(())
}

/// Diagnóstico para la franja negra: devuelve escala, tamaño real y CHROME_H.
#[tauri::command]
fn debug_rect(app: AppHandle) -> Result<serde_json::Value, String> {
    let window = app.get_window("main").ok_or("sin ventana main")?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "scale": scale,
        "inner_w": size.width,
        "inner_h": size.height,
        "chrome_h": CHROME_H,
    }))
}

/// Info para el overlay de diagnóstico (YANG_DEBUG=1): rect real + tabs + flag.
#[tauri::command]
fn debug_info(
    app: AppHandle,
    tabs: State<'_, Mutex<Tabs>>,
) -> Result<serde_json::Value, String> {
    let window = app.get_window("main").ok_or("sin ventana main")?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let tabs = tabs.lock().unwrap();
    let labels: Vec<String> = tabs.views.keys().cloned().collect();
    let mut bounds = serde_json::Map::new();
    for (l, v) in tabs.views.iter() {
        let b = v.bounds().map(|r| {
            serde_json::json!({ "pos": format!("{:?}", r.position), "size": format!("{:?}", r.size) })
        }).unwrap_or(serde_json::json!("?"));
        bounds.insert(l.clone(), b);
    }
    Ok(serde_json::json!({
        "debug": std::env::var("YANG_DEBUG").as_deref() == Ok("1"),
        "scale": scale,
        "inner_w": size.width,
        "inner_h": size.height,
        "chrome_h": tabs.chrome_h,
        "yoff": y_offset(),
        "tabs": labels,
        "bounds": bounds,
    }))
}

/// URL actual de una tab (la UI lo sondea 1 vez/seg para sync de la urlbar,
/// ya que Tauri no expone eventos de navegación en webviews hijo).
#[tauri::command]
fn tab_url(tabs: State<'_, Mutex<Tabs>>, label: String) -> Result<String, String> {
    let tabs = tabs.lock().unwrap();
    let v = tabs.views.get(&label).ok_or("tab inexistente")?;
    v.url().map(|u| u.to_string()).map_err(|e| e.to_string())
}

#[tauri::command]
fn tab_show(
    app: AppHandle,
    tabs: State<'_, Mutex<Tabs>>,
    label: String,
) -> Result<(), String> {
    log_line(&format!("show {label}"));
    {
        let tabs = tabs.lock().unwrap();
        if !tabs.views.contains_key(&label) {
            return Err("tab inexistente".into());
        }
        for (l, v) in tabs.views.iter() {
            if l == &label {
                // best-effort: un webview recién creado puede rechazar show/focus
                // hasta estar realizado; no abortar por eso.
                if let Err(e) = v.show() {
                    log_line(&format!("show {l} error: {e}"));
                }
                if let Err(e) = v.set_focus() {
                    log_line(&format!("focus {l} error: {e}"));
                }
            } else if let Err(e) = v.hide() {
                log_line(&format!("hide {l} error: {e}"));
            }
        }
    }
    tabs.lock().unwrap().visible = Some(label);
    apply_layout(&app, &tabs.lock().unwrap());
    Ok(())
}

#[tauri::command]
fn tab_hide(
    app: AppHandle,
    tabs: State<'_, Mutex<Tabs>>,
    label: String,
) -> Result<(), String> {
    {
        let mut tabs = tabs.lock().unwrap();
        let v = tabs.views.get(&label).ok_or("tab inexistente")?;
        v.hide().map_err(|e| e.to_string())?;
        if tabs.visible.as_deref() == Some(&label) {
            tabs.visible = None;
        }
    }
    apply_layout(&app, &tabs.lock().unwrap());
    Ok(())
}

#[tauri::command]
fn tab_close(
    app: AppHandle,
    tabs: State<'_, Mutex<Tabs>>,
    label: String,
) -> Result<(), String> {
    {
        let mut tabs = tabs.lock().unwrap();
        if let Some(v) = tabs.views.remove(&label) {
            v.close().map_err(|e| e.to_string())?;
        }
        if tabs.visible.as_deref() == Some(&label) {
            tabs.visible = None;
        }
    }
    apply_layout(&app, &tabs.lock().unwrap());
    Ok(())
}

#[tauri::command]
fn tab_navigate(tabs: State<'_, Mutex<Tabs>>, label: String, url: String) -> Result<(), String> {
    let tabs = tabs.lock().unwrap();
    let v = tabs.views.get(&label).ok_or("tab inexistente")?;
    v.navigate(parse_url(&url)?).map_err(|e| e.to_string())?;
    v.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn tab_back(tabs: State<'_, Mutex<Tabs>>, label: String) -> Result<(), String> {
    let tabs = tabs.lock().unwrap();
    let v = tabs.views.get(&label).ok_or("tab inexistente")?;
    let r = v.eval("window.history.back()");
    log_line(&format!("back {label}: {r:?}"));
    r.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn tab_forward(tabs: State<'_, Mutex<Tabs>>, label: String) -> Result<(), String> {
    let tabs = tabs.lock().unwrap();
    let v = tabs.views.get(&label).ok_or("tab inexistente")?;
    let r = v.eval("window.history.forward()");
    log_line(&format!("forward {label}: {r:?}"));
    r.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn tab_reload(tabs: State<'_, Mutex<Tabs>>, label: String) -> Result<(), String> {
    let tabs = tabs.lock().unwrap();
    let v = tabs.views.get(&label).ok_or("tab inexistente")?;
    let r = v.reload();
    log_line(&format!("reload {label}: {r:?}"));
    r.map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(Tabs {
            views: HashMap::new(),
            chrome_h: CHROME_H,
            visible: None,
        }))
        .setup(|app| {
            // Log fresco por arranque.
            let _ = std::fs::remove_file(log_path());
            log_line("arranque yang");
            // Debug/test: YANG_AUTOTAB=url1,url2,... abre tabs al arrancar
            // (para screenshots/benchmark sin teclado).
            if let Ok(urls) = std::env::var("YANG_AUTOTAB") {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    for (i, url) in urls.split(',').enumerate() {
                        let state = handle.state::<Mutex<Tabs>>();
                        let url = match parse_url(url.trim()) {
                            Ok(u) => WebviewUrl::External(u),
                            Err(e) => {
                                eprintln!("[yang] autotab url inválida: {e}");
                                continue;
                            }
                        };
                        if let Err(e) = create_tab_view(
                            &handle,
                            &state,
                            format!("tab-test-{}", i + 1),
                            url,
                        ) {
                            eprintln!("[yang] autotab error: {e}");
                        }
                    }
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            tab_new,
            tab_new_empty,
            tab_show,
            tab_hide,
            tab_close,
            tab_navigate,
            tab_back,
            tab_forward,
            tab_reload,
            tab_url,
            tab_set_chrome,
            debug_rect,
            debug_info
        ])
        .run(tauri::generate_context!())
        .expect("error al correr kitsune-yang");
}
