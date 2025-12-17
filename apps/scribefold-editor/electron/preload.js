const { contextBridge } = require('electron');

// Minimal preload so the renderer can detect Electron via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
});
