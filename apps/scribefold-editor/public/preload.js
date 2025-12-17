const { contextBridge, ipcRenderer } = require('electron');

// Minimal API surface, but still exposes window.electronAPI like desktop-app
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Optional: allow renderer to toggle fullscreen via IPC later
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
});
