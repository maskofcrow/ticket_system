/**
 * EstaCRM destek API sözleşmesi (müşteri tarafı).
 *
 * Bu dosya CRM'deki `lib/destek/semalar.ts` ve `lib/destek/sunum.ts` ile birebir
 * aynı olmalıdır. Alan adları Türkçedir; sunucu ne gönderiyorsa burada o durur —
 * çeviri katmanı YOK, çünkü iki isim seti arasında sessiz kayma en pahalı hata.
 *
 * Masaüstü uygulamasının yetkisi bilinçli olarak dardır: talep açmak, kendi
 * taleplerini listelemek, konuşmayı okumak ve yanıt yazmak. Durum/öncelik/atama
 * değiştirme yalnızca personel panelindedir (sunucu 403 döner).
 */

export type TalepDurumu =
  | 'ACIK'
  | 'ISLEMDE'
  | 'MUSTERI_BEKLENIYOR'
  | 'COZULDU'
  | 'KAPALI';

export type TalepOnceligi = 'DUSUK' | 'NORMAL' | 'YUKSEK' | 'ACIL';

export type YazarTipi = 'MUSTERI' | 'PERSONEL';

export const DURUM_ETIKET: Record<TalepDurumu, string> = {
  ACIK: 'Açık',
  ISLEMDE: 'İşlemde',
  MUSTERI_BEKLENIYOR: 'Sizden yanıt bekleniyor',
  COZULDU: 'Çözüldü',
  KAPALI: 'Kapalı',
};

/** Kullanıcı için "iş bitti" sayılan durumlar — listede ayrı gruplanır. */
export const KAPALI_DURUMLAR: TalepDurumu[] = ['COZULDU', 'KAPALI'];

export const ONCELIK_ETIKET: Record<TalepOnceligi, string> = {
  DUSUK: 'Düşük',
  NORMAL: 'Normal',
  YUKSEK: 'Yüksek',
  ACIL: 'Acil',
};

/** Lisans anahtarı biçimi — CRM'deki regex ile aynı. */
export const LISANS_REGEX =
  /^ESTA-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

/** Sunucunun kabul ettiği dosya tipleri (CRM: IZINLI_MIME). */
export const IZINLI_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type IzinliMime = (typeof IZINLI_MIME)[number];

// ── Kimlik ───────────────────────────────────────────────────────────────────

export interface Kullanici {
  id: string;
  ad: string;
  eposta: string;
  firmaId: string;
  firmaAdi: string;
}

export interface KimlikCevabi {
  erisimJetonu: string;
  yenilemeJetonu: string;
  /** Erişim jetonunun ömrü (saniye). */
  omur: number;
  kullanici: Kullanici;
}

export interface AktivasyonIstegi {
  lisansAnahtari: string;
  eposta: string;
  ad: string;
  parola: string;
}

export interface GirisIstegi {
  eposta: string;
  parola: string;
}

// ── Talepler ─────────────────────────────────────────────────────────────────

export interface CihazBilgisi {
  isletimSistemi: string;
  bilgisayarAdi: string;
  islemci: string;
  toplamBellekMb: number;
  bosDiskGb: number;
  yerelIp?: string | null;
  uygulamaSurumu: string;
}

export interface Kategori {
  id: string;
  ad: string;
  renk: string;
}

export interface Yazar {
  id: string;
  ad: string;
  tip: YazarTipi;
}

export interface Ek {
  id: string;
  dosyaAdi: string;
  mimeTipi: string;
  boyut: number;
  createdAt: string;
  /** Kısa ömürlü imzalı indirme adresi (15 dk). */
  indirmeAdresi: string;
}

/** Yeni ek yüklenirken sunucuya gönderilen referans. */
export interface EkReferansi {
  depoAnahtari: string;
  dosyaAdi: string;
}

export interface Mesaj {
  id: string;
  talepId: string;
  yazar: Yazar;
  icerik: string;
  /**
   * Müşteri tarafında her zaman false gelir — iç notlar sunucu sorgusunda
   * elenir. Alan yine de tipte tutuluyor ki sözleşme CRM ile aynı kalsın.
   */
  icNot: boolean;
  ekler: Ek[];
  createdAt: string;
}

