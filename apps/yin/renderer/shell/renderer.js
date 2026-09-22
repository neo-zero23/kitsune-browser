// Kitsune Yin — shell UI. Estado espejo vía yin:onTabs; acciones por invoke.
const $ = (id) => document.getElementById(id);
const wsEl = $('workspaces'), tabsEl = $('tabs'), urlbar = $('urlbar');
const settingsEl = $('settings');

let state = { tabs: [], workspaces: [], activeWorkspace: 'main', settings: {}, bookmarks: [] };

function shade(hex, amt) {
  const n = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => {
    const c = Math.min(255, Math.max(0, parseInt(n.slice(i, i + 2), 16) + amt));
    return c.toString(16).padStart(2, '0');
  });
  return '#' + v.join('');
}

function makeTabChip(t) {
  const b = document.createElement('button');
  b.className = 'tab' + (t.active ? ' active' : '');
  const fav = t.favicon ? `<img class="fav" src="${esc(t.favicon)}" />` : '';
  b.innerHTML = `${fav}<span class="host">${esc(hostOf(t))}</span>`;
  b.title = t.url + ' (doble click: mover de workspace)';
  b.onclick = () => window.yin.tabActivate(t.id);
  const x = document.createElement('span');
  x.className = 'x';
  x.textContent = '✕';
  x.onclick = (e) => { e.stopPropagation(); window.yin.tabClose(t.id); };
  b.appendChild(x);
  b.ondblclick = () => {
    const ids = state.workspaces.map((w) => w.id);
    const next = ids[(ids.indexOf(t.workspace) + 1) % ids.length];
    window.yin.tabMoveWs(t.id, next);
  };
  return b;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function render() {
  applyMode();
  const s = state.settings;
  document.documentElement.dataset.compact = s.compact ? 'true' : 'false';
  document.documentElement.dataset.side = s.sidebarSide || 'left';
  document.documentElement.dataset.anim = s.animations === false ? 'false' : 'true';
  document.documentElement.dataset.frameless = s.frameless ? 'true' : 'false';
  document.documentElement.dataset.tabpos = s.tabPosition || 'side';
  document.documentElement.dataset.transparency = s.transparency ? 'true' : 'false';
  document.documentElement.style.setProperty('--accent', s.accent || '#7aa2f7');
  if (s.themeBase) {
    document.documentElement.style.setProperty('--bg', s.themeBase);
    document.documentElement.style.setProperty('--bar', shade(s.themeBase, 14));
  } else {
    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--bar');
  }
  document.getElementById('app').style.zoom = s.fontScale || 1;
  $('win-controls').classList.toggle('hidden', !s.frameless);
  $('btn-back').style.display = s.showBack === false ? 'none' : '';
  $('btn-fwd').style.display = s.showFwd === false ? 'none' : '';
  $('btn-reload').style.display = s.showReload === false ? 'none' : '';

  wsEl.innerHTML = '';
  for (const w of state.workspaces) {
    const b = document.createElement('button');
    b.className = 'ws' + (w.id === state.activeWorkspace ? ' active' : '');
    b.innerHTML = `<span>${esc(w.icon || '🌀')}</span><span class="ws-name">${esc(w.name)}</span>`;
    b.title = w.name + ' (doble click renombra)';
    b.onclick = () => window.yin.wsSwitch(w.id);
    b.ondblclick = () => {
      const name = prompt('Nombre:', w.name);
      if (name !== null) window.yin.wsRename(w.id, name);
    };
    if (state.workspaces.length > 1) {
      const x = document.createElement('span');
      x.className = 'ws-x';
      x.textContent = '✕';
      x.title = 'Borrar workspace';
      x.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Borrar "${w.name}" y sus tabs?`)) window.yin.wsDelete(w.id);
      };
      b.appendChild(x);
    }
    wsEl.appendChild(b);
  }

  tabsEl.innerHTML = '';
  const mine = state.tabs.filter((t) => t.workspace === state.activeWorkspace);
  for (const t of mine) tabsEl.appendChild(makeTabChip(t));

  // Tabs horizontales (modo top).
  const topEl = $('tabs-top');
  if (topEl) {
    topEl.innerHTML = '';
    for (const t of mine) topEl.appendChild(makeTabChip(t));
  }

  // Bookmarks.
  const bm = $('bookmarks');
  bm.innerHTML = '';
  for (const m of state.bookmarks || []) {
    const b = document.createElement('button');
    b.textContent = m.title || m.url;
    b.title = m.url + ' (doble click borra)';
    b.onclick = () => window.yin.tabNavigate(null, m.url);
    b.ondblclick = () => {
      if (confirm(`Borrar bookmark "${m.title}"?`)) window.yin.bookmarkDel(m.url);
    };
    bm.appendChild(b);
  }

  // Estrella según tab activa.
  const cur = state.tabs.find((t) => t.active);
  const marked = cur && /^https?:\/\//i.test(cur.url || '') &&
    (state.bookmarks || []).some((m) => m.url === cur.url);
  $('btn-star').textContent = marked ? '★' : '☆';
  $('btn-star').classList.toggle('on', !!marked);
}

// Tema efectivo: dark/light/sistema/programado.
function effectiveTheme() {
  const s = state.settings;
  const mode = s.themeMode || 'dark';
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  const h = new Date().getHours();
  const day = s.dayStart ?? 7, night = s.nightStart ?? 19;
  const isDay = day <= night ? (h >= day && h < night) : (h >= day || h < night);
  return isDay ? 'light' : 'dark';
}
function applyMode() {
  document.documentElement.dataset.theme = effectiveTheme();
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyMode);
setInterval(() => {
  if ((state.settings.themeMode || 'dark') === 'scheduled') applyMode();
}, 60000);

function hostOf(t) {  try {
    const u = new URL(t.url);
    if (u.protocol === 'file:') return 'Nueva pestaña';
    return u.host || t.title || 'Nueva pestaña';
  } catch {
    return t.title || 'Nueva pestaña';
  }
}

function normalize(input) {
  const v = String(input || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (v.includes('.') && !v.includes(' ')) return 'https://' + v;
  return v; // el main resuelve búsqueda con el motor configurado
}

$('new-tab').onclick = () => window.yin.tabNew('');
$('btn-compact').onclick = () => window.yin.settingsSet({ compact: !state.settings.compact });
function activeId() {
  const t = state.tabs.find((t) => t.active);
  return t ? t.id : null;
}
function closeSettings() {
  settingsEl.classList.add('hidden');
  const id = activeId();
  if (id) window.yin.tabActivate(id);
}
$('btn-settings').onclick = openSettings;
$('settings-close').onclick = closeSettings;
settingsEl.addEventListener('click', (e) => {
  if (e.target === settingsEl) closeSettings();
});
$('btn-back').onclick = () => window.yin.navBack();
$('btn-fwd').onclick = () => window.yin.navForward();
$('btn-reload').onclick = () => window.yin.navReload();
$('btn-star').onclick = () => window.yin.bookmarkToggle();
$('win-min').onclick = () => window.yin.winMin();
$('win-max').onclick = () => window.yin.winMax();
$('win-close').onclick = () => window.yin.winClose();
$('toolbar').ondblclick = (e) => {
  if (e.target.closest('button,input')) return;
  window.yin.winMax();
};
urlbar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && urlbar.value.trim()) window.yin.tabNavigate(null, normalize(urlbar.value));
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') { e.preventDefault(); window.yin.tabNew(''); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') { e.preventDefault(); window.yin.tabClose(null); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); urlbar.focus(); urlbar.select(); }
});
$('ws-add').onclick = async () => {
  const name = prompt('Nombre del workspace:');
  if (name) {
    const id = await window.yin.wsCreate(name);
    if (id) window.yin.wsSwitch(id);
  }
};

async function openSettings() {
  const s = state.settings;
  $('set-mode').value = s.themeMode || 'dark';
  $('set-day').value = s.dayStart ?? 7;
  $('set-night').value = s.nightStart ?? 19;
  $('set-accent').value = s.accent || '#7aa2f7';
  $('set-base').value = s.themeBase || '#1b1b1b';
  $('set-transparency').checked = !!s.transparency;
  $('set-tabpos').value = s.tabPosition || 'side';
  $('set-font').value = s.fontScale || 1;
  $('set-anim').checked = s.animations !== false;
  $('set-forcedark').checked = !!s.forceDark;
  $('set-frameless').checked = !!s.frameless;
  $('set-showback').checked = s.showBack !== false;
  $('set-showfwd').checked = s.showFwd !== false;
  $('set-showreload').checked = s.showReload !== false;
  $('set-engine').value = s.searchEngine || 'duckduckgo';
  $('set-compact').checked = !!s.compact;
  $('set-side').value = s.sidebarSide || 'left';
  $('set-adblock').checked = s.adblock !== false;
  const { dir, files } = await window.yin.themesList();
  $('themes-dir').textContent = dir;
  const sel = $('set-custom');
  sel.innerHTML = '<option value="">(ninguno)</option>';
  for (const f of files) {
    if (f === 'userChrome.css') continue;
    const o = document.createElement('option');
    o.value = f;
    o.textContent = f;
    sel.appendChild(o);
  }
  sel.value = s.customTheme || '';
  const boosts = await window.yin.boostsList();
  $('boosts-dir').textContent = boosts.dir;
  const bl = $('boosts-list');
  bl.innerHTML = '';
  for (const b of boosts.files) {
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = b.enabled;
    cb.onchange = () => window.yin.boostToggle(b.file, cb.checked);
    lab.append(cb, document.createTextNode(' ' + b.domain));
    bl.appendChild(lab);
  }
  await window.yin.contentHide();
  settingsEl.classList.remove('hidden');
}

$('set-mode').onchange = (e) => window.yin.settingsSet({ themeMode: e.target.value });
$('set-day').onchange = (e) => window.yin.settingsSet({ dayStart: +e.target.value || 0 });
$('set-night').onchange = (e) => window.yin.settingsSet({ nightStart: +e.target.value || 0 });
$('set-accent').oninput = (e) => window.yin.settingsSet({ accent: e.target.value });
$('set-base').oninput = (e) => window.yin.settingsSet({ themeBase: e.target.value });
$('set-basedefault').onclick = () => window.yin.settingsSet({ themeBase: null });
$('set-transparency').onchange = (e) => window.yin.settingsSet({ transparency: e.target.checked });
$('set-tabpos').onchange = (e) => window.yin.settingsSet({ tabPosition: e.target.value });
$('set-font').oninput = (e) => window.yin.settingsSet({ fontScale: +e.target.value || 1 });
$('set-anim').onchange = (e) => window.yin.settingsSet({ animations: e.target.checked });
$('set-forcedark').onchange = (e) => window.yin.settingsSet({ forceDark: e.target.checked });
$('set-frameless').onchange = (e) => window.yin.settingsSet({ frameless: e.target.checked });
$('set-showback').onchange = (e) => window.yin.settingsSet({ showBack: e.target.checked });
$('set-showfwd').onchange = (e) => window.yin.settingsSet({ showFwd: e.target.checked });
$('set-showreload').onchange = (e) => window.yin.settingsSet({ showReload: e.target.checked });
$('set-engine').onchange = (e) => window.yin.settingsSet({ searchEngine: e.target.value });
$('set-compact').onchange = (e) => window.yin.settingsSet({ compact: e.target.checked });
$('set-side').onchange = (e) => window.yin.settingsSet({ sidebarSide: e.target.value });
$('set-adblock').onchange = (e) => window.yin.settingsSet({ adblock: e.target.checked });
$('set-custom').onchange = (e) => applyTheme(e.target.value);

let lastTheme = Symbol('none');
let lastChrome = Symbol('none');

async function applyTheme(name) {
  if (name === lastTheme) return;
  lastTheme = name;
  await window.yin.settingsSet({ customTheme: name || null });
  const css = name ? await window.yin.themeRead(name) : '';
  $('user-theme').textContent = css || '';
}

async function applyChrome() {
  const css = await window.yin.themeRead('userChrome.css');
  if (css === lastChrome) return;
  lastChrome = css;
  $('user-chrome').textContent = css || '';
}

window.yin.onTabs((data) => {
  state = data;
  render();
  applyTheme(state.settings.customTheme).catch(() => {});
  applyChrome().catch(() => {});
});
window.yin.onUrl((d) => {
  if (document.activeElement !== urlbar) urlbar.value = d.url.startsWith('file://') ? '' : d.url;
});
