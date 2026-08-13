import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import { cihazlariGetir } from './mesh.js';
import { getSunucu, setSunucu } from './store.js';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

/**
 * Otomatik güncelleme — kendi kanalımızdan (electron-builder publish channel:
 * crmadmin → crmadmin.yml). Yeni sürüm bulununca indirir, çıkışta kurulur.
 */
function setupAutoUpdater(): void {
  if (isDev) return;
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;
  void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: 'Esta Uzak Yönetim',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Uzak masaüstü görünümünü gömmek için <webview> gerekli.
      webviewTag: true,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Uygulama penceresi hiçbir zaman kendi başka siteye gitmesin; harici linkler
  // sistem tarayıcısında açılsın. (Uzak masaüstü <webview> içinde kalır.)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle('mesh:sunucu', () => getSunucu());
  ipcMain.handle('mesh:sunucuKaydet', (_e, url: string) => setSunucu(url));
  ipcMain.handle('mesh:cihazlar', () => cihazlariGetir(getSunucu()));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    registerIpc();
    createWindow();
    setupAutoUpdater();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
