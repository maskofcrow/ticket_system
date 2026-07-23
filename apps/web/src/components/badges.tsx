import {
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type Priority,
  type TicketStatus,
} from '@ticket/shared';

const STATUS_STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  WAITING_CUSTOMER: 'bg-purple-100 text-purple-800 ring-purple-600/20',
  RESOLVED: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  NORMAL: 'bg-sky-100 text-sky-800 ring-sky-600/20',
  HIGH: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  URGENT: 'bg-red-100 text-red-800 ring-red-600/20',
};

const base = 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${base} ${STATUS_STYLES[status]}`}>{TICKET_STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`${base} ${PRIORITY_STYLES[priority]}`}>
      {priority === 'URGENT' && <span className="mr-1">●</span>}
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-0.5 text-xs
                 font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
    >
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
