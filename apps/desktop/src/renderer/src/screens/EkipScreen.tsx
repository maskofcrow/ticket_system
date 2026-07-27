import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Ek,
  EkipUyesi,
  EkReferansi,
  SohbetMesaji,
  SohbetOzeti,
} from '../../../shared/sozlesme.js';
import { api, ApiHatasi } from '../lib/api';
import { clearBadge } from '../lib/notifications';
import { screenshotFilename, uploadFile } from '../lib/upload';
import { Button, Card, ErrorBanner, Input, Spinner, Textarea } from '../components/ui';

/**
 * Firma-içi workspace — DM + grup sohbeti (WhatsApp mantığı). Solda sohbet
 * listesi (okunmamış rozetiyle), sağda seçili sohbet. Metin ve resim/dosya
 * gönderilebilir. Herkes grup kurabilir; her üye gruba yeni kişi ekleyebilir.
 * Kapsam sunucuda customerId + üyelik ile sınırlı.
 */
export function EkipScreen({ benId }: { benId: string }) {
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const [yeniAcik, setYeniAcik] = useState(false);

  const sohbetler = useQuery({
    queryKey: ['sohbetler'],
    queryFn: () => api.sohbetler(),
    refetchInterval: 20_000,
  });

  const secili = sohbetler.data?.find((s) => s.id === seciliId) ?? null;

  return (
    <div className="mx-auto flex h-full max-w-5xl gap-4 p-6">
      {/* Sohbet listesi */}
      <div className="flex w-72 shrink-0 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Sohbetler</h1>
          <Button onClick={() => setYeniAcik(true)} className="px-2.5 py-1.5" title="Yeni sohbet">
            + Yeni
          </Button>
        </div>

        <Card className="min-h-0 flex-1 overflow-y-auto p-2">
          {sohbetler.isLoading ? (
            <Spinner />
          ) : (sohbetler.data?.length ?? 0) === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">
              Henüz sohbetin yok. “+ Yeni” ile başla.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {sohbetler.data!.map((s) => (
                <SohbetSatiri
                  key={s.id}
                  sohbet={s}
                  secili={s.id === seciliId}
                  onClick={() => setSeciliId(s.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Konuşma */}
      <div className="flex min-w-0 flex-1 flex-col">
        {secili ? (
          <Konusma key={secili.id} sohbet={secili} benId={benId} />
        ) : (
          <Card className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">Soldan bir sohbet seç ya da yeni başlat.</p>
          </Card>
        )}
      </div>

      {yeniAcik && (
        <YeniSohbet
          onKapat={() => setYeniAcik(false)}
          onAcildi={(id) => {
            setSeciliId(id);
            setYeniAcik(false);
          }}
        />
      )}
    </div>
  );
}

function SohbetSatiri({
  sohbet,
  secili,
  onClick,
}: {
  sohbet: SohbetOzeti;
  secili: boolean;
  onClick: () => void;
}) {
  const grup = sohbet.tur === 'GRUP';
  const bashHarf = sohbet.baslik.trim().charAt(0).toUpperCase() || '?';
  const onizleme = sohbet.sonMesaj
    ? `${grup ? `${sohbet.sonMesaj.gonderenAd}: ` : ''}${
        sohbet.sonMesaj.icerik || (sohbet.sonMesaj.ekVar ? '📎 Dosya' : '')
      }`
    : 'Henüz mesaj yok';

  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition ${
          secili ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
        }`}
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
            grup ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {grup ? '#' : bashHarf}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{sohbet.baslik}</p>
          <p className="truncate text-xs text-slate-400">{onizleme}</p>
        </div>
        {sohbet.okunmamis > 0 && (
          <span
            className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600
                       px-1.5 text-xs font-medium text-white"
          >
            {sohbet.okunmamis}
          </span>
        )}
      </button>
    </li>
  );
}

function Konusma({ sohbet, benId }: { sohbet: SohbetOzeti; benId: string }) {
  const qc = useQueryClient();
  const [taslak, setTaslak] = useState('');
  const [bekleyen, setBekleyen] = useState<{ id: string; blob: Blob; previewUrl: string }[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [uyeEkleAcik, setUyeEkleAcik] = useState(false);

  const grup = sohbet.tur === 'GRUP';

  const mesajlar = useQuery({
    queryKey: ['sohbet', sohbet.id],
    queryFn: () => api.sohbetMesajlari(sohbet.id),
    refetchInterval: 15_000,
  });

  // Açılınca/güncellenince okundu işaretlenir (sunucu) → rozetleri tazele.
  useEffect(() => {
    clearBadge();
    void qc.invalidateQueries({ queryKey: ['sohbetler'] });
  }, [sohbet.id, mesajlar.data?.length, qc]);

  const gonder = useMutation({
    mutationFn: async () => {
      const yuklenen: EkReferansi[] = [];
      for (const oge of bekleyen) {
        yuklenen.push(await uploadFile(oge.blob, screenshotFilename()));
      }
      return api.sohbetMesajGonder(sohbet.id, {
        icerik: taslak.trim() || undefined,
        ekler: yuklenen.length ? yuklenen : undefined,
      });
    },
    onSuccess: () => {
      setTaslak('');
      setBekleyen([]);
      setHata(null);
      void qc.invalidateQueries({ queryKey: ['sohbet', sohbet.id] });
      void qc.invalidateQueries({ queryKey: ['sohbetler'] });
    },
    onError: (e) => setHata(e instanceof ApiHatasi ? e.message : 'Mesaj gönderilemedi.'),
  });

  function handlePaste(event: ClipboardEvent): void {
    const dosya = Array.from(event.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (!dosya) return;
    event.preventDefault();
    setBekleyen((o) => [
      ...o,
      { id: crypto.randomUUID(), blob: dosya, previewUrl: URL.createObjectURL(dosya) },
    ]);
  }

  function dosyaSec(): void {
    const girdi = document.createElement('input');
    girdi.type = 'file';
    girdi.accept = 'image/*';
    girdi.onchange = () => {
      const f = girdi.files?.[0];
      if (f) {
        setBekleyen((o) => [
          ...o,
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
          className={`flex size-9 items-center justify-center rounded-full text-sm font-medium ${
            grup ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {grup ? '#' : sohbet.baslik.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{sohbet.baslik}</p>
          <p className="truncate text-xs text-slate-400">
            {grup ? `${sohbet.uyeler.length} üye` : 'Birebir sohbet'}
          </p>
        </div>
        {grup && (
          <Button variant="secondary" onClick={() => setUyeEkleAcik(true)} className="shrink-0">
            + Üye
          </Button>
        )}
      </div>

      <MesajListesi kayitlar={kayitlar} benId={benId} grup={grup} yukleniyor={mesajlar.isLoading} />

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
          <Button variant="secondary" onClick={dosyaSec} className="shrink-0" title="Resim ekle">
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
            placeholder="Bir mesaj yaz… (resmi yapıştırabilirsin)"
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

      {uyeEkleAcik && (
        <UyeEkle
          sohbet={sohbet}
          onKapat={() => setUyeEkleAcik(false)}
          onEklendi={() => {
            setUyeEkleAcik(false);
            void qc.invalidateQueries({ queryKey: ['sohbetler'] });
          }}
        />
      )}
    </Card>
  );
}

function MesajListesi({
  kayitlar,
  benId,
  grup,
  yukleniyor,
}: {
  kayitlar: SohbetMesaji[];
  benId: string;
  grup: boolean;
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
        const benim = m.gonderen.id === benId;
        return (
          <div key={m.id} className={`flex ${benim ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[75%]">
              {grup && !benim && (
                <span className="mb-0.5 block px-1 text-xs font-medium text-slate-600">
                  {m.gonderen.ad}
                </span>
              )}
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

// ── Yeni sohbet (DM başlat / grup kur) ─────────────────────────────────────────

function YeniSohbet({
  onKapat,
  onAcildi,
}: {
  onKapat: () => void;
  onAcildi: (sohbetId: string) => void;
}) {
  const qc = useQueryClient();
  const [mod, setMod] = useState<'dm' | 'grup'>('dm');
  const [grupAdi, setGrupAdi] = useState('');
  const [secililer, setSecililer] = useState<Set<string>>(new Set());
  const [hata, setHata] = useState<string | null>(null);

  const uyeler = useQuery({ queryKey: ['ekip', 'uyeler'], queryFn: () => api.ekipUyeleri() });
  const digerleri = useMemo(() => (uyeler.data ?? []).filter((u) => !u.ben), [uyeler.data]);

  const olustur = useMutation({
    mutationFn: (istek: Parameters<typeof api.sohbetOlustur>[0]) => api.sohbetOlustur(istek),
    onSuccess: (sohbet) => {
      void qc.invalidateQueries({ queryKey: ['sohbetler'] });
      onAcildi(sohbet.id);
    },
    onError: (e) => setHata(e instanceof ApiHatasi ? e.message : 'İşlem başarısız.'),
  });

  function toggle(id: string): void {
    setSecililer((o) => {
      const y = new Set(o);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }

  return (
    <Katman onKapat={onKapat}>
      <div className="mb-3 flex gap-2">
        <SekmeMini etkin={mod === 'dm'} onClick={() => setMod('dm')}>
          Yeni mesaj
        </SekmeMini>
        <SekmeMini etkin={mod === 'grup'} onClick={() => setMod('grup')}>
          Yeni grup
        </SekmeMini>
      </div>

      {hata && (
        <div className="mb-2">
          <ErrorBanner message={hata} />
        </div>
      )}

      {uyeler.isLoading ? (
        <Spinner />
      ) : mod === 'dm' ? (
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {digerleri.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Firmanızda başka kullanıcı yok.</p>
          ) : (
            digerleri.map((u) => (
              <button
                key={u.id}
                disabled={olustur.isPending}
                onClick={() => olustur.mutate({ tur: 'DIREKT', kisiId: u.id })}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-slate-50
                           disabled:opacity-50"
              >
                <Avatar ad={u.ad} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-800">{u.ad}</p>
                  <p className="truncate text-xs text-slate-400">{u.eposta}</p>
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <Input
            value={grupAdi}
            onChange={(e) => setGrupAdi(e.target.value)}
            placeholder="Grup adı (ör. Muhasebe)"
          />
          <UyeSecici uyeler={digerleri} secililer={secililer} onToggle={toggle} />
          <Button
            className="w-full"
            disabled={!grupAdi.trim() || secililer.size === 0 || olustur.isPending}
            onClick={() =>
              olustur.mutate({ tur: 'GRUP', ad: grupAdi.trim(), uyeIds: [...secililer] })
            }
          >
            {olustur.isPending ? 'Oluşturuluyor…' : `Grup oluştur (${secililer.size})`}
          </Button>
        </div>
      )}
    </Katman>
  );
}

// ── Gruba üye ekle ─────────────────────────────────────────────────────────────

function UyeEkle({
  sohbet,
  onKapat,
  onEklendi,
}: {
  sohbet: SohbetOzeti;
  onKapat: () => void;
  onEklendi: () => void;
}) {
  const [secililer, setSecililer] = useState<Set<string>>(new Set());
  const [hata, setHata] = useState<string | null>(null);

  const uyeler = useQuery({ queryKey: ['ekip', 'uyeler'], queryFn: () => api.ekipUyeleri() });
  const mevcut = useMemo(() => new Set(sohbet.uyeler.map((u) => u.id)), [sohbet.uyeler]);
  const eklenebilir = useMemo(
    () => (uyeler.data ?? []).filter((u) => !u.ben && !mevcut.has(u.id)),
    [uyeler.data, mevcut],
  );

  const ekle = useMutation({
    mutationFn: () => api.sohbetUyeEkle(sohbet.id, [...secililer]),
    onSuccess: onEklendi,
    onError: (e) => setHata(e instanceof ApiHatasi ? e.message : 'Eklenemedi.'),
  });

  function toggle(id: string): void {
    setSecililer((o) => {
      const y = new Set(o);
      if (y.has(id)) y.delete(id);
      else y.add(id);
      return y;
    });
  }

  return (
    <Katman onKapat={onKapat}>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Gruba üye ekle</h2>
      {hata && (
        <div className="mb-2">
          <ErrorBanner message={hata} />
        </div>
      )}
      {uyeler.isLoading ? (
        <Spinner />
      ) : eklenebilir.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Eklenecek başka kişi yok.</p>
      ) : (
        <div className="space-y-3">
          <UyeSecici uyeler={eklenebilir} secililer={secililer} onToggle={toggle} />
          <Button
            className="w-full"
            disabled={secililer.size === 0 || ekle.isPending}
            onClick={() => ekle.mutate()}
          >
            {ekle.isPending ? 'Ekleniyor…' : `Ekle (${secililer.size})`}
          </Button>
        </div>
      )}
    </Katman>
  );
}

// ── Ortak küçük parçalar ───────────────────────────────────────────────────────

function UyeSecici({
  uyeler,
  secililer,
  onToggle,
}: {
  uyeler: EkipUyesi[];
  secililer: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-md ring-1 ring-slate-200 p-1">
      {uyeler.map((u) => {
        const secili = secililer.has(u.id);
        return (
          <button
            key={u.id}
            onClick={() => onToggle(u.id)}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition ${
              secili ? 'bg-blue-50' : 'hover:bg-slate-50'
            }`}
          >
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                secili ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'
              }`}
            >
              {secili ? '✓' : ''}
            </span>
            <Avatar ad={u.ad} />
            <span className="truncate text-sm text-slate-800">{u.ad}</span>
          </button>
        );
      })}
    </div>
  );
}

function Avatar({ ad }: { ad: string }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs
                 font-medium text-slate-600"
    >
      {ad.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function SekmeMini({
  etkin,
  onClick,
  children,
}: {
  etkin: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        etkin ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

/** Ortada beliren küçük panel + karartma. */
function Katman({ children, onKapat }: { children: React.ReactNode; onKapat: () => void }) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-6"
      onClick={onKapat}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
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
