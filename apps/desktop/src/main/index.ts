import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, Notification, nativeImage, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import { collectDeviceInfo } from './sysinfo.js';
import { captureScreen, readClipboardImage } from './screenshot.js';
import {
  getApiUrl,
  getShareDeviceInfo,
  readRefreshToken,
  saveRefreshToken,
  setApiUrl,
  setShareDeviceInfo,
} from './store.js';

// Müşteri PC'lerine kurulan paket doğrudan canlı sunucuya bağlanmalı. Geliştirmede
// yerel sunucuyu kullanmak için build sırasında VITE_API_URL verilebilir.
// (Kullanıcı "Sunucu ayarları"ndan değiştirirse o değer kalıcı olarak öne geçer.)
const DEFAULT_API_URL =
  process.env.VITE_API_URL ??
  (app.isPackaged ? 'https://crm.estabilisim.com' : 'http://localhost:3000');
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
/** Kapatma isteği gerçekten çıkış mı, yoksa tepsiye küçültme mi. */
let quitting = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 860,
    minHeight: 600,
    show: false,
    title: 'IT Destek',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Renderer'ın Node'a doğrudan erişimi yok; her şey preload'daki
      // izin listesinden geçer. Bu üçlü pazarlık konusu değil.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  // Pencere kapatılınca uygulama tepside çalışmaya devam eder — destek yanıtı
  // geldiğinde bildirim gösterebilmek için.
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Uygulama içinden açılan dış bağlantılar (dosya indirme vb.) sistem
  // tarayıcısında açılsın; uygulama penceresi hiçbir zaman başka siteye gitmesin.
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

function createTray(): void {
  // 16x16 şeffaf taban görüntü; template olarak işaretlenince macOS koyu/açık
  // temaya kendisi uyarlar.
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('IT Destek');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Pencereyi aç', click: () => showWindow() },
      { type: 'separator' },
      {
        label: 'Çıkış',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => showWindow());
}

function showWindow(): void {
  if (!mainWindow) createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

/** Okunmamış sayısını tepsi ipucunda ve macOS dock rozetinde göster. */
function setBadge(count: number): void {
  if (process.platform === 'darwin') {
    app.dock?.setBadge(count > 0 ? String(count) : '');
  }
  tray?.setToolTip(count > 0 ? `IT Destek — ${count} yeni yanıt` : 'IT Destek');
}

function registerIpc(): void {
  ipcMain.handle('auth:getRefreshToken', () => readRefreshToken());
  ipcMain.handle('auth:setRefreshToken', (_e, token: string | null) => saveRefreshToken(token));

  ipcMain.handle('config:getApiUrl', () => getApiUrl(DEFAULT_API_URL));
  ipcMain.handle('config:setApiUrl', (_e, url: string) => setApiUrl(url));

  ipcMain.handle('device:collect', () => collectDeviceInfo());
  ipcMain.handle('device:getSharePreference', () => getShareDeviceInfo());
  ipcMain.handle('device:setSharePreference', (_e, value: boolean) => setShareDeviceInfo(value));

  ipcMain.handle('screenshot:capture', () => captureScreen());
  ipcMain.handle('screenshot:fromClipboard', () => readClipboardImage());

  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('app:setBadge', (_e, count: number) => setBadge(count));

  ipcMain.handle('notify', (_e, payload: { title: string; body: string }) => {
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title: payload.title, body: payload.body });
    notification.on('click', () => showWindow());
    notification.show();
  });
}

function setupAutoUpdater(): void {
  if (isDev) return;

  // Güncelleme akışı kendi sunucumuzdan servis ediliyor (nginx → /updates/);
  // feed adresi electron-builder.yml'de gömülü. Kurulum tamamen self-hosted.
  autoUpdater.logger = null;
  autoUpdater.autoDownload = true;

  autoUpdater.on('update-downloaded', () => {
    new Notification({
      title: 'Güncelleme hazır',
      body: 'IT Destek uygulaması yeniden başlatıldığında güncellenecek.',
    }).show();
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater]', err.message);
  });

  void autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
}

// Tek örnek kilidi: ikinci kez açılırsa mevcut pencere öne gelsin.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  void app.whenReady().then(() => {
    registerIpc();
    createWindow();
    createTray();
    setupAutoUpdater();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });

  // Tepside çalışmaya devam ettiği için pencereler kapanınca çıkmıyoruz.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && quitting) app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
  });
}

/** 16x16 destek balonu ikonu (template image olarak kullanılıyor). */
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAoElEQVR42mNgGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBaNgFIyCUTAKRsEoGAWjYBSMglEwCkbBKBgFo2AUjIJRMApGwSgYBQMAAF0IAAG0nJqLAAAAAElFTkSuQmCC';
