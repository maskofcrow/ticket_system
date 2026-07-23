import type { Prisma } from '@prisma/client';
import type { Attachment, Comment, TicketDetail, TicketSummary } from '@ticket/shared';
import { presignDownload } from '../../lib/storage.js';

/** Liste görünümü için gereken ilişkiler. Yorumlar ve ekler yüklenmez. */
export const ticketSummaryInclude = {
  organization: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  assignedTo: { select: { id: true, name: true, role: true } },
  category: true,
} satisfies Prisma.TicketInclude;

/**
 * Yorum sayısı müşteri için iç notlar hariç sayılır — aksi halde "3 yorum var
 * ama 2 tanesini göremiyorum" durumu gizli aktiviteyi ele verirdi.
 * Şeklin sabit kalması için filtre `where` içinde değişiyor: boş nesne hepsini sayar.
 */
export function ticketCountInclude(canSeeInternal: boolean) {
  return {
    _count: {
      select: {
        comments: { where: canSeeInternal ? {} : { isInternal: false } },
      },
    },
  } satisfies Prisma.TicketInclude;
}

/** Müşteri sorgularında iç notlar WHERE ile elenir — cevap katmanında değil. */
export function commentVisibilityWhere(canSeeInternal: boolean): Prisma.CommentWhereInput {
  return canSeeInternal ? {} : { isInternal: false };
}

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketSummaryInclude }> & {
  _count?: { comments: number };
};

export function toTicketSummary(ticket: TicketWithRelations): TicketSummary {
  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category
      ? { id: ticket.category.id, name: ticket.category.name, color: ticket.category.color }
      : null,
    org: { id: ticket.organization.id, name: ticket.organization.name },
    createdBy: ticket.createdBy,
    assignedTo: ticket.assignedTo,
    commentCount: ticket._count?.comments ?? 0,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    lastActivityAt: ticket.lastActivityAt.toISOString(),
  };
}

type AttachmentRow = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
};

/**
 * İndirme adresleri kısa ömürlü presigned URL'ler. Bucket public olmadığı için
 * ekleri görebilmenin tek yolu bu — ve adres 15 dk sonra ölür.
 */
export async function toAttachments(rows: AttachmentRow[]): Promise<Attachment[]> {
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt.toISOString(),
      downloadUrl: await presignDownload(row.storageKey, row.filename),
    })),
  );
}

type CommentRow = {
  id: string;
  ticketId: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  author: { id: string; name: string; role: 'CUSTOMER' | 'AGENT' | 'ADMIN' };
  attachments: AttachmentRow[];
};

export async function toComment(row: CommentRow): Promise<Comment> {
  return {
    id: row.id,
    ticketId: row.ticketId,
    author: row.author,
    body: row.body,
    isInternal: row.isInternal,
    attachments: await toAttachments(row.attachments),
    createdAt: row.createdAt.toISOString(),
  };
}

type TicketDetailRow = TicketWithRelations & {
  body: string;
  resolvedAt: Date | null;
  comments: CommentRow[];
  attachments: AttachmentRow[];
  deviceInfo: {
    os: string;
    hostname: string;
    cpu: string;
    totalMemMb: number;
    freeDiskGb: number;
    localIp: string | null;
    appVersion: string;
  } | null;
};

export async function toTicketDetail(ticket: TicketDetailRow): Promise<TicketDetail> {
  const [comments, attachments] = await Promise.all([
    Promise.all(ticket.comments.map(toComment)),
    // Ticket'ın kendi ekleri = yorumlara bağlı olmayanlar.
    toAttachments(ticket.attachments),
  ]);

  return {
    ...toTicketSummary(ticket),
    body: ticket.body,
    comments,
    attachments,
    deviceInfo: ticket.deviceInfo,
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
  };
}
