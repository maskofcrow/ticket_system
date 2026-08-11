import { useEffect, useState } from 'react';
import { Button } from './ui';

/**
 * Rızaya dayalı uzak destek kurulum kartı. Destek ekibinin gerektiğinde
 * bilgisayara bağlanabilmesi için tek seferlik, GÖRÜNÜR kurulum. Kullanıcı
 * "Kur"a basınca RustDesk'in kendi kurulum penceresi + Windows yönetici (UAC)
 * onayı açılır ve kullanıcı onaylar. Yalnızca Windows'ta ve kurulmamışsa görünür.
 */
export function UzakDestekKart(): React.ReactElement | null {
  const [durum, setDurum] = useState<{ mumkun: boolean; kuruldu: boolean } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [gizli, setGizli] = useState(false);

  useEffect(() => {
    void window.desktop.uzak.durum().then((d) => setDurum({ mumkun: d.mumkun, kuruldu: d.kuruldu }));
  }, []);

  async function kur(): Promise<void> {
    setHata(null);
    setYukleniyor(true);
    try {
      const r = await window.desktop.uzak.kur();
      if (r.ok) setDurum({ mumkun: true, kuruldu: true });
      else setHata(r.hata ?? 'Kurulum tamamlanamadı.');
    } finally {
      setYukleniyor(false);
    }
  }

  // Uygun değilse, zaten kuruluysa veya kapatıldıysa gösterme.
  if (!durum || !durum.mumkun || durum.kuruldu || gizli) return null;

  return (
    <div className="mx-4 mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">Uzak destek kurulumu</div>
          <p className="mt-0.5 text-xs text-slate-600">
            Destek ekibimizin gerektiğinde ekranınıza bağlanıp yardımcı olabilmesi için
            tek seferlik bir kurulum. Kur’a bastığınızda kurulum penceresi ve yönetici
            onayı görünür; onayı siz verirsiniz.
          </p>
          {hata && <p className="mt-1.5 text-xs text-red-600">{hata}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Button onClick={kur} disabled={yukleniyor}>
            {yukleniyor ? 'Kuruluyor…' : 'Kur'}
          </Button>
          <button
            onClick={() => setGizli(true)}
            className="text-[11px] text-slate-500 hover:text-slate-700"
          >
            Şimdi değil
          </button>
        </div>
      </div>
    </div>
  );
}
