// Electron main process. CommonJS — Electron şu an ESM ile sancılı.
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let serverHandle = null;
let mainWindow = null;

const isDev = !app.isPackaged;

// Packaged build'de extra resources içine konulan public/ klasörü
function resolvePublicDir() {
  if (isDev) return path.join(__dirname, '..', 'public');
  return path.join(process.resourcesPath, 'public');
}

function resolveDataFile() {
  return path.join(app.getPath('userData'), 'game-state.json');
}

async function startEmbeddedServer() {
  // server.js ESM, dynamic import ile yükle.
  // asarUnpack sayesinde packaged build'de de gerçek dosya sistemine düşer.
  const serverPath = path.join(__dirname, '..', 'server.js');
  const { pathToFileURL } = require('node:url');
  const { startServer } = await import(pathToFileURL(serverPath).href);
  return startServer({
    port: 0, // OS bir boş port atasın
    publicDir: resolvePublicDir(),
    dataFile: resolveDataFile(),
    printQr: false,
  });
}

async function createWindow() {
  serverHandle = await startEmbeddedServer();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Monopoly Bank',
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Dış linkler default tarayıcıda açılsın
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadURL(`http://localhost:${serverHandle.port}/banker`);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Dosya',
      submenu: [
        {
          label: 'LAN URL\'sini Göster',
          click: () => {
            if (!serverHandle) return;
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'LAN Bağlantı Adresi',
              message: 'Telefonlar bu adresten bağlanır:',
              detail: `${serverHandle.lanUrl}/player\n\nBankacı paneli: ${serverHandle.lanUrl}/banker`,
              buttons: ['Adresi Kopyala', 'Tamam'],
              defaultId: 0,
            }).then((res) => {
              if (res.response === 0) {
                require('electron').clipboard.writeText(`${serverHandle.lanUrl}/player`);
              }
            });
          },
        },
        {
          label: 'Veri Klasörünü Aç',
          click: () => shell.showItemInFolder(resolveDataFile()),
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Görünüm',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Tek instance — bir tane açıkken ikinci kez açılırsa mevcut pencere öne gelsin
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    buildMenu();
    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', async () => {
  if (serverHandle) {
    try { await serverHandle.close(); } catch {}
    serverHandle = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (serverHandle) {
    try { await serverHandle.close(); } catch {}
    serverHandle = null;
  }
});
