import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CLOSED_STATUSES,
  TICKET_STATUS_LABELS,
  type Priority,
  type TicketStatus,
  type TicketSummary,
} from '@ticket/shared';
import { apiFetch } from '../lib/api';
import { clearBadge } from '../lib/notifications';
import { Button, Card, Spinner } from '../components/ui';

const STATUS_DOT: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-500',
  IN_PROGRESS: 'bg-amber-500',
  WAITING_CUSTOMER: 'bg-purple-500',
  RESOLVED: 'bg-emerald-500',
  CLOSED: 'bg-slate-400',
};

const PRIORITY_TEXT: Record<Priority, string> = {
  LOW: 'text-slate-500',
  NORMAL: 'text-slate-500',
  HIGH: 'text-orange-600',
  URGENT: 'text-red-600 font-medium',
};

export function TicketListScreen({
  onOpen,
  onNew,
}: {
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const tickets = useQuery({
    queryKey: ['tickets'],
    queryFn: () => apiFetch<{ items: TicketSummary[] }>('/tickets', { query: { limit: 50 } }),
  });

  // Liste görüntülenince okunmamış rozeti sıfırlanır.
  useEffect(() => clearBadge(), []);

  const items = tickets.data?.items ?? [];
  const active = items.filter((t) => !CLOSED_STATUSES.includes(t.status));
  const closed = items.filter((t) => CLOSED_STATUSES.includes(t.status));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Destek taleplerim</h1>
        <Button onClick={onNew}>+ Yeni talep</Button>
      </div>

      {tickets.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-900">Henüz talebiniz yok</p>
          <p className="mt-1 mb-5 text-sm text-slate-500">
            Bir sorun yaşadığınızda buradan destek ekibine iletebilirsiniz.
          </p>
          <Button onClick={onNew}>İlk talebinizi oluşturun</Button>
        </Card>
      ) : (
        <>
          <TicketGroup title="Açık talepler" tickets={active} onOpen={onOpen} />
          {closed.length > 0 && (
            <TicketGroup title="Kapanmış talepler" tickets={closed} onOpen={onOpen} muted />
          )}
        </>
      )}
    </div>
  );
}

function TicketGroup({
  title,
  tickets,
  onOpen,
  muted = false,
}: {
  title: string;
  tickets: TicketSummary[];
  onOpen: (id: string) => void;
  muted?: boolean;
}) {
  if (tickets.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">{title}</h2>
      <Card className={muted ? 'opacity-70' : ''}>
        <ul className="divide-y divide-slate-100">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                onClick={() => onOpen(ticket.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[ticket.status]}`} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{ticket.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    #{ticket.number} · {TICKET_STATUS_LABELS[ticket.status]}
                    {ticket.commentCount > 0 && ` · ${ticket.commentCount} yanıt`}
                    {ticket.assignedTo && ` · ${ticket.assignedTo.name}`}
                  </p>
                </div>

                <span className={`shrink-0 text-xs ${PRIORITY_TEXT[ticket.priority]}`}>
                  {ticket.priority === 'URGENT' ? 'Acil' : ticket.priority === 'HIGH' ? 'Yüksek' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
