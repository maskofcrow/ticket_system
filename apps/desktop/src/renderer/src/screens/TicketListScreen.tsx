import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  KAPALI_DURUMLAR,
  DURUM_ETIKET,
  type TalepOnceligi,
  type TalepDurumu,
  type TalepOzeti,
} from '../../../shared/sozlesme.js';
import { api } from '../lib/api';
import { clearBadge } from '../lib/notifications';
import { Button, Card, Spinner } from '../components/ui';

const DURUM_NOKTA: Record<TalepDurumu, string> = {
  ACIK: 'bg-blue-500',
  ISLEMDE: 'bg-amber-500',
  MUSTERI_BEKLENIYOR: 'bg-purple-500',
  COZULDU: 'bg-emerald-500',
  KAPALI: 'bg-slate-400',
};

const ONCELIK_RENK: Record<TalepOnceligi, string> = {
  DUSUK: 'text-slate-500',
  NORMAL: 'text-slate-500',
  YUKSEK: 'text-orange-600',
  ACIL: 'text-red-600 font-medium',
};

export function TicketListScreen({
  onOpen,
  onNew,
}: {
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  // queryKey'ler notifications.ts'teki invalidate çağrılarıyla aynı olmalı.
  const talepler = useQuery({
    queryKey: ['talepler'],
    queryFn: () => api.talepler(),
  });

  // Liste görüntülenince okunmamış rozeti sıfırlanır.
  useEffect(() => clearBadge(), []);

  const kayitlar = talepler.data ?? [];
  const acik = kayitlar.filter((t) => !KAPALI_DURUMLAR.includes(t.durum));
  const kapali = kayitlar.filter((t) => KAPALI_DURUMLAR.includes(t.durum));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Destek taleplerim</h1>
        <Button onClick={onNew}>+ Yeni talep</Button>
      </div>

      {talepler.isLoading ? (
        <Spinner />
      ) : kayitlar.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-900">Henüz talebiniz yok</p>
          <p className="mt-1 mb-5 text-sm text-slate-500">
            Bir sorun yaşadığınızda buradan destek ekibine iletebilirsiniz.
          </p>
          <Button onClick={onNew}>İlk talebinizi oluşturun</Button>
        </Card>
      ) : (
        <>
          <TalepGrubu baslik="Açık talepler" talepler={acik} onOpen={onOpen} />
          {kapali.length > 0 && (
            <TalepGrubu baslik="Kapanmış talepler" talepler={kapali} onOpen={onOpen} soluk />
          )}
        </>
      )}
    </div>
  );
}

function TalepGrubu({
  baslik,
  talepler,
  onOpen,
  soluk = false,
}: {
  baslik: string;
  talepler: TalepOzeti[];
  onOpen: (id: string) => void;
  soluk?: boolean;
}) {
  if (talepler.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">{baslik}</h2>
      <Card className={soluk ? 'opacity-70' : ''}>
        <ul className="divide-y divide-slate-100">
          {talepler.map((talep) => (
            <li key={talep.id}>
              <button
                onClick={() => onOpen(talep.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className={`size-2 shrink-0 rounded-full ${DURUM_NOKTA[talep.durum]}`} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{talep.baslik}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    #{talep.numara} · {DURUM_ETIKET[talep.durum]}
                    {talep.mesajSayisi > 0 && ` · ${talep.mesajSayisi} mesaj`}
                    {talep.atanan && ` · ${talep.atanan.ad}`}
                  </p>
                </div>

                <span className={`shrink-0 text-xs ${ONCELIK_RENK[talep.oncelik]}`}>
                  {talep.oncelik === 'ACIL' ? 'Acil' : talep.oncelik === 'YUKSEK' ? 'Yüksek' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
