const { app, BrowserWindow, ipcMain, dialog, Menu, globalShortcut, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const crypto = require('crypto');
const isDev = require('electron-is-dev');

// Disable cache and GPU BEFORE anything else
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Initialize electron-store
const userDataPath = app.getPath('userData');
const store = new Store({ cwd: userDataPath });
console.log('[MAIN] electron-store initialized at:', userDataPath);

let anonId = null;
let mainWindow;
let passwordDialogWindow = null;
let settingsWindow = null;
let isClosingForReal = false;
let pendingSettingsTab = null; // 'general' | 'ai' | 'account' requested before settings finishes loading
let lastSettingsTab = 'general'; // remember the last requested tab for settings window to read on load
let developerModeEnabled = false; // tracked from renderer to control DevTools behavior

// Load encryption module
let encrypt, decrypt, ALGORITHMS;
try {
  const encryptionModule = require('./encryption');
  encrypt = encryptionModule.encrypt;
  decrypt = encryptionModule.decrypt;
  ALGORITHMS = encryptionModule.ALGORITHMS;
} catch (error) {
  console.error('Encryption module failed to load:', error);
  encrypt = async () => { throw new Error('Encryption unavailable'); };
  decrypt = async () => { throw new Error('Decryption unavailable'); };
  ALGORITHMS = { PBKDF2: 'pbkdf2', ARGON2: 'argon2' };
}

function getOrCreateAnonId() {
  console.log('[MAIN] getOrCreateAnonId() called');
  let anon_id = store.get('anon_id');
  if (!anon_id) {
    anon_id = 'anon_' + crypto.randomBytes(16).toString('hex');
    store.set('anon_id', anon_id);
    console.log('[MAIN] Created new anon_id:', anon_id);
  } else {
    console.log('[MAIN] Found existing anon_id:', anon_id);
  }
  return anon_id;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#2c2c2c',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: true,
      // Allow loading local file:/// URLs (used for custom background images)
      webSecurity: false
    }
  });

  // Load React app
  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // DevTools will be opened by renderer if developerMode is enabled
  // Don't open automatically here since developerMode is stored in localStorage (renderer)

  // Initialize anon_id
  anonId = getOrCreateAnonId();
  
  // Send anon_id when ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] Window loaded, sending anon_id:', anonId);
    mainWindow.webContents.send('anon-id-ready', anonId);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create menu
  createMenu();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Enable spell checker context menu similar to legacy app
  mainWindow.webContents.on('context-menu', (event, params) => {
    const { Menu, MenuItem } = require('electron');
    const menu = new Menu();

    // Add spelling suggestions if there are any
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions) {
        menu.append(new MenuItem({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion)
        }));
      }

      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }));
      }

      menu.append(new MenuItem({
        label: 'Add to Dictionary',
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }));

      menu.append(new MenuItem({ type: 'separator' }));
    }

    // Add standard editing options
    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Cut', role: 'cut', enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }));
    }

    if (menu.items.length > 0) {
      menu.popup();
    }
  });

  // Handle close using custom in-app Unsaved Changes dialog
  mainWindow.on('close', async (e) => {
    if (isClosingForReal) {
      return;
    }

    e.preventDefault();
    const response = await mainWindow.webContents.executeJavaScript('window.isModified || false');

    if (!response) {
      isClosingForReal = true;
      mainWindow.close();
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('show-unsaved-changes-dialog');
    }
  });
}

