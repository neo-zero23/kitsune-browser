// Kitsune Yin — shell UI. Estado espejo vía yin:onTabs; acciones por invoke.
const $ = (id) => document.getElementById(id);
const wsEl = $('workspaces'), tabsEl = $('tabs'), urlbar = $('urlbar');
const settingsEl = $('settings');

let state = { tabs: [], workspaces: [], activeWorkspace: 'main', settings: {} };

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function render() {
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme || 'dark';
  document.documentElement.dataset.compact = s.compact ? 'true' : 'false';
  document.documentElement.dataset.side = s.sidebarSide || 'left';

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
  for (const t of mine) {
    const b = document.createElement('button');
    b.className = 'tab' + (t.active ? ' active' : '');
    const fav = t.favicon ? `<img class="fav" src="${esc(t.favicon)}" />` : '';
    b.innerHTML = `${fav}<span class="host">${esc(hostOf(t))}</span>`;
    b.title = t.url;
    b.onclick = () => window.yin.tabActivate(t.id);
    const x = document.createElement('span');
    x.className = 'x';
    x.textContent = '✕';
    x.onclick = (e) => { e.stopPropagation(); window.yin.tabClose(t.id); };
    b.appendChild(x);
    // Arrastrar tab a otro workspace: doble click la mueve al siguiente.
    b.ondblclick = () => {
      const ids = state.workspaces.map((w) => w.id);
      const next = ids[(ids.indexOf(t.workspace) + 1) % ids.length];
      window.yin.tabMoveWs(t.id, next);
    };
    tabsEl.appendChild(b);
  }
}

function hostOf(t) {
  try {
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
$('btn-settings').onclick = openSettings;
$('settings-close').onclick = () => settingsEl.classList.add('hidden');
settingsEl.addEventListener('click', (e) => {
  if (e.target === settingsEl) settingsEl.classList.add('hidden');
});
$('btn-back').onclick = () => window.yin.navBack();
$('btn-fwd').onclick = () => window.yin.navForward();
$('btn-reload').onclick = () => window.yin.navReload();
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
  $('set-theme').value = s.theme || 'dark';
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
  settingsEl.classList.remove('hidden');
}

$('set-theme').onchange = (e) => window.yin.settingsSet({ theme: e.target.value });
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
