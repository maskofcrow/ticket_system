/**
 * crmadmin (teknisyen) ↔ main süreç sözleşmesi.
 *
 * crmadmin, kendi çalışan MeshCentral sunucumuza (uzak.estabilisim.com) bağlanan
 * Esta markalı bir teknisyen uygulamasıdır. MeshCentral arayüzü kullanıcıya
 * gösterilmez; yalnızca cihaz listesi (control WS API'sinden) ve tıklanınca
 * gömülü "sadece masaüstü" görünümü kullanılır.
 */

/** MeshCentral sunucu adresi (varsayılan; ayarlardan değişebilir). */
export const VARSAYILAN_SUNUCU = 'https://uzak.estabilisim.com';

/** Cihaz listesi öğesi (MeshCentral node'undan sadeleştirilmiş). */
export interface Cihaz {
  /** node//... tam kimliği. */
  id: string;
  /** URL'de gotonode için kullanılan kısım (node// sonrası). */
  gotonode: string;
  ad: string;
  cevrimici: boolean;
  isletimSistemi?: string;
  grup?: string;
}

/** Oturum/bağlantı durumu. */
export type BaglantiDurumu = 'giris-gerekli' | 'baglaniyor' | 'hazir' | 'hata';

export interface DurumBilgisi {
  durum: BaglantiDurumu;
  sunucu: string;
  hata?: string;
}
