import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type Priority,
  type TicketStatus,
} from '@ticket/shared';
import { useOrganizations, useStaff, useTickets } from '../lib/queries';
import { useAuth } from '../lib/auth';
import { timeAgo } from '../lib/format';
import { Card, EmptyState, Input, Select, Spinner } from '../components/ui';
import { CategoryBadge, PriorityBadge, StatusBadge } from '../components/badges';

export function TicketsPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [search, setSearch] = useState(params.get('q') ?? '');

  const filters = {
    status: params.get('status') ? [params.get('status') as TicketStatus] : undefined,
    priority: params.get('priority') ? [params.get('priority') as Priority] : undefined,
    orgId: params.get('orgId') ?? undefined,
    assignedToId: params.get('assignedToId') ?? undefined,
    filter: (params.get('filter') as 'unassigned' | 'mine' | undefined) ?? undefined,
    q: params.get('q') ?? undefined,
  };

  const tickets = useTickets(filters);
  const orgs = useOrganizations();
  const staff = useStaff();

  function setParam(key: string, value: string): void {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Talepler</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setParam('filter', filters.filter === 'unassigned' ? '' : 'unassigned')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
              filters.filter === 'unassigned'
                ? 'bg-blue-50 text-blue-700 ring-blue-200'
                : 'bg-white text-slate-600 ring-slate-300'
            }`}
          >
            Atanmamış
          </button>
          <button
            onClick={() => {
              const next = new URLSearchParams(params);
              if (filters.assignedToId === user?.id) next.delete('assignedToId');
              else next.set('assignedToId', user?.id ?? '');
              setParams(next);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
              filters.assignedToId === user?.id
                ? 'bg-blue-50 text-blue-700 ring-blue-200'
                : 'bg-white text-slate-600 ring-slate-300'
            }`}
          >
            Bana atananlar
          </button>
        </div>
      </div>

      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <form
            className="lg:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              setParam('q', search.trim());
            }}
          >
            <Input
              placeholder="Başlık, açıklama veya #numara ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <Select value={params.get('status') ?? ''} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">Tüm durumlar</option>
            {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select
            value={params.get('priority') ?? ''}
            onChange={(e) => setParam('priority', e.target.value)}
          >
            <option value="">Tüm öncelikler</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select value={params.get('orgId') ?? ''} onChange={(e) => setParam('orgId', e.target.value)}>
            <option value="">Tüm firmalar</option>
            {orgs.data?.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {tickets.isLoading ? (
          <Spinner />
        ) : tickets.data?.items.length ? (
          <ul className="divide-y divide-slate-100">
            {tickets.data.items.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/tickets/${ticket.id}`} className="block px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-12 shrink-0 text-xs font-medium text-slate-400">
                      #{ticket.number}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{ticket.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{ticket.org.name}</span>
                        <span>·</span>
                        <span>{ticket.createdBy.name}</span>
                        {ticket.commentCount > 0 && (
                          <>
                            <span>·</span>
                            <span>{ticket.commentCount} yanıt</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {ticket.category && (
                        <CategoryBadge name={ticket.category.name} color={ticket.category.color} />
                      )}
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                    </div>

                    <div className="w-24 shrink-0 text-right">
                      <p className="text-xs text-slate-400">{timeAgo(ticket.lastActivityAt)}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {ticket.assignedTo?.name ?? '— atanmamış'}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="Talep bulunamadı"
            description="Filtreleri değiştirmeyi veya aramayı temizlemeyi deneyin."
          />
        )}
      </Card>

      {staff.data && staff.data.length === 0 && (
        <p className="text-xs text-slate-500">
          Henüz destek uzmanı yok — Ayarlar sayfasından ekip üyesi ekleyebilirsiniz.
        </p>
      )}
    </div>
  );
}
