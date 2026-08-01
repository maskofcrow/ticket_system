import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  KAPALI_DURUMLAR,
  DURUM_ETIKET,
  type Ek,
  type EkReferansi,
} from '../../../shared/sozlesme.js';
import { api, ApiHatasi } from '../lib/api';
import { screenshotFilename, uploadFile } from '../lib/upload';
import { Button, Card, ErrorBanner, Spinner, Textarea } from '../components/ui';
import { GorselDuzenleyici } from '../components/GorselDuzenleyici';

export function TicketDetailScreen({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const talep = useQuery({
    queryKey: ['talep', ticketId],
    queryFn: () => api.talep(ticketId),
  });

  const [icerik, setIcerik] = useState('');
  const [bekleyen, setBekleyen] = useState<{ id: string; blob: Blob; previewUrl: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [duzenle, setDuzenle] = useState<string | null>(null); // data URL
  const [duzenleGonderiliyor, setDuzenleGonderiliyor] = useState(false);

  // Sunucudaki görseli ana süreçten alıp (taint'siz) düzenleyiciye ver.
  async function duzenleyiciAc(indirmeAdresi: string): Promise<void> {
    setError(null);
    const dataUrl = await window.desktop.gorselGetir(indirmeAdresi);
    if (dataUrl) setDuzenle(dataUrl);
    else setError('Görsel düzenleyiciye yüklenemedi.');
  }

  async function duzenleneniGonder(blob: Blob): Promise<void> {
    setDuzenleGonderiliyor(true);
    try {
      const ref = await uploadFile(blob, screenshotFilename());
      await api.mesajYaz(ticketId, { icerik: '(düzenlenmiş görsel)', ekler: [ref] });
      setDuzenle(null);
      void qc.invalidateQueries({ queryKey: ['talep', ticketId] });
      void qc.invalidateQueries({ queryKey: ['talepler'] });
    } catch (e) {
      setError(e instanceof ApiHatasi ? e.message : 'Gönderilemedi');
    } finally {
      setDuzenleGonderiliyor(false);
    }
  }

  const yanitla = useMutation({
    mutationFn: async () => {
      const yuklenen: EkReferansi[] = [];
      for (const ogeler of bekleyen) {
        yuklenen.push(await uploadFile(ogeler.blob, screenshotFilename()));
      }
      return api.mesajYaz(ticketId, { icerik: icerik.trim(), ekler: yuklenen });
    },
    onSuccess: () => {
      setIcerik('');
      setBekleyen([]);
      void qc.invalidateQueries({ queryKey: ['talep', ticketId] });
      void qc.invalidateQueries({ queryKey: ['talepler'] });
    },
  });

  // Müşterinin değiştirebildiği tek durum: kapatma (sunucu diğerlerine 403 döner).
  const kapat = useMutation({
    mutationFn: () => api.talebiKapat(ticketId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['talep', ticketId] });
      void qc.invalidateQueries({ queryKey: ['talepler'] });
    },
  });

  if (talep.isLoading) return <Spinner />;
  if (!talep.data) {
    return (
      <div className="p-6">
        <ErrorBanner message="Talep yüklenemedi." />
        <Button variant="secondary" className="mt-3" onClick={onBack}>
          Geri dön
        </Button>
      </div>
    );
  }

  const t = talep.data;
  const kapaliMi = KAPALI_DURUMLAR.includes(t.durum);

  function handlePaste(event: ClipboardEvent): void {
    const dosya = Array.from(event.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (!dosya) return;
    event.preventDefault();
    setBekleyen((onceki) => [
      ...onceki,
      { id: crypto.randomUUID(), blob: dosya, previewUrl: URL.createObjectURL(dosya) },
    ]);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await yanitla.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiHatasi ? err.message : 'Mesaj gönderilemedi');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
        ← Taleplerime dön
      </button>

      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <span>#{t.numara}</span>
          <span>·</span>
          <span className="font-medium text-slate-700">{DURUM_ETIKET[t.durum]}</span>
          {t.atanan && (
            <>
              <span>·</span>
              <span>İlgilenen: {t.atanan.ad}</span>
            </>
          )}
        </div>

        <h1 className="text-lg font-semibold text-slate-900">{t.baslik}</h1>
        <p className="prose-plain mt-3 text-sm text-slate-700">{t.aciklama}</p>
        {t.ekler.length > 0 && <Ekler ogeler={t.ekler} onDuzenle={duzenleyiciAc} />}
      </Card>

      {t.mesajlar.map((mesaj) => {
        const destekten = mesaj.yazar.tip === 'PERSONEL';
        return (
          <Card
            key={mesaj.id}
            className={`p-4 ${destekten ? 'border-l-4 border-l-blue-500' : 'ml-8'}`}
          >
            <p className="mb-1.5 text-xs">
              <span className="font-medium text-slate-900">{mesaj.yazar.ad}</span>
              <span className="text-slate-500"> · {destekten ? 'Destek ekibi' : 'siz'}</span>
            </p>
            <p className="prose-plain text-sm text-slate-700">{mesaj.icerik}</p>
            {mesaj.ekler.length > 0 && <Ekler ogeler={mesaj.ekler} onDuzenle={duzenleyiciAc} />}
          </Card>
        );
      })}

      {kapaliMi ? (
        <Card className="p-4 text-center">
          <p className="text-sm text-slate-600">
            Bu talep {DURUM_ETIKET[t.durum].toLocaleLowerCase('tr')} durumda.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sorun devam ediyorsa aşağıya yazın; talep otomatik olarak yeniden açılır.
          </p>
        </Card>
      ) : null}

      <Card className="p-4">
        <form onSubmit={submit} className="space-y-3">
          {error && <ErrorBanner message={error} />}

          <Textarea
            rows={4}
            value={icerik}
            onChange={(e) => setIcerik(e.target.value)}
            onPaste={handlePaste}
            placeholder="Mesajınızı yazın… (ekran görüntüsünü buraya yapıştırabilirsiniz)"
          />

          {bekleyen.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {bekleyen.map((oge) => (
                <div key={oge.id} className="relative">
                  <img
                    src={oge.previewUrl}
                    alt="ek"
                    className="h-16 w-24 rounded object-cover ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setBekleyen((onceki) => onceki.filter((p) => p.id !== oge.id))}
                    className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center
                               rounded-full bg-slate-900 text-xs text-white"
                    aria-label="Eki kaldır"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            {!kapaliMi && t.durum === 'COZULDU' ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => kapat.mutate()}
                disabled={kapat.isPending}
              >
                Sorunum çözüldü, kapat
              </Button>
            ) : (
              <span />
            )}

            <Button type="submit" disabled={yanitla.isPending || !icerik.trim()}>
              {yanitla.isPending ? 'Gönderiliyor…' : 'Gönder'}
            </Button>
          </div>
        </form>
      </Card>

      {duzenle && (
        <GorselDuzenleyici
          dataUrl={duzenle}
          gonderiliyor={duzenleGonderiliyor}
          onGonder={duzenleneniGonder}
          onKapat={() => setDuzenle(null)}
        />
      )}
    </div>
  );
}

function Ekler({ ogeler, onDuzenle }: { ogeler: Ek[]; onDuzenle?: (indirmeAdresi: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ogeler.map((dosya) =>
        dosya.mimeTipi.startsWith('image/') ? (
          <div key={dosya.id} className="group relative">
            <a href={dosya.indirmeAdresi} target="_blank" rel="noreferrer">
              <img
                src={dosya.indirmeAdresi}
                alt={dosya.dosyaAdi}
                className="h-24 rounded-md object-cover ring-1 ring-slate-200"
              />
            </a>
            {onDuzenle && (
              <button
                type="button"
                onClick={() => onDuzenle(dosya.indirmeAdresi)}
                className="absolute bottom-1 right-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[11px]
                           text-white opacity-0 transition group-hover:opacity-100"
              >
                Düzenle
              </button>
            )}
          </div>
        ) : (
          <a
            key={dosya.id}
            href={dosya.indirmeAdresi}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs
                       text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
          >
            📎 <span className="max-w-48 truncate">{dosya.dosyaAdi}</span>
          </a>
        ),
      )}
    </div>
  );
}
