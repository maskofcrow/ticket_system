import { z } from 'zod';

/**
 * Yüklemeye izin verilen MIME tipleri. Liste bilinçli olarak dar tutuldu:
 * IT destek ekleri pratikte ekran görüntüsü, log ve döküman oluyor.
 * Çalıştırılabilir dosyalar kabul edilmez.
 */
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const presignRequestSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: 'Bu dosya tipi desteklenmiyor' }),
  }),
  size: z.number().int().positive(),
});
export type PresignRequest = z.infer<typeof presignRequestSchema>;

export const presignResponseSchema = z.object({
  /** İstemci dosyayı doğrudan buraya PUT eder — API üzerinden geçmez. */
  uploadUrl: z.string(),
  /** Yükleme bitince ticket/yorum oluştururken bu anahtar gönderilir. */
  storageKey: z.string(),
  expiresIn: z.number().int(),
});
export type PresignResponse = z.infer<typeof presignResponseSchema>;
