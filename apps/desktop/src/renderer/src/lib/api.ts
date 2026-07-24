import type {
  HataCevabi,
  KimlikCevabi,
  Kategori,
  ListeCevabi,
  MesajOlusturIstegi,
  Mesaj,
  TalepDetayi,
  TalepOlusturIstegi,
  TalepOzeti,
  YuklemeIzniCevabi,
  YuklemeIzniIstegi,
} from '../../../shared/sozlesme.js';
import type { DesktopApi } from '../../../preload/index.js';

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

/**
 * EstaCRM destek API istemcisi.
 *
 * Tüm uçlar `/api/destek` altında ve Türkçe adlı. Alan adları sunucuyla birebir
 * aynı tutuluyor (bkz. shared/sozlesme.ts) — çeviri katmanı yok, çünkü iki isim
 * seti arasındaki sessiz kayma en pahalı hata türü.
 */

/** Sunucudaki tüm destek uçlarının ortak öneki. */
const ONEK = '/api/destek';

export class ApiHatasi extends Error {
  constructor(
    readonly durum: number,
    readonly kod: string,
    mesaj: string,
    readonly alanlar?: Record<string, string>,
  ) {
    super(mesaj);
    this.name = 'ApiHatasi';
  }
}

let apiUrl = 'https://crm.estabilisim.com';
let erisimJetonu: string | null = null;
let oturumKaybedildi: (() => void) | null = null;

export async function initApi(): Promise<void> {
  apiUrl = await window.desktop.config.getApiUrl();
}

export function getApiUrl(): string {
  return apiUrl;
}

export async function setApiUrl(url: string): Promise<void> {
  apiUrl = url.replace(/\/+$/, '');
  await window.desktop.config.setApiUrl(apiUrl);
}

export function getErisimJetonu(): string | null {
  return erisimJetonu;
}

export function setOturumKaybiHandler(handler: () => void): void {
  oturumKaybedildi = handler;
}

/**
 * Erişim jetonu yalnızca bellekte; yenileme jetonu ana süreçte safeStorage ile
 * şifrelenip diske yazılır. Renderer yenileme jetonunu hiç saklamaz.
 */
export async function kimligiUygula(veri: KimlikCevabi): Promise<void> {
  erisimJetonu = veri.erisimJetonu;
  await window.desktop.auth.setRefreshToken(veri.yenilemeJetonu);
}

export async function kimligiTemizle(): Promise<void> {
  erisimJetonu = null;
  await window.desktop.auth.setRefreshToken(null);
}

let yenilemeSuruyor: Promise<boolean> | null = null;

async function oturumuYenile(): Promise<boolean> {
  const saklanan = await window.desktop.auth.getRefreshToken();
  if (!saklanan) return false;

  // Paralel isteklerin hepsi 401 alınca tek bir yenileme yapılsın; aksi halde
  // jeton rotasyonu nedeniyle ilk yenileme dışındakiler geçersiz jeton kullanır.
  yenilemeSuruyor ??= (async () => {
    try {
      const res = await fetch(`${apiUrl}${ONEK}/auth/yenile`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ yenilemeJetonu: saklanan }),
      });
      if (!res.ok) return false;
      await kimligiUygula((await res.json()) as KimlikCevabi);
      return true;
    } catch {
      return false;
    } finally {
      yenilemeSuruyor = null;
    }
  })();

  return yenilemeSuruyor;
}

/** Kaydedilmiş yenileme jetonuyla sessizce oturum açmayı dener. */
export async function oturumuGeriYukle(): Promise<KimlikCevabi | null> {
  const saklanan = await window.desktop.auth.getRefreshToken();
  if (!saklanan) return null;

  try {
    const res = await fetch(`${apiUrl}${ONEK}/auth/yenile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ yenilemeJetonu: saklanan }),
    });
    if (!res.ok) {
      await kimligiTemizle();
      return null;
    }
    const veri = (await res.json()) as KimlikCevabi;
    await kimligiUygula(veri);
    return veri;
  } catch {
    return null;
  }
}

interface IstekSecenekleri {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  kimliksiz?: boolean;
}

export async function apiFetch<T>(yol: string, secenek: IstekSecenekleri = {}): Promise<T> {
  const url = new URL(`${apiUrl}${ONEK}${yol}`);
  for (const [anahtar, deger] of Object.entries(secenek.query ?? {})) {
    if (deger !== undefined && deger !== '') url.searchParams.set(anahtar, String(deger));
  }

  const gonder = (): Promise<Response> =>
    fetch(url, {
      method: secenek.method ?? 'GET',
      headers: {
        ...(secenek.body ? { 'content-type': 'application/json' } : {}),
        ...(erisimJetonu && !secenek.kimliksiz
          ? { authorization: `Bearer ${erisimJetonu}` }
          : {}),
      },
      body: secenek.body ? JSON.stringify(secenek.body) : undefined,
    });

  let cevap: Response;
  try {
    cevap = await gonder();
  } catch {
    throw new ApiHatasi(
      0,
      'AG',
      'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.',
    );
  }

  if (cevap.status === 401 && !secenek.kimliksiz) {
    if (await oturumuYenile()) cevap = await gonder();
    else oturumKaybedildi?.();
  }

  if (cevap.status === 204) return undefined as T;

  const govde: unknown = await cevap.json().catch(() => null);

  if (!cevap.ok) {
    const h = (govde as HataCevabi | null)?.hata;
    throw new ApiHatasi(
      cevap.status,
      h?.kod ?? 'BILINMEYEN',
      h?.mesaj ?? 'Beklenmeyen bir hata oluştu',
      h?.alanlar,
    );
  }

  return govde as T;
}

// ── Uçlar ────────────────────────────────────────────────────────────────────

export const api = {
  aktivasyon: (govde: {
    lisansAnahtari: string;
    eposta: string;
    ad: string;
    parola: string;
  }) =>
    apiFetch<KimlikCevabi>('/auth/aktivasyon', {
      method: 'POST',
      body: govde,
      kimliksiz: true,
    }),

  giris: (govde: { eposta: string; parola: string }) =>
    apiFetch<KimlikCevabi>('/auth/giris', {
      method: 'POST',
      body: govde,
      kimliksiz: true,
    }),

  cikis: () => apiFetch<void>('/auth/cikis', { method: 'POST' }),

  talepler: () =>
    apiFetch<ListeCevabi<TalepOzeti>>('/talepler').then((c) => c.kayitlar),

  talep: (id: string) => apiFetch<TalepDetayi>(`/talepler/${id}`),

  talepOlustur: (govde: TalepOlusturIstegi) =>
    apiFetch<TalepDetayi>('/talepler', { method: 'POST', body: govde }),

  mesajYaz: (talepId: string, govde: MesajOlusturIstegi) =>
    apiFetch<Mesaj>(`/talepler/${talepId}/mesajlar`, {
      method: 'POST',
      body: govde,
    }),

  /** Müşteri yalnızca talebini kapatabilir; diğer alanlarda sunucu 403 döner. */
  talebiKapat: (talepId: string) =>
    apiFetch<TalepDetayi>(`/talepler/${talepId}`, {
      method: 'PATCH',
      body: { durum: 'KAPALI' },
    }),

  kategoriler: () =>
    apiFetch<ListeCevabi<Kategori>>('/kategoriler').then((c) => c.kayitlar),

  yuklemeIzni: (govde: YuklemeIzniIstegi) =>
    apiFetch<YuklemeIzniCevabi>('/yukleme', { method: 'POST', body: govde }),
};
