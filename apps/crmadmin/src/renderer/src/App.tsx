import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
import { Logo } from './components/Logo';
import { Button, Spinner } from './components/ui';
import type { Cihaz } from '../../shared/sozlesme';
import { Giris } from './screens/Giris';
import { CihazListesi } from './screens/CihazListesi';
import { Masaustu } from './screens/Masaustu';

type View = 'liste' | 'giris' | 'masaustu';

export function App(): React.ReactElement {
  const [sunucu, setSunucu] = useState('');
  const [view, setView] = useState<View>('liste');
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([]);
  const [secili, setSecili] = useState<Cihaz | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);

  const yenile = useCallback(async () => {
    setYukleniyor(true);
    setHata(null);
    const res = await api.cihazlar();
    setYukleniyor(false);
    if (res.ok) {
      setCihazlar(res.cihazlar);
      setView((v) => (v === 'giris' ? 'liste' : v));
    } else if (res.girisGerekli) {
      setView('giris');
    } else {
      setHata(res.hata ?? 'Cihazlar alınamadı.');
    }
  }, []);

  useEffect(() => {
    void api.sunucu().then(setSunucu);
    void yenile();
  }, [yenile]);

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <header
        className="titlebar-drag flex h-12 shrink-0 items-center gap-3 border-b border-slate-200
                   bg-white px-4 pl-20"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="flex size-6 items-center justify-center rounded-md bg-slate-900 text-white">
            <Logo size={15} />
          </span>
          Esta Uzak Yönetim
        </span>

        <div className="ml-auto flex items-center gap-2">
          {view === 'masaustu' && (
            <Button variant="ghost" onClick={() => setView('liste')}>
              ← Cihazlar
            </Button>
          )}
          {view !== 'masaustu' && (
            <Button variant="ghost" onClick={() => void yenile()} disabled={yukleniyor}>
              Yenile
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view === 'giris' && <Giris sunucu={sunucu} onGiris={() => void yenile()} />}

        {view === 'liste' &&
          (yukleniyor && cihazlar.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <CihazListesi
              cihazlar={cihazlar}
              hata={hata}
              onSec={(c) => {
                setSecili(c);
                setView('masaustu');
              }}
            />
          ))}

        {view === 'masaustu' && secili && <Masaustu sunucu={sunucu} cihaz={secili} />}
      </div>
    </div>
  );
}
