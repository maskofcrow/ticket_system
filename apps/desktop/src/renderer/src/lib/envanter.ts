import { useEffect } from 'react';
import { api } from './api';

const BILGI_BAYRAGI = 'envanterBilgilendirmeGosterildi';
const ARALIK_MS = 6 * 60 * 60 * 1000; // 6 saat

/**
 * Oturum açıkken cihaz envanterini otomatik toplar ve CRM'e bildirir: açılışta
 * bir kez + periyodik. İlk çalıştırmada tek seferlik bir bilgilendirme gösterir
 * (KVKK şeffaflığı) — kullanıcı her seferinde onay vermez.
 */
export function useEnvanterRaporu(kullaniciId: string | undefined): void {
  useEffect(() => {
    if (!kullaniciId) return;

    let durduruldu = false;

    async function bildir(): Promise<void> {
      try {
        const envanter = await window.desktop.inventory.collect();
        if (!durduruldu) await api.envanterBildir(envanter);
      } catch {
        // Envanter kritik değil — sessizce geç, sonraki turda tekrar denenir.
      }
    }

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

    void bildir();
    const zamanlayici = setInterval(() => void bildir(), ARALIK_MS);

    return () => {
      durduruldu = true;
      clearInterval(zamanlayici);
    };
  }, [kullaniciId]);
}
