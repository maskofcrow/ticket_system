import {
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type Priority,
  type TicketStatus,
} from '@ticket/shared';
import { prisma } from '../../lib/prisma.js';
import { sendMail, ticketUrl } from '../../lib/mailer.js';

interface TicketRef {
  id: string;
  number: number;
  title: string;
  orgName: string;
}

async function staffEmails(): Promise<string[]> {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['AGENT', 'ADMIN'] }, isActive: true },
    select: { email: true },
  });
  return staff.map((s) => s.email);
}

/** Yeni ticket → tüm destek ekibine haber. Küçük ekipte istenen davranış bu. */
export async function notifyTicketCreated(
  ticket: TicketRef & { priority: Priority; createdByName: string },
): Promise<void> {
  const recipients = await staffEmails();
  for (const to of recipients) {
    sendMail({
      to,
      subject: `[#${ticket.number}] Yeni destek talebi — ${ticket.title}`,
      heading: `Yeni destek talebi: #${ticket.number}`,
      lines: [
        `Firma: ${ticket.orgName}`,
        `Açan: ${ticket.createdByName}`,
        `Öncelik: ${PRIORITY_LABELS[ticket.priority]}`,
        `Konu: ${ticket.title}`,
      ],
      actionLabel: 'Talebi aç',
      actionUrl: ticketUrl(ticket.id),
    });
  }
}

/**
 * Yeni yorum bildirimi. İç notlar müşteriye gitmez; yönü yazan kişinin
 * rolüne göre belirlenir.
 */
export async function notifyCommentCreated(args: {
  ticket: TicketRef & { createdById: string; assignedToId: string | null };
  authorId: string;
  authorName: string;
  authorIsStaff: boolean;
  isInternal: boolean;
  body: string;
}): Promise<void> {
  const { ticket, authorIsStaff, isInternal } = args;

  if (isInternal) return; // iç not: kimseye mail gitmez

  const preview = args.body.length > 300 ? `${args.body.slice(0, 300)}…` : args.body;

  if (authorIsStaff) {
    // Destek yanıtladı → talebi açan müşteriye.
    const customer = await prisma.user.findUnique({
      where: { id: ticket.createdById },
      select: { email: true, isActive: true },
    });
    if (!customer?.isActive) return;

    sendMail({
      to: customer.email,
      subject: `[#${ticket.number}] Talebinize yanıt verildi`,
      heading: `#${ticket.number} — ${ticket.title}`,
      lines: [`${args.authorName} yanıtladı:`, preview],
      actionLabel: 'Talebi görüntüle',
      actionUrl: ticketUrl(ticket.id),
    });
    return;
  }

  // Müşteri yazdı → atanan uzmana, atama yoksa tüm ekibe.
  const recipients = ticket.assignedToId
    ? await prisma.user
        .findUnique({ where: { id: ticket.assignedToId }, select: { email: true, isActive: true } })
        .then((u) => (u?.isActive ? [u.email] : []))
    : await staffEmails();

  for (const to of recipients) {
    sendMail({
      to,
      subject: `[#${ticket.number}] Müşteri yanıtı — ${ticket.title}`,
      heading: `#${ticket.number} — ${ticket.title}`,
      lines: [`Firma: ${ticket.orgName}`, `${args.authorName} yazdı:`, preview],
      actionLabel: 'Talebi aç',
      actionUrl: ticketUrl(ticket.id),
    });
  }
}

export async function notifyStatusChanged(
  ticket: TicketRef & { createdById: string },
  status: TicketStatus,
): Promise<void> {
  const customer = await prisma.user.findUnique({
    where: { id: ticket.createdById },
    select: { email: true, isActive: true },
  });
  if (!customer?.isActive) return;

  sendMail({
    to: customer.email,
    subject: `[#${ticket.number}] Durum: ${TICKET_STATUS_LABELS[status]}`,
    heading: `#${ticket.number} — ${ticket.title}`,
    lines: [`Talebinizin durumu "${TICKET_STATUS_LABELS[status]}" olarak güncellendi.`],
    actionLabel: 'Talebi görüntüle',
    actionUrl: ticketUrl(ticket.id),
  });
}

export async function notifyAssigned(ticket: TicketRef, assigneeId: string): Promise<void> {
  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { email: true, isActive: true },
  });
  if (!assignee?.isActive) return;

  sendMail({
    to: assignee.email,
    subject: `[#${ticket.number}] Size atandı — ${ticket.title}`,
    heading: `Size yeni bir talep atandı: #${ticket.number}`,
    lines: [`Firma: ${ticket.orgName}`, `Konu: ${ticket.title}`],
    actionLabel: 'Talebi aç',
    actionUrl: ticketUrl(ticket.id),
  });
}
