const { contextBridge, shell } = require('electron');
const { ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFile: () => ipcRenderer.invoke('open-file'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  logRightClick: () => ipcRenderer.send('right-click'),
});

console.log('[Preload] electronAPI exposed with methods:', Object.keys({
  isElectron: true,
  openFile: () => ipcRenderer.invoke('open-file'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
}));
