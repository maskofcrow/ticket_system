import { contextBridge, ipcRenderer } from 'electron';
import type { CihazBilgisi, EnvanterBilgisi } from '../shared/sozlesme.js';

export interface CapturedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Renderer'ın erişebildiği tek yüzey. Burada listelenmeyen hiçbir Node/Electron
 * yeteneği arayüz koduna geçmez — izin listesi bilinçli olarak dar tutuldu.
 */
const api = {
  auth: {
    getRefreshToken: (): Promise<string | null> => ipcRenderer.invoke('auth:getRefreshToken'),
    setRefreshToken: (token: string | null): Promise<void> =>
      ipcRenderer.invoke('auth:setRefreshToken', token),
  },
  config: {
    getApiUrl: (): Promise<string> => ipcRenderer.invoke('config:getApiUrl'),
    setApiUrl: (url: string): Promise<void> => ipcRenderer.invoke('config:setApiUrl', url),
  },
  device: {
    collect: (): Promise<CihazBilgisi> => ipcRenderer.invoke('device:collect'),
    getSharePreference: (): Promise<boolean> => ipcRenderer.invoke('device:getSharePreference'),
    setSharePreference: (value: boolean): Promise<void> =>
      ipcRenderer.invoke('device:setSharePreference', value),
  },
  inventory: {
    collect: (): Promise<EnvanterBilgisi> => ipcRenderer.invoke('inventory:collect'),
  },
  /** Sunucudaki görseli data URL olarak getir (CORS/taint'siz düzenleme için). */
  gorselGetir: (url: string): Promise<string | null> => ipcRenderer.invoke('image:fetch', url),
  screenshot: {
    capture: (): Promise<CapturedImage | { error: string }> =>
      ipcRenderer.invoke('screenshot:capture'),
    fromClipboard: (): Promise<CapturedImage | null> =>
      ipcRenderer.invoke('screenshot:fromClipboard'),
  },
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
    setBadge: (count: number): Promise<void> => ipcRenderer.invoke('app:setBadge', count),
  },
  notify: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notify', { title, body }),
};

contextBridge.exposeInMainWorld('desktop', api);

export type DesktopApi = typeof api;
