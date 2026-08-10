import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Kullanici } from '../../../shared/sozlesme.js';
import { api, kimligiUygula, kimligiTemizle, initApi, oturumuGeriYukle, setOturumKaybiHandler } from './api';

interface OturumDegeri {
  kullanici: Kullanici | null;
  yukleniyor: boolean;
  aktivasyon: (girdi: {
    lisansAnahtari: string;
    eposta: string;
    ad: string;
    parola: string;
  }) => Promise<void>;
  /** Domain self-servis 1. adım — kod gönderir (oturum açılmaz). */
  kayitBaslat: (girdi: { eposta: string; ad: string; parola: string }) => Promise<void>;
  /** Domain self-servis 2. adım — kodu doğrular, oturum açar. */
  kayitDogrula: (eposta: string, kod: string) => Promise<void>;
  giris: (eposta: string, parola: string) => Promise<void>;
  cikis: () => Promise<void>;
  profilGuncelle: (ad: string) => Promise<void>;
}

const OturumContext = createContext<OturumDegeri | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [kullanici, setKullanici] = useState<Kullanici | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);

  const sifirla = useCallback(() => {
    void kimligiTemizle();
    setKullanici(null);
  }, []);

  useEffect(() => {
    setOturumKaybiHandler(sifirla);
  }, [sifirla]);

  // Açılışta: kayıtlı sunucu adresini yükle, sonra oturumu geri getirmeyi dene.
  useEffect(() => {
    void (async () => {
      await initApi();
      const geri = await oturumuGeriYukle();
      if (geri) setKullanici(geri.kullanici);
      setYukleniyor(false);
    })();
  }, []);

  const aktivasyon = useCallback<OturumDegeri['aktivasyon']>(async (girdi) => {
    const veri = await api.aktivasyon(girdi);
    await kimligiUygula(veri);
    setKullanici(veri.kullanici);
  }, []);

  const kayitBaslat = useCallback<OturumDegeri['kayitBaslat']>(async (girdi) => {
    await api.kayitBaslat(girdi);
  }, []);

  const kayitDogrula = useCallback<OturumDegeri['kayitDogrula']>(async (eposta, kod) => {
    const veri = await api.kayitDogrula({ eposta, kod });
    await kimligiUygula(veri);
    setKullanici(veri.kullanici);
  }, []);

  const giris = useCallback<OturumDegeri['giris']>(async (eposta, parola) => {
    const veri = await api.giris({ eposta, parola });
    await kimligiUygula(veri);
    setKullanici(veri.kullanici);
  }, []);

  const cikis = useCallback(async () => {
    // Sunucudaki oturumu da iptal et; başarısız olsa da yerelde temizliyoruz.
    await api.cikis().catch(() => undefined);
    sifirla();
  }, [sifirla]);

  const profilGuncelle = useCallback<OturumDegeri['profilGuncelle']>(async (ad) => {
    const guncel = await api.profilGuncelle(ad);
    setKullanici(guncel);
  }, []);

  const deger = useMemo(
    () => ({
      kullanici,
      yukleniyor,
      aktivasyon,
      kayitBaslat,
      kayitDogrula,
      giris,
      cikis,
      profilGuncelle,
    }),
    [kullanici, yukleniyor, aktivasyon, kayitBaslat, kayitDogrula, giris, cikis, profilGuncelle],
  );

  return <OturumContext.Provider value={deger}>{children}</OturumContext.Provider>;
}

export function useSession(): OturumDegeri {
  const ctx = useContext(OturumContext);
  if (!ctx) throw new Error('useSession, SessionProvider içinde kullanılmalı');
  return ctx;
}
