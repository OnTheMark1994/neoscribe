const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: '#2c2c2c',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Match desktop-app behavior (allows file:// background images etc)
      webSecurity: false,
    },
  });

  mainWindow.maximize();

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Match desktop-app: disable native menu (we render our own TopBar)
  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('toggle-fullscreen', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
    return { isFullScreen: !isFullScreen };
  }
  return { isFullScreen: false };
});

ipcMain.handle('open-file', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Window not ready' };
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Scribefold / Text', extensions: ['scb', 'txt', 'md', 'markdown'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !Array.isArray(result.filePaths) || !result.filePaths[0]) {
    return { success: false };
  }

  const filePath = result.filePaths[0];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, filePath, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    if (!filePath) return { success: false, error: 'Missing filePath' };
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  try {
    if (!filePath) return { success: false, error: 'Missing filePath' };
    fs.writeFileSync(filePath, content ?? '', 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-file-as', async (event, payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Window not ready' };
  }

  const content = typeof payload === 'string' ? payload : payload?.content;
  const suggestedName = typeof payload === 'object' ? payload?.suggestedName : '';
  const safeSuggestedName = typeof suggestedName === 'string' ? suggestedName.trim() : '';
  const forceScb = safeSuggestedName.toLowerCase().endsWith('.scb');

  const normalizeScbPath = (inputPath) => {
    if (!inputPath) return inputPath;

    let p = String(inputPath);

    const removable = new Set(['.txt', '.md', '.markdown', '.scb']);
    let ext = path.extname(p).toLowerCase();
    while (ext && removable.has(ext)) {
      p = p.slice(0, -ext.length);
      ext = path.extname(p).toLowerCase();
    }

    return `${p}.scb`;
  };

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: safeSuggestedName || undefined,
    filters: [
      ...(forceScb ? [{ name: 'Scribefold Encrypted', extensions: ['scb'] }] : []),
      { name: 'Text', extensions: ['txt'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  const finalPath = forceScb ? normalizeScbPath(result.filePath) : result.filePath;

  try {
    fs.writeFileSync(finalPath, content ?? '', 'utf-8');
    return { success: true, filePath: finalPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  createWindow();
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
