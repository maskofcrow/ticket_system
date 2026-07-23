import { z } from 'zod';
import { prioritySchema, ticketStatusSchema } from './enums.js';
import { paginationQuerySchema } from './common.js';

/**
 * Masaüstü uygulamanın topladığı makine bilgisi.
 * Kullanıcıya gönderilmeden önce gösterilir ve onay kutusuyla eklenir.
 */
export const deviceInfoSchema = z.object({
  os: z.string().max(200),
  hostname: z.string().max(200),
  cpu: z.string().max(200),
  totalMemMb: z.number().int().nonnegative(),
  freeDiskGb: z.number().int().nonnegative(),
  localIp: z.string().max(60).nullable().optional(),
  appVersion: z.string().max(40),
});
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;

export const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['CUSTOMER', 'AGENT', 'ADMIN']),
});

/**
 * Ticket/yorum oluştururken iliştirilen dosya referansı.
 * `storageKey` presign cevabından gelir; `filename` istemcideki orijinal addır —
 * storage anahtarı sunucuda uuid ile üretildiği için orijinal adı istemci taşır.
 */
export const attachmentRefSchema = z.object({
  storageKey: z.string().min(1).max(400),
  filename: z.string().trim().min(1).max(255),
});
export type AttachmentRef = z.infer<typeof attachmentRefSchema>;

export const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  createdAt: z.string(),
  /** Kısa ömürlü presigned indirme adresi — yanıt üretilirken oluşturulur. */
  downloadUrl: z.string(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const commentSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  author: authorSchema,
  body: z.string(),
  /** true ise sadece AGENT/ADMIN görebilir. Müşteri sorgularında hiç dönmez. */
  isInternal: z.boolean(),
  attachments: z.array(attachmentSchema),
  createdAt: z.string(),
});
export type Comment = z.infer<typeof commentSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

/** Listede gösterilen özet — yorumları ve ekleri içermez. */
export const ticketSummarySchema = z.object({
  id: z.string(),
  number: z.number().int(),
  title: z.string(),
  status: ticketStatusSchema,
  priority: prioritySchema,
  category: categorySchema.nullable(),
  org: z.object({ id: z.string(), name: z.string() }),
  createdBy: authorSchema,
  assignedTo: authorSchema.nullable(),
  commentCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivityAt: z.string(),
});
export type TicketSummary = z.infer<typeof ticketSummarySchema>;

export const ticketDetailSchema = ticketSummarySchema.extend({
  body: z.string(),
  comments: z.array(commentSchema),
  attachments: z.array(attachmentSchema),
  deviceInfo: deviceInfoSchema.nullable(),
  resolvedAt: z.string().nullable(),
});
export type TicketDetail = z.infer<typeof ticketDetailSchema>;

export const createTicketSchema = z.object({
  /**
   * Sadece destek ekibi kullanır: müşteri adına ticket açarken hangi firma
   * olduğunu belirtir. Müşteri isteklerinde yok sayılır, kendi firması kullanılır.
   */
  orgId: z.string().optional(),
  title: z.string().trim().min(3, 'Başlık en az 3 karakter olmalı').max(200),
  body: z.string().trim().min(10, 'Açıklama en az 10 karakter olmalı').max(20000),
  priority: prioritySchema.default('NORMAL'),
  categoryId: z.string().nullable().optional(),
  deviceInfo: deviceInfoSchema.nullable().optional(),
  /** Önceden presign ile yüklenmiş dosyalar. */
  attachments: z.array(attachmentRefSchema).max(10).optional(),
});
export type CreateTicketRequest = z.infer<typeof createTicketSchema>;

/**
 * Alanların hepsi opsiyonel; yetki kontrolü sunucuda yapılır.
 * Müşteri sadece `status: CLOSED` gönderebilir (bkz. CUSTOMER_ALLOWED_STATUSES).
 */
export const updateTicketSchema = z
  .object({
    status: ticketStatusSchema.optional(),
    priority: prioritySchema.optional(),
    assignedToId: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'En az bir alan gönderilmeli');
export type UpdateTicketRequest = z.infer<typeof updateTicketSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Mesaj boş olamaz').max(20000),
  isInternal: z.boolean().default(false),
  attachments: z.array(attachmentRefSchema).max(10).optional(),
});
export type CreateCommentRequest = z.infer<typeof createCommentSchema>;

export const ticketListQuerySchema = paginationQuerySchema.extend({
  status: z.union([ticketStatusSchema, z.array(ticketStatusSchema)]).optional(),
  priority: z.union([prioritySchema, z.array(prioritySchema)]).optional(),
  orgId: z.string().optional(),
  assignedToId: z.string().optional(),
  categoryId: z.string().optional(),
  /** "unassigned" özel değeri: ataması yapılmamış ticket'lar. */
  filter: z.enum(['unassigned', 'mine', 'all']).optional(),
  q: z.string().trim().max(200).optional(),
});
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

export const dashboardStatsSchema = z.object({
  open: z.number().int(),
  inProgress: z.number().int(),
  unassigned: z.number().int(),
  resolvedToday: z.number().int(),
  byPriority: z.record(prioritySchema, z.number().int()),
  byStatus: z.record(ticketStatusSchema, z.number().int()),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
