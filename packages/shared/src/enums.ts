import { z } from 'zod';

export const roleSchema = z.enum(['CUSTOMER', 'AGENT', 'ADMIN']);
export type Role = z.infer<typeof roleSchema>;

export const ticketStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const prioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
export type Priority = z.infer<typeof prioritySchema>;

/** Arayüzde gösterilecek Türkçe etiketler — web ve masaüstü aynısını kullanır. */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'İşlemde',
  WAITING_CUSTOMER: 'Müşteri bekleniyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapalı',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
};

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Müşteri',
  AGENT: 'Destek uzmanı',
  ADMIN: 'Yönetici',
};

/** Müşterinin kendi ticket'ında yapabileceği durum değişiklikleri. */
export const CUSTOMER_ALLOWED_STATUSES: TicketStatus[] = ['CLOSED'];

/** Ticket'ın "kapanmış" sayıldığı durumlar — istatistik ve filtrelerde kullanılır. */
export const CLOSED_STATUSES: TicketStatus[] = ['RESOLVED', 'CLOSED'];
