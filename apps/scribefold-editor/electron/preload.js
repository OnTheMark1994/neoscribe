const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true
});

console.log('[Preload] electronAPI exposed');
