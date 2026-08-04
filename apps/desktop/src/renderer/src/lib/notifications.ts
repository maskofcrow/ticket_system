import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TalepOlayi } from '../../../shared/sozlesme.js';
import { getErisimJetonu, getApiUrl } from './api';

/**
 * Canlı akış (SSE): destek yanıt verdiğinde native bildirim gösterir ve açık
 * listeleri tazeler.
 *
 * Socket.IO yerine SSE kullanılıyor — ihtiyaç tek yönlü (sunucu → istemci) ve
 * CRM tarafında özel bir soket sunucusu gerektirmiyor.
 *
 * İç notlar sunucuda müşteri dinleyicisinden eleniyor (olaylar.ts `dinle()`),
 * bu yüzden buraya hiç ulaşmaz.
 */

/**
 * Okunmamış sayacı modül seviyesinde: rozeti temizleyen ekranlarla aynı değeri
 * paylaşmalı, aksi halde temizlemeden sonra sayaç kaldığı yerden devam ederdi.
 */
let okunmamis = 0;

export function useLiveUpdates(etkin: boolean, kullaniciId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!etkin) return;

    let kaynak: EventSource | null = null;
    let kapandi = false;
    let yenidenZaman: ReturnType<typeof setTimeout> | undefined;

    // Mesaj işleyici — her yeniden bağlanmada aynı fonksiyon kullanılır.
    const isle = (olayVerisi: MessageEvent) => {
      let olay: TalepOlayi;
      try {
        olay = JSON.parse(olayVerisi.data) as TalepOlayi;
      } catch {
        return;
      }

      switch (olay.tur) {
        case 'mesaj:eklendi': {
          void qc.invalidateQueries({ queryKey: ['talepler'] });
          void qc.invalidateQueries({ queryKey: ['talep', olay.talepId] });

          // Kendi (müşteri) yazdığımız mesaj için bildirim gösterme. Sunucu
          // mesajı `yazar.tip` ile gönderiyor (üst seviye `yazarTipi` yok).
          if (olay.mesaj.yazar?.tip === 'MUSTERI') return;

          okunmamis += 1;
          void window.desktop.app.setBadge(okunmamis);
          void window.desktop.notify(
            `#${olay.talepNumara} — yanıt geldi`,
            olay.mesaj.icerik.slice(0, 120),
          );
          break;
        }

        case 'talep:guncellendi': {
          void qc.invalidateQueries({ queryKey: ['talepler'] });
          void qc.invalidateQueries({ queryKey: ['talep', olay.talep.id] });

          if (olay.degisen.includes('durum')) {
            void window.desktop.notify(
              `#${olay.talep.numara} — durum güncellendi`,
              olay.talep.baslik,
            );
          }
          break;
        }

        case 'talep:olusturuldu': {
          void qc.invalidateQueries({ queryKey: ['talepler'] });
          break;
        }

        case 'sohbet:guncellendi': {
          // Yeni sohbet / gruba eklendik: sohbet listesini tazele.
          void qc.invalidateQueries({ queryKey: ['sohbetler'] });
          break;
        }

        case 'sohbet:mesaj': {
          // Sohbet listesini (son mesaj + rozet) ve açık konuşmayı tazele.
          void qc.invalidateQueries({ queryKey: ['sohbetler'] });
          void qc.invalidateQueries({ queryKey: ['sohbet', olay.sohbetId] });

          // Kendi yazdığım mesaj için bildirim yok.
          if (olay.mesaj.gonderen.id === kullaniciId) return;

          const onizleme =
            olay.mesaj.icerik.trim() ||
            (olay.mesaj.ekler.length > 0 ? '📎 Dosya gönderdi' : '');

          okunmamis += 1;
          void window.desktop.app.setBadge(okunmamis);
          void window.desktop.notify(`Ekip — ${olay.mesaj.gonderen.ad}`, onizleme.slice(0, 120));
          break;
        }

        default:
          // 'baglandi' ve ileride eklenecek olaylar sessizce yok sayılır.
          break;
      }
    };

    /**
     * SSE bağlantısı; kopunca (sunucu yeniden başlatma, ağ, jeton süresi dolması)
     * TAZE jetonla yeniden kurulur. EventSource'un kendi yeniden denemesi eski
     * (süresi dolmuş) jetonu URL'de taşıdığı için 401 döngüsüne giriyordu — bu
     * yüzden manuel yönetiyoruz. Jeton düzenli API çağrılarıyla tazelendiğinden
     * bağlantı birkaç saniyede toparlar.
     */
    const baglan = () => {
      if (kapandi) return;
      const jeton = getErisimJetonu();
      if (!jeton) {
        yenidenZaman = setTimeout(baglan, 3000);
        return;
      }
      kaynak = new EventSource(
        `${getApiUrl()}/api/destek/akis?jeton=${encodeURIComponent(jeton)}`,
      );
      kaynak.onmessage = isle;
      kaynak.onerror = () => {
        kaynak?.close();
        kaynak = null;
        if (!kapandi) {
          clearTimeout(yenidenZaman);
          yenidenZaman = setTimeout(baglan, 3000);
        }
      };
    };

    baglan();

    return () => {
      kapandi = true;
      clearTimeout(yenidenZaman);
      kaynak?.close();
    };
  }, [etkin, kullaniciId, qc]);
}

/** Kullanıcı talepleri görüntüleyince rozeti ve sayacı sıfırla. */
export function clearBadge(): void {
  okunmamis = 0;
  void window.desktop.app.setBadge(0);
}
