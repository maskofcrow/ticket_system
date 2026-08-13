import { contextBridge, ipcRenderer } from 'electron';
import type { Cihaz } from '../shared/sozlesme.js';

/** Renderer'ın erişebildiği dar yüzey — MeshCentral sunucusuyla köprü. */
const api = {
  /** MeshCentral control API'sinden cihaz listesi (oturum yoksa girisGerekli). */
  cihazlar: (): Promise<
    { ok: true; cihazlar: Cihaz[] } | { ok: false; girisGerekli?: boolean; hata?: string }
  > => ipcRenderer.invoke('mesh:cihazlar'),
  sunucu: (): Promise<string> => ipcRenderer.invoke('mesh:sunucu'),
  sunucuKaydet: (url: string): Promise<void> => ipcRenderer.invoke('mesh:sunucuKaydet', url),
};

contextBridge.exposeInMainWorld('crmadmin', api);

export type CrmadminApi = typeof api;
