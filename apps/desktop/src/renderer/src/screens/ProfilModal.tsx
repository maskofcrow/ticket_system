import { useEffect, useState } from 'react';
import { useSession } from '../lib/session';
import { ApiHatasi } from '../lib/api';
import { Button, Field, Input, ErrorBanner } from '../components/ui';

/** Kullanıcının kendi profilini (ad soyad) görüp düzenlediği pencere. */
export function ProfilModal({ onKapat }: { onKapat: () => void }) {
  const { kullanici, profilGuncelle } = useSession();
  const [ad, setAd] = useState(kullanici?.ad ?? '');
  const [surum, setSurum] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [basarili, setBasarili] = useState(false);

  useEffect(() => {
    void window.desktop.app.getVersion().then(setSurum);
  }, []);

  async function kaydet() {
    const temiz = ad.trim();
    if (temiz.length < 2) {
      setHata('Ad soyad en az 2 karakter olmalı.');
      return;
    }
    setYukleniyor(true);
    setHata(null);
    setBasarili(false);
    try {
      await profilGuncelle(temiz);
      setBasarili(true);
    } catch (e) {
      setHata(e instanceof ApiHatasi ? e.message : 'Güncellenemedi.');
    } finally {
      setYukleniyor(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6"
      onClick={onKapat}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-slate-900">Profilim</h2>

        <div className="space-y-3">
          <Field label="Ad soyad">
            <Input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ad soyad" />
          </Field>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">E-posta</span>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500 ring-1 ring-inset ring-slate-200">
              {kullanici?.eposta}
            </p>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Firma</span>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500 ring-1 ring-inset ring-slate-200">
              {kullanici?.firmaAdi}
            </p>
          </div>

          {hata && <ErrorBanner message={hata} />}
          {basarili && <p className="text-sm text-emerald-600">Profil güncellendi.</p>}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-400">Sürüm {surum}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onKapat}>
                Kapat
              </Button>
              <Button onClick={kaydet} disabled={yukleniyor || ad.trim() === (kullanici?.ad ?? '')}>
                {yukleniyor ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
