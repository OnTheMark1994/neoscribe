const { contextBridge, ipcRenderer } = require('electron');

// Minimal API surface, but still exposes window.electronAPI like desktop-app
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Optional: allow renderer to toggle fullscreen via IPC later
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),

  openFile: () => ipcRenderer.invoke('open-file'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  saveFileAs: (payload) => ipcRenderer.invoke('save-file-as', payload),
});
