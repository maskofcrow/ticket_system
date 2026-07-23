import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type Priority,
  type TicketStatus,
} from '@ticket/shared';
import { useAddComment, useCategories, useStaff, useTicket, useUpdateTicket } from '../lib/queries';
import { formatBytes, formatDateTime, initials, timeAgo } from '../lib/format';
import { Button, Card, EmptyState, ErrorBanner, Select, Spinner, Textarea } from '../components/ui';
import { CategoryBadge, PriorityBadge, StatusBadge } from '../components/badges';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ticket = useTicket(id);
  const staff = useStaff();
  const categories = useCategories();
  const update = useUpdateTicket(id ?? '');
  const addComment = useAddComment(id ?? '');

  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ticket.isLoading) return <Spinner />;
  if (ticket.isError || !ticket.data) {
    return <EmptyState title="Talep bulunamadı" description="Silinmiş veya erişiminiz olmayabilir." />;
  }

  const t = ticket.data;

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    try {
      await addComment.mutateAsync({ body: body.trim(), isInternal });
      setBody('');
      setIsInternal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/tickets" className="text-sm text-blue-600 hover:underline">
        ← Taleplere dön
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-400">#{t.number}</span>
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
              {t.category && <CategoryBadge name={t.category.name} color={t.category.color} />}
            </div>

            <h1 className="text-lg font-semibold text-slate-900">{t.title}</h1>
            <p className="mt-1 text-xs text-slate-500">
              {t.org.name} · {t.createdBy.name} · {formatDateTime(t.createdAt)}
            </p>

            <p className="prose-plain mt-4 text-sm text-slate-700">{t.body}</p>

            {t.attachments.length > 0 && <AttachmentList attachments={t.attachments} />}
          </Card>

          <div className="space-y-3">
            {t.comments.map((comment) => (
              <Card
                key={comment.id}
                className={`p-4 ${comment.isInternal ? 'bg-amber-50 ring-amber-200' : ''}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className={`flex size-7 items-center justify-center rounded-full text-xs
                                font-semibold text-white ${
                                  comment.author.role === 'CUSTOMER' ? 'bg-slate-400' : 'bg-blue-600'
                                }`}
                  >
                    {initials(comment.author.name)}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{comment.author.name}</span>
                  {comment.author.role === 'CUSTOMER' ? (
                    <span className="text-xs text-slate-500">müşteri</span>
                  ) : (
                    <span className="text-xs text-slate-500">destek</span>
                  )}
                  {comment.isInternal && (
                    <span
                      className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900"
                      title="Bu not müşteriye görünmez"
                    >
                      İç not
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
                </div>

                <p className="prose-plain text-sm text-slate-700">{comment.body}</p>
                {comment.attachments.length > 0 && <AttachmentList attachments={comment.attachments} />}
              </Card>
            ))}
          </div>

          <Card className={`p-4 ${isInternal ? 'ring-amber-300' : ''}`}>
            <form onSubmit={submitComment} className="space-y-3">
              {error && <ErrorBanner message={error} />}

              <Textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={isInternal ? 'İç not (müşteri göremez)…' : 'Müşteriye yanıt yazın…'}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                    className="size-4 rounded border-slate-300"
                  />
                  İç not olarak kaydet
                  <span className="text-xs text-slate-400">(müşteriye gitmez)</span>
                </label>

                <Button type="submit" disabled={addComment.isPending || !body.trim()}>
                  {addComment.isPending ? 'Gönderiliyor…' : isInternal ? 'Notu kaydet' : 'Yanıtla'}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-slate-900">Talep yönetimi</h2>

            <LabeledSelect
              label="Durum"
              value={t.status}
              onChange={(status) => update.mutate({ status: status as TicketStatus })}
              options={Object.entries(TICKET_STATUS_LABELS)}
            />

            <LabeledSelect
              label="Öncelik"
              value={t.priority}
              onChange={(priority) => update.mutate({ priority: priority as Priority })}
              options={Object.entries(PRIORITY_LABELS)}
            />

            <LabeledSelect
              label="Atanan"
              value={t.assignedTo?.id ?? ''}
              onChange={(assignedToId) => update.mutate({ assignedToId: assignedToId || null })}
              options={[
                ['', '— atanmamış —'],
                ...(staff.data ?? []).map((s) => [s.id, s.name] as [string, string]),
              ]}
            />

            <LabeledSelect
              label="Kategori"
              value={t.category?.id ?? ''}
              onChange={(categoryId) => update.mutate({ categoryId: categoryId || null })}
              options={[
                ['', '— kategorisiz —'],
                ...(categories.data ?? []).map((c) => [c.id, c.name] as [string, string]),
              ]}
            />

            {update.isError && <ErrorBanner message="Güncelleme başarısız" />}
          </Card>

          {t.deviceInfo && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Makine bilgisi</h2>
              <p className="mb-3 text-xs text-slate-500">
                Masaüstü uygulaması tarafından, müşterinin onayıyla gönderildi.
              </p>
              <dl className="space-y-2 text-sm">
                <InfoRow label="İşletim sistemi" value={t.deviceInfo.os} />
                <InfoRow label="Bilgisayar adı" value={t.deviceInfo.hostname} />
                <InfoRow label="İşlemci" value={t.deviceInfo.cpu} />
                <InfoRow label="Bellek" value={`${Math.round(t.deviceInfo.totalMemMb / 1024)} GB`} />
                <InfoRow label="Boş disk" value={`${t.deviceInfo.freeDiskGb} GB`} />
                {t.deviceInfo.localIp && <InfoRow label="Yerel IP" value={t.deviceInfo.localIp} />}
                <InfoRow label="Uygulama sürümü" value={t.deviceInfo.appVersion} />
              </dl>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Zaman çizelgesi</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="Açılış" value={formatDateTime(t.createdAt)} />
              <InfoRow label="Son hareket" value={timeAgo(t.lastActivityAt)} />
              {t.resolvedAt && <InfoRow label="Çözüm" value={formatDateTime(t.resolvedAt)} />}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([optValue, optLabel]) => (
          <option key={optValue} value={optValue}>
            {optLabel}
          </option>
        ))}
      </Select>
    </label>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-900" title={value}>
        {value}
      </dd>
    </div>
  );
}

function AttachmentList({
  attachments,
}: {
  attachments: { id: string; filename: string; size: number; mimeType: string; downloadUrl: string }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((file) => (
        <a
          key={file.id}
          href={file.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs
                     text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
        >
          <span>{file.mimeType.startsWith('image/') ? '🖼' : '📎'}</span>
          <span className="max-w-48 truncate">{file.filename}</span>
          <span className="text-slate-400">{formatBytes(file.size)}</span>
        </a>
      ))}
    </div>
  );
}
