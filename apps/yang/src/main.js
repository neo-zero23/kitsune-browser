// Kitsune Yang — shell UI. Los tabs son webviews hijo creados desde Rust;
// aquí solo se invoca comandos y se pinta el chrome.
// Tab vacía (url null) = muestra newtab.html (search pelada, sin homepage).
const { invoke } = window.__TAURI__.core;

let tabs = []; // {label, url|null}
let active = null;
let counter = 0;

const $ = (id) => document.getElementById(id);
const startView = $("start"), chrome = $("chrome");
const startSearch = $("start-search"), urlbar = $("urlbar"), tabsEl = $("tabs");

function hostOf(url) {
  if (!url) return "Nueva pestaña";
  try { return new URL(url).host || url; } catch { return url; }
}

function render() {
  const has = tabs.length > 0;
  startView.classList.toggle("visible", !has);
  chrome.classList.toggle("hidden", !has);
  tabsEl.innerHTML = "";
  for (const t of tabs) {
    const b = document.createElement("button");
    b.className = "tab" + (t.label === active ? " active" : "");
    const s = document.createElement("span");
    s.className = "host";
    s.textContent = hostOf(t.url);
    const x = document.createElement("span");
    x.className = "x";
    x.textContent = "✕";
    x.title = "Cerrar";
    x.onclick = (e) => { e.stopPropagation(); closeTab(t.label); };
    b.append(s, x);
    b.onclick = () => activateTab(t.label);
    tabsEl.appendChild(b);
  }
  if (active) {
    const t = tabs.find((t) => t.label === active);
    if (t && document.activeElement !== urlbar) urlbar.value = t.url || "";
  } else {
    urlbar.value = "";
  }
  // Reportar alto REAL del chrome para que Rust cuadre el webview hijo.
  requestAnimationFrame(() => {
    if (tabs.length === 0) return;
    syncChrome();
  });
}

function syncChrome() {
  if (tabs.length === 0) return;
  const h = chrome.getBoundingClientRect().height;
  if (h > 0) invoke("tab_set_chrome", { h }).catch(() => {});
}

// Al redimensionar la ventana, recolocar tabs (el fixed no sigue solo).
window.addEventListener("resize", () => syncChrome());

// Primera búsqueda (estado inicial): navega directo.
async function openFirst(input) {
  const label = `tab-${++counter}`;
  try {
    await invoke("tab_new", { label, url: input });
  } catch (e) {
    console.error("tab_new:", e);
    showStatus("Error al abrir: " + e);
    return;
  }
  tabs.push({ label, url: input });
  await activateTab(label);
}

let statusTimer = null;
function showStatus(msg) {
  const el = $("status");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.add("hidden"), 4000);
}

// Nuevas tabs (después de la primera): vacías, con su propia search.
async function newEmptyTab() {
  const label = `tab-${++counter}`;
  await invoke("tab_new_empty", { label });
  tabs.push({ label, url: null });
  await activateTab(label);
}

async function activateTab(label) {
  active = label;
  try {
    await invoke("tab_show", { label });
  } finally {
    render();
  }
}

async function closeTab(label) {
  await invoke("tab_close", { label }).catch(() => {});
  tabs = tabs.filter((t) => t.label !== label);
  if (active === label) {
    active = tabs.length ? tabs[tabs.length - 1].label : null;
    if (active) await invoke("tab_show", { label: active }).catch(() => {});
    else startSearch.focus();
  }
  render();
}

startSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && startSearch.value.trim()) openFirst(startSearch.value.trim());
});

urlbar.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const v = urlbar.value.trim();
  if (!v || !active) return;
  invoke("tab_navigate", { label: active, url: v }).then(() => {
    const t = tabs.find((t) => t.label === active);
    if (t) { t.url = v; render(); }
  }).catch(() => {});
});

$("new-tab").onclick = newEmptyTab;
$("btn-back").onclick = () => { if (active) invoke("tab_back", { label: active }).catch((e) => console.error("back:", e)); };
$("btn-fwd").onclick = () => { if (active) invoke("tab_forward", { label: active }).catch((e) => console.error("forward:", e)); };
$("btn-reload").onclick = () => {
  if (!active) return;
  const b = $("btn-reload");
  b.classList.add("spinning");
  setTimeout(() => b.classList.remove("spinning"), 1200);
  invoke("tab_reload", { label: active }).catch((e) => console.error("reload:", e));
};

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") { e.preventDefault(); if (tabs.length) newEmptyTab(); else startSearch.focus(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w") { e.preventDefault(); if (active) closeTab(active); }
});

// Watchdog IPC: si el puente no responde, avisar (WebView2 viejo = IPC muerto).
setTimeout(() => {
  if (!window.__TAURI__) showStatus("Puente Tauri ausente — instala con el setup .exe (incluye WebView2)");
}, 3000);
let ipcFails = 0;
setInterval(async () => {
  if (!active || document.activeElement === urlbar) return;
  try {
    const url = await invoke("tab_url", { label: active });
    // newtab.html tiene URL de app; tratarla como vacía.
    const clean = url.startsWith("http") ? url : null;
    const t = tabs.find((t) => t.label === active);
    if (t && t.url !== clean) {
      t.url = clean;
      urlbar.value = clean || "";
      render();
    }
  } catch {}
}, 1000);

startSearch.focus();
render();

// Overlay de diagnóstico (YANG_DEBUG=1): pinta la UI de magenta para ver
// si la franja negra es la UI asomando o contenido del webview hijo.
// Overlay de diagnóstico (YANG_DEBUG=1). Se refresca 1 vez/seg para ver bounds reales.
function refreshDebug() {
  invoke("debug_info").then((info) => {
    ipcFails = 0;
    if (!info.debug) return;
    document.body.style.background = "magenta";
    const cs = getComputedStyle(startView);
    const cr = chrome.getBoundingClientRect();
    const extra = {
      startDisplay: cs.display,
      chromeTop: cr.top,
      chromeH_dom: cr.height,
      scrollY: window.scrollY,
      dpr: window.devicePixelRatio,
      uiInnerW: window.innerWidth,
      uiInnerH: window.innerHeight,
    };
    let d = document.getElementById("dbg");
    if (!d) {
      d = document.createElement("div");
      d.id = "dbg";
      d.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:9999;background:#000;color:#0f0;font:12px monospace;padding:8px;white-space:pre;max-height:60vh;overflow:auto;";
      document.body.appendChild(d);
    }
    d.textContent = JSON.stringify({ ...info, ...extra }, null, 1);
  }).catch(() => {
    if (++ipcFails === 4) showStatus("Sin respuesta del backend — instala con el setup .exe (incluye WebView2)");
  });
}
refreshDebug();
setInterval(refreshDebug, 1000);
