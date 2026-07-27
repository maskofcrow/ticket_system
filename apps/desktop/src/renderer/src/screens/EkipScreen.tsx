import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Ek,
  EkipUyesi,
  EkReferansi,
  FirmaMesaji,
} from '../../../shared/sozlesme.js';
import { api, ApiHatasi } from '../lib/api';
import { clearBadge } from '../lib/notifications';
import { screenshotFilename, uploadFile } from '../lib/upload';
import { Button, Card, ErrorBanner, Spinner, Textarea } from '../components/ui';

/**
 * Firma-içi workspace — kişi-kişi (Skype gibi) yazışma. Solda ekip üyeleri
 * (okunmamış rozetiyle), sağda seçili kişiyle konuşma. Metin ve resim/dosya
 * gönderilebilir. Kapsam sunucuda customerId ile firmaya kilitli.
 */
export function EkipScreen({ benId }: { benId: string }) {
  const [seciliId, setSeciliId] = useState<string | null>(null);

  const uyeler = useQuery({
    queryKey: ['ekip', 'uyeler'],
    queryFn: () => api.ekipUyeleri(),
    refetchInterval: 20_000,
  });

  const digerleri = (uyeler.data ?? []).filter((u) => !u.ben);
  const secili = digerleri.find((u) => u.id === seciliId) ?? null;

  return (
    <div className="mx-auto flex h-full max-w-5xl gap-4 p-6">
      {/* Kişi listesi */}
      <div className="flex w-64 shrink-0 flex-col">
        <h1 className="mb-3 text-lg font-semibold text-slate-900">Ekip</h1>
        <Card className="min-h-0 flex-1 overflow-y-auto p-2">
          {uyeler.isLoading ? (
            <Spinner />
          ) : digerleri.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              Firmanızda başka kullanıcı yok.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {digerleri.map((u) => (
                <KisiSatiri
                  key={u.id}
                  uye={u}
                  secili={u.id === seciliId}
                  onClick={() => setSeciliId(u.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Konuşma */}
      <div className="flex min-w-0 flex-1 flex-col">
        {secili ? (
          <Konusma key={secili.id} kisi={secili} benId={benId} />
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">
              Yazışmak için soldan bir ekip arkadaşını seç.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function KisiSatiri({
  uye,
  secili,
  onClick,
}: {
  uye: EkipUyesi;
  secili: boolean;
  onClick: () => void;
}) {
  const bashHarf = uye.ad.trim().charAt(0).toUpperCase() || '?';
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition ${
          secili ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
        }`}
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200
                     text-sm font-medium text-slate-600"
        >
          {bashHarf}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{uye.ad}</p>
          <p className="truncate text-xs text-slate-400">{uye.eposta}</p>
        </div>
        {uye.okunmamis > 0 && (
          <span
            className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600
                       px-1.5 text-xs font-medium text-white"
          >
            {uye.okunmamis}
          </span>
        )}
      </button>
    </li>
  );
}

function Konusma({ kisi, benId }: { kisi: EkipUyesi; benId: string }) {
  const qc = useQueryClient();
  const [taslak, setTaslak] = useState('');
  const [bekleyen, setBekleyen] = useState<{ id: string; blob: Blob; previewUrl: string }[]>([]);
  const [hata, setHata] = useState<string | null>(null);

  const mesajlar = useQuery({
    queryKey: ['ekip', 'mesajlar', kisi.id],
    queryFn: () => api.ekipMesajlari(kisi.id),
    refetchInterval: 15_000,
  });

  // Konuşma açılınca/güncellenince rozetleri tazele (sunucu okundu işaretledi).
  useEffect(() => {
    clearBadge();
    void qc.invalidateQueries({ queryKey: ['ekip', 'uyeler'] });
  }, [kisi.id, mesajlar.data?.length, qc]);

  const gonder = useMutation({
    mutationFn: async () => {
      const yuklenen: EkReferansi[] = [];
      for (const oge of bekleyen) {
        yuklenen.push(await uploadFile(oge.blob, screenshotFilename()));
      }
      return api.ekipMesajGonder({
        aliciId: kisi.id,
        icerik: taslak.trim() || undefined,
        ekler: yuklenen.length ? yuklenen : undefined,
      });
    },
    onSuccess: () => {
      setTaslak('');
      setBekleyen([]);
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['ekip', 'mesajlar', kisi.id] });
    },
    onError: (e) => setHata(e instanceof ApiHatasi ? e.message : 'Mesaj gönderilemedi.'),
  });

  function handlePaste(event: ClipboardEvent): void {
    const dosya = Array.from(event.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (!dosya) return;
    event.preventDefault();
    setBekleyen((onceki) => [
      ...onceki,
      { id: crypto.randomUUID(), blob: dosya, previewUrl: URL.createObjectURL(dosya) },
    ]);
  }

  async function dosyaSec(): Promise<void> {
    const girdi = document.createElement('input');
    girdi.type = 'file';
    girdi.accept = 'image/*';
    girdi.onchange = () => {
      const f = girdi.files?.[0];
      if (f) {
        setBekleyen((onceki) => [
          ...onceki,
          { id: crypto.randomUUID(), blob: f, previewUrl: URL.createObjectURL(f) },
        ]);
      }
    };
    girdi.click();
  }

  function gonderTetikle(): void {
    if (gonder.isPending) return;
    if (!taslak.trim() && bekleyen.length === 0) return;
    gonder.mutate();
  }

  const kayitlar = mesajlar.data ?? [];

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      {/* Başlık */}
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
        <span
          className="flex size-8 items-center justify-center rounded-full bg-slate-200 text-sm
                     font-medium text-slate-600"
        >
          {kisi.ad.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{kisi.ad}</p>
          <p className="text-xs text-slate-400">{kisi.eposta}</p>
        </div>
      </div>

      {/* Mesajlar */}
      <MesajListesi kayitlar={kayitlar} benId={benId} yukleniyor={mesajlar.isLoading} />

      {/* Yazma alanı */}
      <div className="border-t border-slate-100 p-3">
        {hata && (
          <div className="mb-2">
            <ErrorBanner message={hata} />
          </div>
        )}

        {bekleyen.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {bekleyen.map((oge) => (
              <div key={oge.id} className="relative">
                <img
                  src={oge.previewUrl}
                  alt="ek"
                  className="h-16 w-24 rounded object-cover ring-1 ring-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setBekleyen((o) => o.filter((p) => p.id !== oge.id))}
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

        <div className="flex items-end gap-2">
          <Button
            variant="secondary"
            onClick={() => void dosyaSec()}
            className="shrink-0"
            title="Resim ekle"
          >
            📎
          </Button>
          <Textarea
            rows={2}
            value={taslak}
            onChange={(e) => setTaslak(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                gonderTetikle();
              }
            }}
            placeholder={`${kisi.ad}'a bir mesaj yaz… (resmi yapıştırabilirsin)`}
            className="resize-none"
          />
          <Button
            onClick={gonderTetikle}
            disabled={gonder.isPending || (!taslak.trim() && bekleyen.length === 0)}
            className="shrink-0"
          >
            {gonder.isPending ? '…' : 'Gönder'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MesajListesi({
  kayitlar,
  benId,
  yukleniyor,
}: {
  kayitlar: FirmaMesaji[];
  benId: string;
  yukleniyor: boolean;
}) {
  const altRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    altRef.current?.scrollIntoView({ block: 'end' });
  }, [kayitlar.length]);

  if (yukleniyor) return <Spinner />;

  if (kayitlar.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-10 text-center">
        <p className="text-sm text-slate-500">Henüz mesaj yok. İlk mesajı sen yaz.</p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
      {kayitlar.map((m) => {
        const benim = m.gonderenId === benId;
        return (
          <div key={m.id} className={`flex ${benim ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[75%]">
              <div
                className={`rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                  benim ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900'
                }`}
              >
                {m.icerik && <span>{m.icerik}</span>}
                {m.ekler.length > 0 && <Ekler ogeler={m.ekler} acik={benim} />}
              </div>
              <span className={`mt-0.5 block text-[11px] text-slate-400 ${benim ? 'text-right' : ''}`}>
                {saatBicimi(m.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={altRef} />
    </div>
  );
}

function Ekler({ ogeler, acik }: { ogeler: Ek[]; acik: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ogeler.map((dosya) =>
        dosya.mimeTipi.startsWith('image/') ? (
          <a key={dosya.id} href={dosya.indirmeAdresi} target="_blank" rel="noreferrer">
            <img
              src={dosya.indirmeAdresi}
              alt={dosya.dosyaAdi}
              className="max-h-48 rounded-lg object-cover ring-1 ring-black/10"
            />
          </a>
        ) : (
          <a
            key={dosya.id}
            href={dosya.indirmeAdresi}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
              acik
                ? 'bg-white/20 text-white hover:bg-white/30'
                : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
            }`}
          >
            📎 <span className="max-w-48 truncate">{dosya.dosyaAdi}</span>
          </a>
        ),
      )}
    </div>
  );
}

function saatBicimi(iso: string): string {
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
