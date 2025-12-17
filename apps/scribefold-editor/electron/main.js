const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');

let mainWindow = null;

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
