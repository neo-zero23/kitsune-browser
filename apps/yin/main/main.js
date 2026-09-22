// Kitsune Yin — main process v1.
// Shell HTML (sidebar+toolbar) en BrowserWindow; cada tab un WebContentsView.
// Lecciones aplicadas: sin menú, fondo oscuro, about:blank NUNCA (es blanco
// en Chromium), CSS/JS verificados con node --check.
const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Store = require('electron-store');

const store = new Store({
  name: 'kitsune-yin',
  defaults: {
    themeMode: 'dark', // dark | light | system | scheduled
    dayStart: 7, // hora inicio modo claro (scheduled)
    nightStart: 19, // hora inicio modo oscuro (scheduled)
    accent: null, // color CSS o null (default)
    fontScale: 1,
    animations: true,
    forceDark: false, // filtro invert en webs (modo oscuro forzado)
    customTheme: null, // nombre de archivo en themes/
    compact: false,
    sidebarSide: 'left', // left | right
    adblock: true,
    searchEngine: 'duckduckgo', // duckduckgo | brave | mojeek | google
    workspaces: [{ id: 'main', name: 'Principal', icon: '🏠' }],
    activeWorkspace: 'main',
  },
});

const ENGINES = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  brave: 'https://search.brave.com/search?q=',
  mojeek: 'https://www.mojeek.com/search?q=',
  google: 'https://www.google.com/search?q=',
};

const shellFile = () => path.join(__dirname, '..', 'renderer', 'shell', 'index.html');
const newtabURL = () => 'file://' + path.join(__dirname, '..', 'renderer', 'pages', 'newtab.html');
const themesDir = () => path.join(app.getPath('userData'), 'themes');

let win;
let tabs = new Map(); // id -> {view, url, title, favicon, workspace}
let tabSeq = 0;
let activeTab = null;
let blocker = null;

const sidebarWidth = () => (store.get('compact') ? 56 : 248);
const activeWorkspace = () => store.get('activeWorkspace');

function resolveInput(input) {
  const v = String(input || '').trim();
  if (!v) return newtabURL();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^file:\/\//i.test(v)) return v;
  if (v.includes('.') && !v.includes(' ')) return 'https://' + v;
  const base = ENGINES[store.get('searchEngine')] || ENGINES.duckduckgo;
  return base + encodeURIComponent(v);
}

function layout() {
  if (!win || win.isDestroyed()) return;
  const b = win.getContentBounds();
  const sbw = sidebarWidth();
  const side = store.get('sidebarSide');
  const x = side === 'left' ? sbw : 0;
  for (const t of tabs.values()) {
    t.view.setBounds({ x, y: 0, width: Math.max(200, b.width - sbw), height: b.height });
  }
}

function pushTabs() {
  if (!win || win.isDestroyed()) return;
  const list = [...tabs.entries()].map(([id, t]) => ({
    id, url: t.url, title: t.title || t.url, favicon: t.favicon || null,
    workspace: t.workspace, active: id === activeTab,
  }));
  win.webContents.send('yin:tabs', {
    tabs: list,
    workspaces: store.get('workspaces'),
    activeWorkspace: activeWorkspace(),
    settings: {
      themeMode: store.get('themeMode'), dayStart: store.get('dayStart'),
      nightStart: store.get('nightStart'), accent: store.get('accent'),
      fontScale: store.get('fontScale'), animations: store.get('animations'),
      forceDark: store.get('forceDark'),
      customTheme: store.get('customTheme'),
      compact: store.get('compact'), sidebarSide: store.get('sidebarSide'),
      adblock: store.get('adblock'), searchEngine: store.get('searchEngine'),
    },
  });
}

