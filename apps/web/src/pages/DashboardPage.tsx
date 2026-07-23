import { Link } from 'react-router-dom';
import { PRIORITY_LABELS, type Priority } from '@ticket/shared';
import { useDashboardStats, useTickets } from '../lib/queries';
import { timeAgo } from '../lib/format';
import { Card, EmptyState, Spinner } from '../components/ui';
import { PriorityBadge, StatusBadge } from '../components/badges';

const PRIORITY_BAR: Record<Priority, string> = {
  LOW: 'bg-slate-400',
  NORMAL: 'bg-sky-500',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-500',
};

export function DashboardPage() {
  const stats = useDashboardStats();
  // Ataması yapılmamış talepler panelin asıl iş listesi — ilk bakışta burada görünsün.
  const unassigned = useTickets({ filter: 'unassigned' });

  if (stats.isLoading) return <Spinner />;

  const s = stats.data;
  const maxPriority = Math.max(1, ...Object.values(s?.byPriority ?? {}));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Panel</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Açık talep" value={s?.open ?? 0} tone="blue" />
        <StatCard label="İşlemde" value={s?.inProgress ?? 0} tone="amber" />
        <StatCard label="Atanmamış" value={s?.unassigned ?? 0} tone="red" />
        <StatCard label="Bugün çözülen" value={s?.resolvedToday ?? 0} tone="emerald" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Atanmamış talepler</h2>
            <Link to="/tickets?filter=unassigned" className="text-sm text-blue-600 hover:underline">
              Tümü
            </Link>
          </div>

          {unassigned.isLoading ? (
            <Spinner />
          ) : unassigned.data?.items.length ? (
            <ul className="divide-y divide-slate-100">
              {unassigned.data.items.slice(0, 8).map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    to={`/tickets/${ticket.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <span className="w-12 shrink-0 text-xs font-medium text-slate-400">
                      #{ticket.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-900">
                      {ticket.title}
                    </span>
                    <span className="hidden shrink-0 text-xs text-slate-500 sm:block">
                      {ticket.org.name}
                    </span>
                    <PriorityBadge priority={ticket.priority} />
                    <span className="w-20 shrink-0 text-right text-xs text-slate-400">
                      {timeAgo(ticket.lastActivityAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Atanmamış talep yok" description="Tüm talepler bir uzmana atanmış." />
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Öncelik dağılımı</h2>
          <div className="space-y-3">
            {(Object.keys(PRIORITY_LABELS) as Priority[]).map((priority) => {
              const count = s?.byPriority[priority] ?? 0;
              return (
                <div key={priority}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-600">{PRIORITY_LABELS[priority]}</span>
                    <span className="font-medium text-slate-900">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${PRIORITY_BAR[priority]}`}
                      style={{ width: `${(count / maxPriority) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="mt-6 mb-3 text-sm font-semibold text-slate-900">Durumlar</h2>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(s?.byStatus ?? {}).map(([status, count]) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <StatusBadge status={status as never} />
                <span className="text-xs font-medium text-slate-500">{count}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

const TONES = {
  blue: 'text-blue-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  emerald: 'text-emerald-600',
};

function StatCard({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${TONES[tone]}`}>{value}</p>
    </Card>
  );
}
