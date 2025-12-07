const { contextBridge, ipcRenderer, shell } = require('electron');

// Validate URLs before exposing them
const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && 
           (parsed.hostname.endsWith('google.com') || 
            parsed.hostname === 'localhost');
  } catch {
    return false;
  }
};

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('open-file'),
  openEncryptedFile: () => ipcRenderer.invoke('open-encrypted-file'),
  openEncryptedFileWithPath: (filePath) => ipcRenderer.invoke('open-encrypted-file-with-path', filePath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
  saveBackup: (currentFilePath, content) => ipcRenderer.invoke('save-backup', { currentFilePath, content }),
  saveEncryptedFile: (filePath, content, password) => ipcRenderer.invoke('save-encrypted-file', { filePath, content, password }),
  encryptFile: (content, currentFilePath) => ipcRenderer.invoke('encrypt-file', { content, currentFilePath }),
  
  // Settings and dialogs
  // Open settings window, optionally requesting a specific tab ('general' | 'ai' | 'account')
  openSettings: (tab = 'general') => {
    ipcRenderer.send('open-settings', tab);
  },
  // Convenience helpers for specific tabs, used by various UIs
  openAISettings: () => ipcRenderer.send('open-settings', 'ai'),
  openAccountSettings: () => ipcRenderer.send('open-settings', 'account'),
  openHelp: (section) => ipcRenderer.send('open-help', section),
  getInitialSettingsTab: () => ipcRenderer.invoke('get-last-settings-tab'),
  
  // Menu events
  onMenuNew: (callback) => ipcRenderer.on('menu-new', callback),
  onMenuOpen: (callback) => ipcRenderer.on('menu-open', callback),
  onMenuSave: (callback) => ipcRenderer.on('menu-save', callback),
  onMenuSaveAs: (callback) => ipcRenderer.on('menu-save-as', callback),
  onMenuSaveBackup: (callback) => ipcRenderer.on('menu-save-backup', callback),
  onMenuEncrypt: (callback) => ipcRenderer.on('menu-encrypt', callback),
  onMenuUndo: (callback) => ipcRenderer.on('menu-undo', callback),
  onMenuRedo: (callback) => ipcRenderer.on('menu-redo', callback),
  
  // View events
  onSetBackground: (callback) => ipcRenderer.on('set-background', callback),
  onToggleFoldView: (callback) => ipcRenderer.on('toggle-fold-view', callback),
  onFoldAll: (callback) => ipcRenderer.on('fold-all', callback),
  onUnfoldAll: (callback) => ipcRenderer.on('unfold-all', callback),
  onToggleArrayView: (callback) => ipcRenderer.on('toggle-array-view', callback),
  
  // Settings Events: settings window listens for requested tab changes
  onSettingsTabRequest: (callback) =>
    ipcRenderer.on('requested-settings-tab', (event, tab) => callback && callback(tab)),

  // (Legacy) keep these for any older code that might still use them, mapping to tab requests
  onOpenAISettings: (callback) =>
    ipcRenderer.on('requested-settings-tab', (event, tab) => {
      if (tab === 'ai' && callback) callback(event, tab);
    }),
  onOpenAccountSettings: (callback) =>
    ipcRenderer.on('requested-settings-tab', (event, tab) => {
      if (tab === 'account' && callback) callback(event, tab);
    }),

  // AI events
  onAIEnabledChanged: (callback) => ipcRenderer.on('ai-enabled-changed', callback),
  onToggleAITool: (callback) => ipcRenderer.on('toggle-ai-enabled', callback),
  onAIBulkAction: (callback) => ipcRenderer.on('ai-bulk-action', callback),
  openAIDebugWindow: (debugIndex) => ipcRenderer.invoke('open-ai-debug-window', debugIndex),
  // Native AI context menu
  showAIContextMenu: (payload) => ipcRenderer.invoke('show-ai-context-menu', payload),
  onAIContextChoice: (callback) => ipcRenderer.on('ai-context-choice', (event, data) => callback && callback(data)),
  
  // User management
  getAnonId: () => ipcRenderer.invoke('get-anon-id'),
  onAnonIdReady: (callback) => ipcRenderer.on('anon-id-ready', callback),
  resetAnonId: () => ipcRenderer.invoke('reset-anon-id'),
  getDeviceId: () => ipcRenderer.invoke('get-device-id'),
  onDeviceIdReady: (callback) => ipcRenderer.on('device-id-ready', callback),
  
  // Developer mode - controls DevTools visibility
  setDeveloperMode: (enabled) => ipcRenderer.send('set-developer-mode', enabled),
  
  // Theme management
  getThemeList: () => ipcRenderer.invoke('get-theme-list'),
  selectCustomTheme: () => ipcRenderer.invoke('select-custom-theme'),
  settingsSaved: (settings) => ipcRenderer.send('settings-saved', settings),
  onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', callback),

  // Close/unsaved dialog
  onShowUnsavedChangesDialog: (callback) => ipcRenderer.on('show-unsaved-changes-dialog', callback),
  unsavedChangesResponse: (action) => ipcRenderer.send('unsaved-changes-response', action),

  // Secure external URL opening
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
