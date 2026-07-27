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
    const jeton = getErisimJetonu();
    if (!jeton) return;

    /**
     * EventSource özel başlık gönderemediği için jeton sorgu dizisinde gidiyor.
     * Kısa ömürlü erişim jetonu olduğu için kabul edilebilir; kalıcı yenileme
     * jetonu buraya asla girmez (sunucu tarafı da bunu böyle bekliyor).
     */
    const adres = `${getApiUrl()}/api/destek/akis?jeton=${encodeURIComponent(jeton)}`;
    const kaynak = new EventSource(adres);

    kaynak.onmessage = (olayVerisi) => {
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

          // Kendi yazdığımız mesaj için bildirim gösterme.
          if (olay.mesaj.yazarTipi === 'MUSTERI') return;

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
     * EventSource kopukluğu kendi başına yeniden dener; burada yalnızca
     * gürültüyü kesiyoruz. Kalıcı 401'de akış kapanır ve sonraki API isteği
     * zaten oturumu yeniler.
     */
    kaynak.onerror = () => {
      /* sessiz — tarayıcı otomatik yeniden bağlanır */
    };

    return () => {
      kaynak.close();
    };
  }, [etkin, kullaniciId, qc]);
}

/** Kullanıcı talepleri görüntüleyince rozeti ve sayacı sıfırla. */
export function clearBadge(): void {
  okunmamis = 0;
  void window.desktop.app.setBadge(0);
}
