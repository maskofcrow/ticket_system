import Store from 'electron-store';
import { VARSAYILAN_SUNUCU } from '../shared/sozlesme.js';

interface StoreSchema {
  /** MeshCentral sunucu adresi. */
  sunucu?: string;
}

const store = new Store<StoreSchema>({ name: 'crmadmin' });

export function getSunucu(): string {
  return store.get('sunucu') ?? VARSAYILAN_SUNUCU;
}

export function setSunucu(url: string): void {
  store.set('sunucu', url.replace(/\/+$/, ''));
}
