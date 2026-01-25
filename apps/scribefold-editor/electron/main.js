const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');

let mainWindow = null;

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

ipcMain.handle('save-file-as', async (event, content) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { success: false, error: 'Window not ready' };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'Text', extensions: ['txt'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { success: false };
  }

  try {
    fs.writeFileSync(result.filePath, content ?? '', 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  console.log('[Main] open-external called with URL:', url);
  try {
    console.log('[Main] Calling shell.openExternal...');
    await shell.openExternal(url);
    console.log('[Main] Successfully opened URL in system browser');
    return { success: true };
  } catch (error) {
    console.error('[Main] Failed to open URL:', error);
    return { success: false, error: error.message };
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.maximize();

  const startUrl = process.env.ELECTRON_START_URL;
  const buildIndexPath = path.join(__dirname, '..', 'build', 'index.html');

  const loadApp = async () => {
    if (startUrl) {
      return mainWindow.loadURL(startUrl);
    }

    if (fs.existsSync(buildIndexPath)) {
      return mainWindow.loadFile(buildIndexPath);
    }

    return mainWindow.loadURL('http://localhost:3000');
  };

  mainWindow.webContents.on('did-fail-load', () => {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.loadURL(
      'data:text/plain;charset=utf-8,' +
        encodeURIComponent(
          'Scribefold Editor failed to load.\n\n' +
            'If you are in dev: run `npm start` then launch Electron with ELECTRON_START_URL=http://localhost:3000.\n' +
            'If you are in build mode: run `npm run build` then `npm run electron`.\n'
        )
    );
  });

  loadApp().catch(() => {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
