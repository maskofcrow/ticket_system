import { useEffect, useState, type ClipboardEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ONCELIK_ETIKET,
  type EkReferansi,
  type Kategori,
  type CihazBilgisi,
  type TalepOnceligi,
  type TalepDetayi,
} from '../../../shared/sozlesme.js';
import { api, ApiHatasi } from '../lib/api';
import { screenshotFilename, uploadFile } from '../lib/upload';
import { envanterBildirSimdi } from '../lib/envanter';
import { Button, Card, ErrorBanner, Field, Input, InfoBanner, Select, Textarea } from '../components/ui';

interface PendingAttachment {
  id: string;
  filename: string;
  previewUrl?: string;
  blob: Blob;
}

export function NewTicketScreen({
  onCreated,
  onCancel,
}: {
  onCreated: (talep: TalepDetayi) => void;
  onCancel: () => void;
}) {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ['kategoriler'],
    queryFn: () => api.kategoriler(),
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<TalepOnceligi>('NORMAL');
  const [categoryId, setCategoryId] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const [deviceInfo, setDeviceInfo] = useState<CihazBilgisi | null>(null);
  const [shareDevice, setShareDevice] = useState(true);
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Makine bilgisi form açılırken toplanır ama gönderilmeden önce kullanıcıya
  // gösterilir — ne paylaşıldığı sürpriz olmamalı.
  useEffect(() => {
    void (async () => {
      const [info, preference] = await Promise.all([
        window.desktop.device.collect(),
        window.desktop.device.getSharePreference(),
      ]);
      setDeviceInfo(info);
      setShareDevice(preference);
    })();
  }, []);

  const create = useMutation({
    mutationFn: async () => {
      const yuklenen: EkReferansi[] = [];
      for (const item of attachments) {
        yuklenen.push(await uploadFile(item.blob, item.filename));
      }

      return api.talepOlustur({
        baslik: title.trim(),
        aciklama: body.trim(),
        oncelik: priority,
        kategoriId: categoryId || null,
        cihazBilgisi: shareDevice ? deviceInfo : null,
        ekler: yuklenen,
      });
    },
    onSuccess: (talep) => {
      void qc.invalidateQueries({ queryKey: ['talepler'] });
      // Ticket açıldı → meshNodeId'yi taze gönder ki teknisyene "Uzak bağlan" hemen gelsin.
      void envanterBildirSimdi();
      onCreated(talep);
    },
  });

  /** Dosya seçiciden resim ekle. */
  function resimSec(): void {
    const girdi = document.createElement('input');
    girdi.type = 'file';
    girdi.accept = 'image/*';
    girdi.multiple = true;
    girdi.onchange = () => {
      for (const file of Array.from(girdi.files ?? [])) {
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            filename: file.name || screenshotFilename(),
            previewUrl: URL.createObjectURL(file),
            blob: file,
          },
        ]);
      }
    };
    girdi.click();
  }

  /** Ctrl/Cmd+V ile doğrudan yapıştırma — en çok kullanılan yol bu. */
  function handlePaste(event: ClipboardEvent): void {
    const file = Array.from(event.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    setAttachments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        filename: screenshotFilename(),
        previewUrl: URL.createObjectURL(file),
        blob: file,
      },
    ]);
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    try {
      await create.mutateAsync();
    } catch (err) {
      if (err instanceof ApiHatasi) {
        setError(err.message);
        setFieldErrors(err.alanlar ?? {});
      } else setError('Talep oluşturulamadı');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Yeni destek talebi</h1>
        <Button variant="ghost" type="button" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card className="space-y-4 p-4">
        <Field label="Konu" error={fieldErrors.baslik}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn: Yazıcı ağda görünmüyor"
            required
            minLength={3}
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Öncelik">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TalepOnceligi)}>
              {Object.entries(ONCELIK_ETIKET).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Kategori">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Seçiniz (isteğe bağlı)</option>
              {categories.data?.map((c: Kategori) => (
                <option key={c.id} value={c.id}>
                  {c.ad}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Sorunun açıklaması"
          hint="Ne zaman başladı, ne yapmayı denediniz, hata mesajı var mı?"
          error={fieldErrors.aciklama}
        >
          <Textarea
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={handlePaste}
            placeholder="Sorunu olabildiğince ayrıntılı anlatın. Ekran görüntüsünü doğrudan buraya yapıştırabilirsiniz."
            required
            minLength={10}
          />
        </Field>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Resimler ve dosyalar</h2>
          <Button variant="secondary" type="button" onClick={resimSec}>
            Resim ekle
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Ekran görüntüsü aldıysanız <b>Ctrl+V</b> ile buraya (ya da açıklama alanına)
          yapıştırabilirsiniz; ya da “Resim ekle” ile dosya seçin.
        </p>

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((item) => (
              <div key={item.id} className="relative">
                {item.previewUrl && (
                  <img
                    src={item.previewUrl}
                    alt={item.filename}
                    className="h-20 w-32 rounded-md object-cover ring-1 ring-slate-200"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== item.id))}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center
                             rounded-full bg-slate-900 text-xs text-white"
                  aria-label="Eki kaldır"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Henüz ek yok. Ekran görüntüsünü Cmd/Ctrl+V ile açıklama alanına da yapıştırabilirsiniz.
          </p>
        )}
      </Card>

      <Card className="p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={shareDevice}
            onChange={(e) => {
              setShareDevice(e.target.checked);
              void window.desktop.device.setSharePreference(e.target.checked);
            }}
            className="mt-0.5 size-4 rounded border-slate-300"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900">
              Bilgisayar bilgilerimi ekle
            </span>
            <span className="block text-xs text-slate-500">
              Destek ekibinin sorunu daha hızlı bulmasını sağlar.{' '}
              <button
                type="button"
                onClick={() => setShowDeviceDetails((v) => !v)}
                className="text-blue-600 hover:underline"
              >
                {showDeviceDetails ? 'gizle' : 'ne gönderiliyor?'}
              </button>
            </span>
          </span>
        </label>

        {showDeviceDetails && deviceInfo && (
          <dl className="mt-3 space-y-1 rounded-md bg-slate-50 p-3 text-xs">
            <DeviceRow label="İşletim sistemi" value={deviceInfo.isletimSistemi} />
            <DeviceRow label="Bilgisayar adı" value={deviceInfo.bilgisayarAdi} />
            <DeviceRow label="İşlemci" value={deviceInfo.islemci} />
            <DeviceRow label="Bellek" value={`${Math.round(deviceInfo.toplamBellekMb / 1024)} GB`} />
            <DeviceRow label="Boş disk" value={`${deviceInfo.bosDiskGb} GB`} />
            {deviceInfo.yerelIp && <DeviceRow label="Yerel IP" value={deviceInfo.yerelIp} />}
            <DeviceRow label="Uygulama sürümü" value={deviceInfo.uygulamaSurumu} />
          </dl>
        )}
      </Card>

      {create.isPending && attachments.length > 0 && (
        <InfoBanner>Dosyalar yükleniyor, lütfen bekleyin…</InfoBanner>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Vazgeç
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Gönderiliyor…' : 'Talebi gönder'}
        </Button>
      </div>
    </form>
  );
}

function DeviceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="selectable truncate font-medium text-slate-800">{value}</dd>
    </div>
  );
}
