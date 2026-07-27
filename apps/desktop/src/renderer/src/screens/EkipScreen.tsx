import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EkipUyesi, FirmaMesaji } from '../../../shared/sozlesme.js';
import { api, ApiHatasi } from '../lib/api';
import { clearBadge } from '../lib/notifications';
import { Button, Card, ErrorBanner, Spinner, Textarea } from '../components/ui';

/**
 * Firma-içi workspace: aynı müşteri firmanın portal kullanıcıları birbirini
 * görür ve ortak bir kanalda yazışır. Kapsam sunucuda customerId ile sınırlı;
 * başka firmanın kanalı ne okunur ne yazılır.
 */
export function EkipScreen() {
  const qc = useQueryClient();

  const uyeler = useQuery({
    queryKey: ['ekip', 'uyeler'],
    queryFn: () => api.ekipUyeleri(),
  });

  const mesajlar = useQuery({
    queryKey: ['ekip', 'mesajlar'],
    queryFn: () => api.ekipMesajlari(),
    // SSE olayı da tazeliyor ama açık ekranda kısa aralık ek güvence.
    refetchInterval: 15_000,
  });

  const [taslak, setTaslak] = useState('');
  const gonder = useMutation({
    mutationFn: (icerik: string) => api.ekipMesajGonder(icerik),
    onSuccess: () => {
      setTaslak('');
      void qc.invalidateQueries({ queryKey: ['ekip', 'mesajlar'] });
    },
  });

  // Ekip ekranı açıkken gelen mesajların rozetini sıfır tut.
  useEffect(() => clearBadge(), [mesajlar.data?.length]);

  const kayitlar = mesajlar.data ?? [];
  const benId = uyeler.data?.find((u) => u.ben)?.id;

  function gonderTetikle() {
    const temiz = taslak.trim();
    if (!temiz || gonder.isPending) return;
    gonder.mutate(temiz);
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl gap-4 p-6">
      {/* Sohbet */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="mb-3 text-lg font-semibold text-slate-900">Ekip sohbeti</h1>

        <Card className="flex min-h-0 flex-1 flex-col">
          <MesajListesi
            kayitlar={kayitlar}
            benId={benId}
            yukleniyor={mesajlar.isLoading}
          />

          <div className="border-t border-slate-100 p-3">
            {gonder.isError && (
              <div className="mb-2">
                <ErrorBanner
                  message={
                    gonder.error instanceof ApiHatasi
                      ? gonder.error.message
                      : 'Mesaj gönderilemedi.'
                  }
                />
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                rows={2}
                value={taslak}
                onChange={(e) => setTaslak(e.target.value)}
                onKeyDown={(e) => {
                  // Enter gönderir, Shift+Enter yeni satır.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    gonderTetikle();
                  }
                }}
                placeholder="Ekibine bir mesaj yaz…"
                className="resize-none"
              />
              <Button onClick={gonderTetikle} disabled={!taslak.trim() || gonder.isPending}>
                Gönder
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Ekip üyeleri */}
      <div className="w-56 shrink-0">
        <h2 className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Ekip {uyeler.data && `· ${uyeler.data.length}`}
        </h2>
        <Card className="p-2">
          {uyeler.isLoading ? (
            <Spinner />
          ) : (
            <ul className="space-y-0.5">
              {(uyeler.data ?? []).map((u) => (
                <UyeSatiri key={u.id} uye={u} />
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function MesajListesi({
  kayitlar,
  benId,
  yukleniyor,
}: {
  kayitlar: FirmaMesaji[];
  benId: string | undefined;
  yukleniyor: boolean;
}) {
  const altRef = useRef<HTMLDivElement>(null);

  // Yeni mesaj gelince en alta kaydır.
  useEffect(() => {
    altRef.current?.scrollIntoView({ block: 'end' });
  }, [kayitlar.length]);

  if (yukleniyor) return <Spinner />;

  if (kayitlar.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <p className="text-sm text-slate-500">
          Henüz mesaj yok. İlk mesajı sen yaz.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      {kayitlar.map((m) => {
        const benim = m.yazar.id === benId;
        return (
          <div key={m.id} className={`flex ${benim ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[75%]">
              {!benim && (
                <span className="mb-0.5 block text-xs font-medium text-slate-600">
                  {m.yazar.ad}
                </span>
              )}
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  benim
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                {m.icerik}
              </div>
              <span
                className={`mt-0.5 block text-[11px] text-slate-400 ${
                  benim ? 'text-right' : ''
                }`}
              >
                {saatBiçimi(m.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={altRef} />
    </div>
  );
}

function UyeSatiri({ uye }: { uye: EkipUyesi }) {
  const bashHarf = uye.ad.trim().charAt(0).toUpperCase() || '?';
  return (
    <li className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200
                   text-xs font-medium text-slate-600"
      >
        {bashHarf}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-800">
          {uye.ad}
          {uye.ben && <span className="text-slate-400"> (sen)</span>}
        </p>
        <p className="truncate text-xs text-slate-400">{uye.eposta}</p>
      </div>
    </li>
  );
}

function saatBiçimi(iso: string): string {
  const d = new Date(iso);
  const bugun = new Date();
  const ayniGun =
    d.getFullYear() === bugun.getFullYear() &&
    d.getMonth() === bugun.getMonth() &&
    d.getDate() === bugun.getDate();
  const saat = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (ayniGun) return saat;
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })} ${saat}`;
}