function createTab(url, workspace) {
  const id = `tab-${++tabSeq}`;
  const view = new WebContentsView({
    webPreferences: { contextIsolation: true },
  });
  view.setBackgroundColor('#1b1b1b');
  const tab = { view, url: '', title: '', favicon: null, workspace: workspace || activeWorkspace() };
  tabs.set(id, tab);
  win.contentView.addChildView(view);

  const wc = view.webContents;
  wc.on('did-navigate', (_e, navUrl) => {
    tab.url = navUrl;
    if (id === activeTab) win.webContents.send('yin:url', { id, url: navUrl });
    pushTabs();
  });
  wc.on('did-navigate-in-page', (_e, navUrl) => {
    tab.url = navUrl;
    if (id === activeTab) win.webContents.send('yin:url', { id, url: navUrl });
    pushTabs();
  });
  wc.on('page-title-updated', (_e, title) => { tab.title = title; pushTabs(); });
  wc.on('page-favicon-updated', (_e, favicons) => {
    tab.favicon = (favicons && favicons[0]) || null;
    pushTabs();
  });
  // Boosts por dominio + modo oscuro forzado al pintar el DOM.
  wc.on('dom-ready', () => {
    applyBoost(wc);
    if (store.get('forceDark')) {
      delete tab.darkKey;
      applyForceDarkTab(tab);
    }
  });
  // window.open → nueva tab (misma workspace).
  wc.setWindowOpenHandler(({ url }) => {
    const nid = createTab(url, tab.workspace);
    activateTab(nid);
    return { action: 'deny' };
  });

  try {
    wc.loadURL(url || newtabURL());
  } catch {}
  layout();
  pushTabs();
  return id;
}

function activateTab(id) {
  if (!tabs.has(id)) return;
  activeTab = id;
  const order = [...tabs.keys()];
  for (const [tid, t] of tabs) {
    if (tid === id) {
      win.contentView.addChildView(t.view);
      try { t.view.webContents.focus(); } catch {}
    } else {
      try { win.contentView.removeChildView(t.view); } catch {}
    }
  }
  // Reordenar z: la activa al frente re-agregando al final.
  void order;
  layout();
  const t = tabs.get(id);
  if (t) win.webContents.send('yin:url', { id, url: t.url });
  pushTabs();
}

function closeTab(id) {
  const t = tabs.get(id);
  if (!t) return;
  try { win.contentView.removeChildView(t.view); } catch {}
  try { t.view.webContents.close(); } catch {}
  tabs.delete(id);
  if (activeTab === id) {
    const sameWs = [...tabs.entries()].filter(([, x]) => x.workspace === t.workspace);
    const pool = sameWs.length ? sameWs : [...tabs.entries()];
    activeTab = pool.length ? pool[pool.length - 1][0] : null;
    if (activeTab) activateTab(activeTab);
    else {
      const nid = createTab(newtabURL(), t.workspace);
      activateTab(nid);
    }
  }
  layout();
  pushTabs();
}

async function initAdblock() {
  if (!store.get('adblock')) return;
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    blocker.enableBlockingInSession(session.defaultSession);
    console.log('[yin] adblock ON');
  } catch (e) {
    console.log('[yin] adblock OFF:', e.message);
  }
}

function ensureThemesDir() {
  try { fs.mkdirSync(themesDir(), { recursive: true }); } catch {}
}

