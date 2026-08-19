import { useEffect } from 'react';
import { api } from './api';

const BILGI_BAYRAGI = 'envanterBilgilendirmeGosterildi';
const ARALIK_MS = 6 * 60 * 60 * 1000; // 6 saat
// Açılış/kurulum sonrası hızlı tur: ajan hazır olur olmaz meshNodeId yakalansın.
const HIZLI_TUR_MS = [0, 15_000, 45_000, 120_000];

/**
 * Cihaz envanterini bir kez toplar ve CRM'e bildirir. Envanterde meshNodeId varsa
 * (uzak destek ajanı kurulu ve okundu) `true` döner. Hem periyodik rapor hem de
 * "kurulumdan hemen sonra" / "ticket açılınca" gibi anlık tetiklemeler bunu kullanır.
 */
export async function envanterBildirSimdi(): Promise<boolean> {
  try {
    const envanter = await window.desktop.inventory.collect();
    await api.envanterBildir(envanter);
    return Boolean(envanter.meshNodeId);
  } catch {
    // Envanter kritik değil — sessizce geç, sonraki turda tekrar denenir.
    return false;
  }
}

/**
 * Oturum açıkken cihaz envanterini otomatik toplar ve CRM'e bildirir: açılışta bir
 * "hızlı tur" (ajan yeni kurulduysa meshNodeId'yi saniyeler içinde yakalamak için
 * birkaç kısa deneme) + ardından 6 saatte bir periyodik. İlk çalıştırmada tek
 * seferlik KVKK bilgilendirmesi gösterir.
 */
export function useEnvanterRaporu(kullaniciId: string | undefined): void {
  useEffect(() => {
    if (!kullaniciId) return;

    // İlk kurulumda tek seferlik bilgilendirme.
    try {
      if (!localStorage.getItem(BILGI_BAYRAGI)) {
        localStorage.setItem(BILGI_BAYRAGI, '1');
        void window.desktop.notify(
          'Cihaz envanteri',
          'Destek hizmeti için cihazınızın donanım ve ağ bilgileri otomatik olarak toplanır.',
        );
      }
    } catch {
      /* localStorage yoksa yut */
    }

    // Açılışta hızlı tur — meshNodeId gelince kalan denemeleri atla.
    let bulundu = false;
    const zamanlayicilar = HIZLI_TUR_MS.map((gecikme) =>
      setTimeout(async () => {
        if (bulundu) return;
        bulundu = await envanterBildirSimdi();
      }, gecikme),
    );

    const aralik = setInterval(() => void envanterBildirSimdi(), ARALIK_MS);

    return () => {
      zamanlayicilar.forEach(clearTimeout);
      clearInterval(aralik);
    };
  }, [kullaniciId]);
}
