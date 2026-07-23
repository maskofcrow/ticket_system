import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CLOSED_STATUSES,
  TICKET_STATUS_LABELS,
  type AttachmentRef,
  type TicketDetail,
} from '@ticket/shared';
import { apiFetch, ApiError } from '../lib/api';
import { screenshotFilename, uploadFile } from '../lib/upload';
import { Button, Card, ErrorBanner, Spinner, Textarea } from '../components/ui';

export function TicketDetailScreen({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => apiFetch<TicketDetail>(`/tickets/${ticketId}`),
  });

  const [body, setBody] = useState('');
  const [pending, setPending] = useState<{ id: string; blob: Blob; previewUrl: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reply = useMutation({
    mutationFn: async () => {
      const uploaded: AttachmentRef[] = [];
      for (const item of pending) {
        uploaded.push(await uploadFile(item.blob, screenshotFilename()));
      }
      return apiFetch(`/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: { body: body.trim(), attachments: uploaded },
      });
    },
    onSuccess: () => {
      setBody('');
      setPending([]);
      void qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  const close = useMutation({
    mutationFn: () => apiFetch(`/tickets/${ticketId}`, { method: 'PATCH', body: { status: 'CLOSED' } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });

  if (ticket.isLoading) return <Spinner />;
  if (!ticket.data) {
    return (
      <div className="p-6">
        <ErrorBanner message="Talep yüklenemedi." />
        <Button variant="secondary" className="mt-3" onClick={onBack}>
          Geri dön
        </Button>
      </div>
    );
  }

  const t = ticket.data;
  const isClosed = CLOSED_STATUSES.includes(t.status);

  function handlePaste(event: ClipboardEvent): void {
    const file = Array.from(event.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    setPending((prev) => [
      ...prev,
      { id: crypto.randomUUID(), blob: file, previewUrl: URL.createObjectURL(file) },
    ]);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await reply.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mesaj gönderilemedi');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline">
        ← Taleplerime dön
      </button>

      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <span>#{t.number}</span>
          <span>·</span>
          <span className="font-medium text-slate-700">{TICKET_STATUS_LABELS[t.status]}</span>
          {t.assignedTo && (
            <>
              <span>·</span>
              <span>İlgilenen: {t.assignedTo.name}</span>
            </>
          )}
        </div>

        <h1 className="text-lg font-semibold text-slate-900">{t.title}</h1>
        <p className="prose-plain mt-3 text-sm text-slate-700">{t.body}</p>
        {t.attachments.length > 0 && <Attachments items={t.attachments} />}
      </Card>

      {t.comments.map((comment) => {
        const fromSupport = comment.author.role !== 'CUSTOMER';
        return (
          <Card
            key={comment.id}
            className={`p-4 ${fromSupport ? 'border-l-4 border-l-blue-500' : 'ml-8'}`}
          >
            <p className="mb-1.5 text-xs">
              <span className="font-medium text-slate-900">{comment.author.name}</span>
              <span className="text-slate-500"> · {fromSupport ? 'Destek ekibi' : 'siz'}</span>
            </p>
            <p className="prose-plain text-sm text-slate-700">{comment.body}</p>
            {comment.attachments.length > 0 && <Attachments items={comment.attachments} />}
          </Card>
        );
      })}

      {isClosed ? (
        <Card className="p-4 text-center">
          <p className="text-sm text-slate-600">
            Bu talep {TICKET_STATUS_LABELS[t.status].toLocaleLowerCase('tr')} durumda.
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
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={handlePaste}
            placeholder="Mesajınızı yazın… (ekran görüntüsünü buraya yapıştırabilirsiniz)"
          />

          {pending.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pending.map((item) => (
                <div key={item.id} className="relative">
                  <img
                    src={item.previewUrl}
                    alt="ek"
                    className="h-16 w-24 rounded object-cover ring-1 ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPending((prev) => prev.filter((p) => p.id !== item.id))}
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
            {!isClosed && t.status === 'RESOLVED' ? (
              <Button
                variant="secondary"
                type="button"
                onClick={() => close.mutate()}
                disabled={close.isPending}
              >
                Sorunum çözüldü, kapat
              </Button>
            ) : (
              <span />
            )}

            <Button type="submit" disabled={reply.isPending || !body.trim()}>
              {reply.isPending ? 'Gönderiliyor…' : 'Gönder'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Attachments({
  items,
}: {
  items: { id: string; filename: string; mimeType: string; downloadUrl: string }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((file) =>
        file.mimeType.startsWith('image/') ? (
          <a key={file.id} href={file.downloadUrl} target="_blank" rel="noreferrer">
            <img
              src={file.downloadUrl}
              alt={file.filename}
              className="h-24 rounded-md object-cover ring-1 ring-slate-200"
            />
          </a>
        ) : (
          <a
            key={file.id}
            href={file.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs
                       text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
          >
            📎 <span className="max-w-48 truncate">{file.filename}</span>
          </a>
        ),
      )}
    </div>
  );
}
