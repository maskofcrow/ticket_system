import { useEffect, useState } from 'react';
import { Logo } from './Logo';

type Durum = 'yok' | 'iniyor' | 'hazir' | 'kuruluyor';

/** CSS ile dönen küçük bekleme göstergesi (ikon kütüphanesi kullanmadan). */
function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white ${className}`}
    />
  );
}

/**
 * Otomatik güncelleme kullanıcı arayüzü:
 *  - İndirme başlayınca altta ilerleme çubuğu.
 *  - İndince "Güncelleme hazır — Şimdi güncelle" kartı.
 *  - Kurulurken tam ekran "Güncelleniyor…" bekleme ekranı.
 */
export function GuncellemeKatmani(): React.ReactElement | null {
  const [durum, setDurum] = useState<Durum>('yok');
  const [yuzde, setYuzde] = useState(0);
  const [surum, setSurum] = useState('');
  const [gizli, setGizli] = useState(false);

  useEffect(() => {
    const a = window.desktop.guncelleme.onIniyor((s) => {
      setSurum(s);
      setYuzde(0);
      setGizli(false);
      setDurum('iniyor');
    });
    const b = window.desktop.guncelleme.onIlerleme((p) => setYuzde(p));
    const c = window.desktop.guncelleme.onHazir((s) => {
      setSurum(s);
      setGizli(false);
      setDurum('hazir');
    });
    return () => {
      a();
      b();
      c();
    };
  }, []);

  function guncelle(): void {
    setDurum('kuruluyor');
    // Loading ekranı boyanmadan uygulama kapanmasın diye kısa gecikme.
    setTimeout(() => void window.desktop.guncelleme.kur(), 400);
  }

  // Kurulum: tam ekran bekleme
  if (durum === 'kuruluyor') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-slate-900 text-white">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-white/10">
          <Logo size={40} />
        </div>
        <div className="text-lg font-semibold">Güncelleniyor…</div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Spinner />
          Sürüm {surum} kuruluyor, uygulama birazdan yeniden başlayacak.
        </div>
        <p className="text-xs text-slate-500">Lütfen bekleyin, kapatmayın.</p>
      </div>
    );
  }

  if (durum === 'yok' || gizli) return null;

  // İndiriliyor / hazır: alt orta kart
  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[22rem] max-w-[92%] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl">
      {durum === 'iniyor' ? (
        <>
          <div className="mb-2 text-sm font-medium text-slate-800">
            ⬇ Yeni sürüm indiriliyor… {surum && `(${surum})`}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${yuzde}%` }}
            />
          </div>
          <div className="mt-1 text-right text-xs text-slate-400">%{yuzde}</div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-900">Güncelleme hazır 🎉</div>
              <div className="text-xs text-slate-500">
                Sürüm {surum} indirildi. Şimdi güncelleyip yeni özellikleri kullanabilirsiniz.
              </div>
            </div>
            <button
              onClick={() => setGizli(true)}
              className="rounded-md px-1.5 text-slate-400 hover:bg-slate-100"
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setGizli(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Sonra
            </button>
            <button
              onClick={guncelle}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Şimdi güncelle
            </button>
          </div>
        </>
      )}
    </div>
  );
}
