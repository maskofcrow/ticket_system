import { useEffect, useRef, useState } from 'react';
import { Button } from './ui';

/**
 * Rızaya dayalı uzak destek kurulum kartı. "Kur" → RustDesk yükseltilmiş (UAC)
 * kurulumu arka planda çalışır; kart bitene kadar "Kuruluyor…" gösterip durumu
 * yoklar (işaret dosyası). Tamamlanınca gizlenir. Yalnızca Windows'ta ve
 * kurulmamışsa görünür.
 */
export function UzakDestekKart(): React.ReactElement | null {
  const [durum, setDurum] = useState<{ mumkun: boolean; kuruldu: boolean } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [gizli, setGizli] = useState(false);
  const yoklama = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void window.desktop.uzak.durum().then((d) => setDurum({ mumkun: d.mumkun, kuruldu: d.kuruldu }));
    return () => {
      if (yoklama.current) clearInterval(yoklama.current);
    };
  }, []);

  async function kur(): Promise<void> {
    setHata(null);
    setYukleniyor(true);
    const r = await window.desktop.uzak.kur();
    if (!r.ok) {
      setHata(r.hata ?? 'Kurulum başlatılamadı.');
      setYukleniyor(false);
      return;
    }
    // Kurulum arka planda; tamamlanana (işaret dosyası) kadar yokla.
    const basla = Date.now();
    yoklama.current = setInterval(async () => {
      const d = await window.desktop.uzak.durum();
      if (d.kuruldu) {
        if (yoklama.current) clearInterval(yoklama.current);
        setDurum({ mumkun: true, kuruldu: true });
        setYukleniyor(false);
      } else if (Date.now() - basla > 180000) {
        if (yoklama.current) clearInterval(yoklama.current);
        setYukleniyor(false);
        setHata('Kurulum doğrulanamadı. Yönetici onayını verdiğinizden emin olup tekrar deneyin.');
      }
    }, 3000);
  }

  if (!durum || !durum.mumkun || durum.kuruldu || gizli) return null;

  return (
    <div className="mx-4 mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Uzak destek kurulumu</div>
          <p className="mt-0.5 text-xs text-slate-600">
            Destek ekibimizin gerektiğinde ekranınıza bağlanıp yardımcı olabilmesi için
            tek seferlik bir kurulum. Kur’a bastığınızda yönetici onayı görünür; onayı
            siz verirsiniz.
          </p>
          {yukleniyor && (
            <p className="mt-1.5 text-xs text-blue-700">
              Kuruluyor… Yönetici (UAC) penceresini onaylayın, işlem tamamlanınca bu
              kart kapanır.
            </p>
          )}
          {hata && <p className="mt-1.5 text-xs text-red-600">{hata}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button onClick={kur} disabled={yukleniyor}>
            {yukleniyor ? 'Kuruluyor…' : 'Kur'}
          </Button>
          {!yukleniyor && (
            <button
              onClick={() => setGizli(true)}
              className="text-[11px] text-slate-500 hover:text-slate-700"
            >
              Şimdi değil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