function createMenu() {
  // Build theme submenu
  const themeSubmenu = [];
  const imagesDir = path.join(__dirname, 'images');
  
  if (fs.existsSync(imagesDir)) {
    const images = fs.readdirSync(imagesDir).filter(file => 
      /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
    );
    
    images.forEach(image => {
      themeSubmenu.push({
        label: path.basename(image, path.extname(image)),
        click: () => {
          mainWindow.webContents.send('set-background', image);
        }
      });
    });
  }

  themeSubmenu.push({ type: 'separator' });
  themeSubmenu.push({
    label: 'Select Custom Image...',
    click: async () => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
        ]
      });
      if (!result.canceled && result.filePaths.length > 0) {
        mainWindow.webContents.send('set-background', result.filePaths[0]);
      }
    }
  });

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new');
          }
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open');
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save');
          }
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu-save-as');
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // File -> Settings should always open on the General tab,
            // regardless of what tab was last requested by other entry points
            const requestedTab = 'general';
            lastSettingsTab = requestedTab;

            if (!settingsWindow || settingsWindow.isDestroyed()) {
              // Match the unified open-settings IPC behavior
              pendingSettingsTab = requestedTab;
              showSettingsWindow('#settings');
            } else {
              // Focus existing window and switch to the General tab
              showSettingsWindow();
              if (!settingsWindow.isDestroyed()) {
                settingsWindow.webContents.send('requested-settings-tab', requestedTab);
              }
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            mainWindow.webContents.send('menu-undo');
          }
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => {
            mainWindow.webContents.send('menu-redo');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Themes',
          submenu: themeSubmenu
        },
        { type: 'separator' },
        {
          label: 'Toggle AI Window',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            if (mainWindow) {
              console.log('[MAIN] View -> Toggle AI Window clicked, sending toggle-ai-enabled');
              mainWindow.webContents.send('toggle-ai-enabled');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Array View',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('toggle-fold-view');
            }
          }
        },
        {
          label: 'Fold All',
          accelerator: 'CmdOrCtrl+Shift+[',
          click: () => {
            mainWindow.webContents.send('fold-all');
          }
        },
        {
          label: 'Unfold All',
          accelerator: 'CmdOrCtrl+Shift+]',
          click: () => {
            mainWindow.webContents.send('unfold-all');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function showSettingsWindow(hash = '#settings') {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 700,
    height: 700,
    parent: mainWindow,
    modal: false,
    show: false,
    backgroundColor: '#2c2c2c',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const settingsUrl = isDev
    ? `http://localhost:3000${hash}`
    : `file://${path.join(__dirname, '../build/index.html')}${hash}`;

  settingsWindow.loadURL(settingsUrl);

  // When the settings UI has finished loading, apply any pending tab request
  settingsWindow.webContents.on('did-finish-load', () => {
    // Auto-open DevTools for the settings window when in developer mode
    if (isDev && developerModeEnabled && !settingsWindow.isDestroyed()) {
      const wc = settingsWindow.webContents;
      if (wc && !wc.isDevToolsOpened()) {
        wc.openDevTools();
      }
    }

    if (pendingSettingsTab && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('requested-settings-tab', pendingSettingsTab);
      pendingSettingsTab = null;
    }
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Unified handler: any renderer can request settings with a specific tab
ipcMain.on('open-settings', (event, tab = 'general') => {
  const requestedTab = tab || 'general';
  lastSettingsTab = requestedTab;

  if (!settingsWindow || settingsWindow.isDestroyed()) {
    // Open settings on the base hash; tab will be applied after load
    pendingSettingsTab = requestedTab;
    showSettingsWindow('#settings');
  } else {
    // Focus existing window and send tab request immediately
    showSettingsWindow();
    if (!settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send('requested-settings-tab', requestedTab);
    }
  }
});

// Allow settings window to query the last requested tab explicitly
ipcMain.handle('get-last-settings-tab', async () => lastSettingsTab);

app.whenReady().then(() => {
  createWindow();

  // Configure spell checker languages (will use system locale by default otherwise)
  try {
    session.defaultSession.setSpellCheckerLanguages(['en-US']);
  } catch (err) {
    console.error('[MAIN] Failed to set spell checker languages:', err);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Register global shortcuts when app is ready
app.whenReady().then(() => {
  // Escape exits fullscreen if the main window is currently fullscreen
  globalShortcut.register('Escape', () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });
});

app.on('will-quit', () => {
  // Unregister all shortcuts (including Escape)
  globalShortcut.unregisterAll();
});

// IPC Handlers
ipcMain.handle('get-anon-id', async () => anonId);

// Developer utility: reset anon_id so the next launch behaves like a first-time run
ipcMain.handle('reset-anon-id', async () => {
  try {
    console.log('[MAIN] reset-anon-id invoked - clearing anon_id from store and memory');
    store.delete('anon_id');
    anonId = null;
    return { success: true };
  } catch (err) {
    console.error('[MAIN] Failed to reset anon_id:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-theme-list', async () => {
  const imagesDir = path.join(__dirname, 'images');
  
  if (!fs.existsSync(imagesDir)) {
    return [];
  }
  
  const images = fs.readdirSync(imagesDir).filter(file => 
    /\.(jpg|jpeg|png|webp|gif)$/i.test(file)
  );
  
  return images.map(image => ({
    name: path.basename(image, path.extname(image)),
    path: image
  }));
});

ipcMain.on('unsaved-changes-response', (event, action) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (action === 'save') {
    mainWindow.webContents.send('menu-save');
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      isClosingForReal = true;
      mainWindow.close();
    }, 500);
  } else if (action === 'discard') {
    isClosingForReal = true;
    mainWindow.close();
  } else {
    // cancel
  }
});

// Let renderer request a custom background image via file dialog
ipcMain.handle('select-custom-theme', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { canceled: true };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }
    ]
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  return { canceled: false, filePath };
});

// Toggle DevTools based on developer mode setting from renderer
ipcMain.on('set-developer-mode', (event, enabled) => {
  console.log('[MAIN] Developer mode set to:', enabled);
  developerModeEnabled = !!enabled;
  if (isDev && mainWindow && mainWindow.webContents) {
    if (enabled) {
      if (!mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.openDevTools();
      }
    } else {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      }
    }
  }

  // Keep settings window DevTools in sync when developer mode changes
  if (isDev && settingsWindow && !settingsWindow.isDestroyed()) {
    const wc = settingsWindow.webContents;
    if (enabled) {
      if (wc && !wc.isDevToolsOpened()) {
        wc.openDevTools();
      }
    } else {
      if (wc && wc.isDevToolsOpened()) {
        wc.closeDevTools();
      }
    }
  }
});

ipcMain.on('settings-saved', (event, settings) => {
  // Notify main window about settings change
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', settings);
  }
});

ipcMain.handle('open-external', async (event, url) => {
  if (typeof url === 'string' && url.startsWith('http')) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('open-encrypted-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Supported Files', extensions: ['txt', 'enc'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'Encrypted Files', extensions: ['enc'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const isEncrypted = filePath.endsWith('.enc');
    
    if (isEncrypted) {
      const password = await promptPassword('decrypt');
      if (!password) return { success: false, error: 'Password required' };
      
      try {
        const encryptedContent = fs.readFileSync(filePath, 'utf-8');
        const decryptedContent = await decrypt(encryptedContent, password);
        return { success: true, filePath, content: decryptedContent, encrypted: true, password };
      } catch (error) {
        return { success: false, error: 'Decryption failed: ' + error.message };
      }
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, filePath, content, encrypted: false };
    }
  }
  return { success: false };
});

ipcMain.handle('open-encrypted-file-with-path', async (event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: 'File not found' };
  }

  try {
    const isEncrypted = filePath.endsWith('.enc');
    
    if (isEncrypted) {
      const password = await promptPassword('decrypt');
      if (!password) return { success: false, error: 'Password required' };
      
      const encryptedContent = fs.readFileSync(filePath, 'utf-8');
      const decryptedContent = await decrypt(encryptedContent, password);
      return { success: true, filePath, content: decryptedContent, encrypted: true, password };
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, filePath, content, encrypted: false };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file-as', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Text Files', extensions: ['txt'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false };
});

// Native AI context menu for chapter/section sharing
ipcMain.handle('show-ai-context-menu', async (event, payload) => {
  const sender = event.sender;
  const win = BrowserWindow.fromWebContents(sender) || mainWindow;
  if (!win) return;

  const { lineIdx, sendToAI, level, isOpen } = payload || {};

  const menuTemplate = [
    {
      label: isOpen ? 'Minimize' : 'Maximize',
      click: () => {
        sender.send('ai-context-choice', { lineIdx, action: 'foldToggle' });
      }
    },
    { type: 'separator' }
  ];

  // Chapter header: show Chapter AI (this line), Section AI (bulk under chapter), then Summarize Chapter
  if (level === 1) {
    // 1) Chapter AI submenu
    menuTemplate.push({
      label: 'Chapter AI',
      submenu: [
        {
          label: 'Share',
          type: 'radio',
          checked: sendToAI === 'all',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'line', option: 'all' })
        },
        {
          label: 'Title Only',
          type: 'radio',
          checked: sendToAI === 'title',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'line', option: 'title' })
        },
        {
          label: 'Hide',
          type: 'radio',
          checked: sendToAI === 'none' || !sendToAI,
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'line', option: 'none' })
        }
      ]
    });

    // 2) Section AI submenu
    menuTemplate.push({
      label: 'Section AI',
      submenu: [
        {
          label: 'Share All',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'sections', option: 'all', level })
        },
        {
          label: 'Share Titles',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'sections', option: 'title', level })
        },
        {
          label: 'Hide All',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'sections', option: 'none', level })
        }
      ]
    });
  }

  // Section header: only Section AI for this single section
  if (level === 2) {
    menuTemplate.push({
      label: 'Section AI',
      submenu: [
        {
          label: 'Share',
          type: 'radio',
          checked: sendToAI === 'all',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'line', option: 'all' })
        },
        {
          label: 'Summary',
          type: 'radio',
          checked: sendToAI === 'summary',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'line', option: 'summary' })
        },
        {
          label: 'Title Only',
          type: 'radio',
          checked: sendToAI === 'title',
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'line', option: 'title' })
        },
        {
          label: 'Hide',
          type: 'radio',
          checked: sendToAI === 'none' || !sendToAI,
          click: () => sender.send('ai-context-choice', { lineIdx, scope: 'line', option: 'none' })
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  menu.popup({ window: win });
});

async function promptPassword(mode) {
  return new Promise((resolve) => {
    dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['OK', 'Cancel'],
      title: mode === 'encrypt' ? 'Encrypt File' : 'Enter Password',
      message: 'Enter password:',
      defaultId: 0,
      cancelId: 1
    }).then(result => {
      if (result.response === 0) {
        // In a real implementation, you'd show a proper password dialog
        resolve('password');
      } else {
        resolve(null);
      }
    });
  });
}
