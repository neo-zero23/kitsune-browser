// Kitsune Yin — preload del shell (solo la ventana principal, nunca las páginas).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('yin', {
  tabNew: (url) => ipcRenderer.invoke('yin:tab-new', url),
  tabClose: (id) => ipcRenderer.invoke('yin:tab-close', id),
  tabActivate: (id) => ipcRenderer.invoke('yin:tab-activate', id),
  contentHide: () => ipcRenderer.invoke('yin:content-hide'),
  tabNavigate: (id, url) => ipcRenderer.invoke('yin:tab-navigate', { id, url }),
  navBack: () => ipcRenderer.invoke('yin:nav-back'),
  navForward: () => ipcRenderer.invoke('yin:nav-forward'),
  navReload: () => ipcRenderer.invoke('yin:nav-reload'),
  wsSwitch: (id) => ipcRenderer.invoke('yin:ws-switch', id),
  wsCreate: (name) => ipcRenderer.invoke('yin:ws-create', name),
  wsRename: (id, name, icon) => ipcRenderer.invoke('yin:ws-rename', { id, name, icon }),
  wsDelete: (id) => ipcRenderer.invoke('yin:ws-delete', id),
  tabMoveWs: (id, workspace) => ipcRenderer.invoke('yin:tab-move-ws', { id, workspace }),
  settingsSet: (patch) => ipcRenderer.invoke('yin:settings-set', patch),
  boostsList: () => ipcRenderer.invoke('yin:boosts-list'),
  boostToggle: (file, enabled) => ipcRenderer.invoke('yin:boost-toggle', { file, enabled }),
  themesList: () => ipcRenderer.invoke('yin:themes-list'),
  themeRead: (name) => ipcRenderer.invoke('yin:theme-read', name),
  onTabs: (fn) => ipcRenderer.on('yin:tabs', (_e, data) => fn(data)),
  onUrl: (fn) => ipcRenderer.on('yin:url', (_e, data) => fn(data)),
});