function listThemes() {
  ensureThemesDir();
  try {
    return fs.readdirSync(themesDir()).filter((f) => f.endsWith('.css'));
  } catch {
    return [];
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 800,
    minHeight: 540,
    title: 'Kitsune Yin',
    backgroundColor: '#1b1b1b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  win.setMenu(null);
  win.loadFile(shellFile());
  win.on('resize', layout);

  // Privacidad: denegar permisos web por defecto (notifis, geo, etc).
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  initAdblock();

  const id = createTab(newtabURL(), activeWorkspace());
  activateTab(id);
}

// ---------- IPC ----------
ipcMain.handle('yin:tab-new', (_e, url) => {
  const id = createTab(resolveInput(url), activeWorkspace());
  activateTab(id);
  return id;
});
ipcMain.handle('yin:tab-close', (_e, id) => { closeTab(id || activeTab); });
ipcMain.handle('yin:tab-activate', (_e, id) => activateTab(id));
// Oculta la vista activa (para mostrar overlays del shell por encima).
ipcMain.handle('yin:content-hide', () => {
  const t = tabs.get(activeTab);
  if (t) { try { win.contentView.removeChildView(t.view); } catch {} }
});
ipcMain.handle('yin:tab-navigate', (_e, payload) => {
  const { id, url } = payload || {};
  const t = tabs.get(id || activeTab);
  if (!t) return;
  try { t.view.webContents.loadURL(resolveInput(url)); } catch {}
});
ipcMain.handle('yin:nav-back', () => { const t = tabs.get(activeTab); if (t && t.view.webContents.navigationHistory.canGoBack()) t.view.webContents.navigationHistory.goBack(); });
ipcMain.handle('yin:nav-forward', () => { const t = tabs.get(activeTab); if (t && t.view.webContents.navigationHistory.canGoForward()) t.view.webContents.navigationHistory.goForward(); });
ipcMain.handle('yin:nav-reload', () => { const t = tabs.get(activeTab); if (t) t.view.webContents.reload(); });

ipcMain.handle('yin:ws-switch', (_e, id) => {
  const ws = store.get('workspaces');
  if (!ws.find((w) => w.id === id)) return;
  store.set('activeWorkspace', id);
  const inWs = [...tabs.entries()].filter(([, t]) => t.workspace === id);
  if (inWs.length) activateTab(inWs[inWs.length - 1][0]);
  else {
    const nid = createTab(newtabURL(), id);
    activateTab(nid);
  }
  pushTabs();
});
ipcMain.handle('yin:ws-create', (_e, name) => {
  const ws = store.get('workspaces');
  const id = 'ws-' + Date.now().toString(36);
  ws.push({ id, name: String(name || 'Nuevo').slice(0, 24), icon: '🌀' });
  store.set('workspaces', ws);
  pushTabs();
  return id;
});
ipcMain.handle('yin:ws-rename', (_e, payload) => {
  const { id, name, icon } = payload || {};
  const ws = store.get('workspaces').map((w) =>
    w.id === id ? { ...w, name: String(name || w.name).slice(0, 24), icon: icon || w.icon } : w
  );
  store.set('workspaces', ws);
  pushTabs();
});
ipcMain.handle('yin:ws-delete', (_e, id) => {
  let ws = store.get('workspaces');
  if (ws.length <= 1 || !ws.find((w) => w.id === id)) return;
  ws = ws.filter((w) => w.id !== id);
  store.set('workspaces', ws);
  const keep = ws[ws.length - 1].id;
  for (const [tid, t] of [...tabs.entries()]) {
    if (t.workspace === id) closeTab(tid);
  }
  if (store.get('activeWorkspace') === id) {
    store.set('activeWorkspace', keep);
    const nid = createTab(newtabURL(), keep);
    activateTab(nid);
  }
  pushTabs();
});
ipcMain.handle('yin:tab-move-ws', (_e, payload) => {
  const { id, workspace } = payload || {};
  const t = tabs.get(id || activeTab);
  if (!t || !store.get('workspaces').find((w) => w.id === workspace)) return;
  t.workspace = workspace;
  pushTabs();
});

ipcMain.handle('yin:settings-set', (_e, patch) => {
  const cur = {
    themeMode: store.get('themeMode'), dayStart: store.get('dayStart'),
    nightStart: store.get('nightStart'), accent: store.get('accent'),
    fontScale: store.get('fontScale'), animations: store.get('animations'),
    forceDark: store.get('forceDark'),
    customTheme: store.get('customTheme'),
    compact: store.get('compact'), sidebarSide: store.get('sidebarSide'),
    adblock: store.get('adblock'), searchEngine: store.get('searchEngine'),
  };
  const next = { ...cur, ...(patch || {}) };
  const adblockChanged = next.adblock !== cur.adblock;
  const forceDarkChanged = next.forceDark !== cur.forceDark;
  for (const k of Object.keys(cur)) store.set(k, next[k]);
  if (adblockChanged) {
    if (next.adblock) initAdblock();
    else if (blocker) {
      try { blocker.disableBlockingInSession(session.defaultSession); } catch {}
      blocker = null;
    }
  }
  if (forceDarkChanged) applyForceDarkAll(next.forceDark);
  layout();
  pushTabs();
  return next;
});
ipcMain.handle('yin:themes-list', () => ({ dir: themesDir(), files: listThemes() }));
ipcMain.handle('yin:theme-read', (_e, name) => {
  try {
    return fs.readFileSync(path.join(themesDir(), path.basename(name)), 'utf-8').slice(0, 200000);
  } catch {
    return '';
  }
});

// ---------- Boosts: CSS por dominio (estilo Arc Boosts) ----------
// boosts/<dominio>.css se inyecta en dom-ready si el host coincide.
function boostsDir() {
  const d = path.join(app.getPath('userData'), 'boosts');
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
  return d;
}
function boostsState() {
  try {
    return JSON.parse(fs.readFileSync(path.join(boostsDir(), 'boosts.json'), 'utf-8'));
  } catch {
    return {};
  }
}
function boostsSave(st) {
  try { fs.writeFileSync(path.join(boostsDir(), 'boosts.json'), JSON.stringify(st, null, 2)); } catch {}
}
function listBoosts() {
  const dir = boostsDir();
  const st = boostsState();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.css')); } catch {}
  return files.map((f) => ({ file: f, domain: f.slice(0, -4), enabled: st[f] !== false }));
}
function boostMatches(host, domain) {
  host = String(host || '').toLowerCase();
  domain = String(domain || '').toLowerCase();
  return host === domain || host.endsWith('.' + domain);
}
function hostOfUrl(u) {
  try { return new URL(u).host || ''; } catch { return ''; }
}
function applyBoost(wc) {
  let url = '';
  try { url = wc.getURL(); } catch { return; }
  if (!/^https?:\/\//i.test(url)) return;
  const host = hostOfUrl(url);
  for (const b of listBoosts()) {
    if (!b.enabled || !boostMatches(host, b.domain)) continue;
    try {
      const css = fs.readFileSync(path.join(boostsDir(), b.file), 'utf-8').slice(0, 200000);
      if (css.trim()) wc.insertCSS(css).catch(() => {});
    } catch {}
  }
}

// ---------- Modo oscuro forzado (filtro invert global) ----------
const DARK_CSS = 'html{filter:invert(1) hue-rotate(180deg) !important;background:#111 !important;}img,video,picture,canvas,[style*="background-image"],svg image{filter:invert(1) hue-rotate(180deg) !important;}';
function applyForceDarkTab(tab) {
  if (!tab || tab.darkKey) return;
  let url = '';
  try { url = tab.view.webContents.getURL(); } catch { return; }
  if (!/^https?:\/\//i.test(url)) return;
  tab.view.webContents.insertCSS(DARK_CSS).then((k) => { tab.darkKey = k; }).catch(() => {});
}
function applyForceDarkAll(on) {
  for (const t of tabs.values()) {
    if (on) {
      delete t.darkKey;
      applyForceDarkTab(t);
    } else if (t.darkKey) {
      try { t.view.webContents.removeInsertedCSS(t.darkKey).catch(() => {}); } catch {}
      delete t.darkKey;
    }
  }
}

ipcMain.handle('yin:boosts-list', () => ({ dir: boostsDir(), files: listBoosts() }));
ipcMain.handle('yin:boost-toggle', (_e, payload) => {
  const { file, enabled } = payload || {};
  if (!file) return;
  const st = boostsState();
  st[path.basename(file)] = !!enabled;
  boostsSave(st);
  // Recargar tabs afectadas para aplicar/quitar.
  const domain = path.basename(file).replace(/\.css$/i, '');
  for (const t of tabs.values()) {
    if (boostMatches(hostOfUrl(t.url), domain)) {
      try { t.view.webContents.reload(); } catch {}
    }
  }
  pushTabs();
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