export interface TalepOzeti {
  id: string;
  numara: number;
  baslik: string;
  durum: TalepDurumu;
  oncelik: TalepOnceligi;
  kategori: Kategori | null;
  firma: { id: string; ad: string };
  acan: Yazar | null;
  atanan: { id: string; ad: string } | null;
  mesajSayisi: number;
  sonHareketAt: string;
  cozulduAt: string | null;
  createdAt: string;
}

export interface TalepDetayi extends TalepOzeti {
  aciklama: string;
  mesajlar: Mesaj[];
  ekler: Ek[];
  cihazBilgisi: CihazBilgisi | null;
}

export interface TalepOlusturIstegi {
  baslik: string;
  aciklama: string;
  oncelik?: TalepOnceligi;
  kategoriId?: string | null;
  cihazBilgisi?: CihazBilgisi | null;
  ekler?: EkReferansi[];
}

export interface MesajOlusturIstegi {
  icerik: string;
  ekler?: EkReferansi[];
}

// ── Yükleme ──────────────────────────────────────────────────────────────────

export interface YuklemeIzniIstegi {
  dosyaAdi: string;
  mimeTipi: string;
  boyut: number;
}

export interface YuklemeIzniCevabi {
  yuklemeAdresi: string;
  depoAnahtari: string;
}

// ── Firma-içi ekip / workspace ────────────────────────────────────────────────

export interface EkipUyesi {
  id: string;
  ad: string;
  eposta: string;
  sonGorulme: string | null;
  /** Bu üye, oturum açan kullanıcının kendisi mi? */
  ben: boolean;
}

export type SohbetTuru = 'DIREKT' | 'GRUP';

/** Sohbet listesi öğesi (DM veya grup). */
export interface SohbetOzeti {
  id: string;
  tur: SohbetTuru;
  /** DM'de karşı kişinin adı, grupta grup adı. */
  baslik: string;
  uyeler: { id: string; ad: string }[];
  sonMesaj: {
    icerik: string;
    gonderenAd: string;
    ekVar: boolean;
    createdAt: string;
  } | null;
  okunmamis: number;
  sonMesajAt: string;
}

/** Sohbet mesajı. `icerik` boşsa mesaj yalnızca ek içerir. */
export interface SohbetMesaji {
  id: string;
  sohbetId: string;
  gonderen: { id: string; ad: string };
  icerik: string;
  ekler: Ek[];
  createdAt: string;
}

export type SohbetOlusturIstegi =
  | { tur: 'DIREKT'; kisiId: string }
  | { tur: 'GRUP'; ad: string; uyeIds: string[] };

export interface SohbetMesajGonderIstegi {
  icerik?: string;
  ekler?: EkReferansi[];
}

// ── Zarflar ve hatalar ───────────────────────────────────────────────────────

/** Liste uçları `{ kayitlar: [...] }` döner. */
export interface ListeCevabi<T> {
  kayitlar: T[];
}

export interface HataCevabi {
  hata: {
    kod: string;
    mesaj: string;
    alanlar?: Record<string, string>;
  };
}

// ── Canlı akış (SSE) ─────────────────────────────────────────────────────────

/**
 * Sunucu → istemci olayları. Socket.IO yerine SSE kullanılıyor: ihtiyaç tek
 * yönlü ve Next.js route handler'ı özel sunucu gerektirmeden yayınlıyor.
 */
export type TalepOlayi =
  | { tur: 'baglandi' }
  | { tur: 'talep:olusturuldu'; customerId: string; talep: TalepOzeti }
  | {
      tur: 'talep:guncellendi';
      customerId: string;
      talep: TalepOzeti;
      degisen: string[];
    }
  | {
      tur: 'mesaj:eklendi';
      customerId: string;
      talepId: string;
      talepNumara: number;
      talepBaslik: string;
      mesaj: { id: string; icerik: string; icNot: boolean; yazarTipi: YazarTipi };
    }
  | {
      tur: 'sohbet:mesaj';
      customerId: string;
      sohbetId: string;
      uyeIds: string[];
      mesaj: SohbetMesaji;
    }
  | {
      tur: 'sohbet:guncellendi';
      customerId: string;
      sohbetId: string;
      uyeIds: string[];
    };
