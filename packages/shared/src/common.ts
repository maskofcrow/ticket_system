import { z } from 'zod';

/** Tüm hata cevaplarının ortak gövdesi — istemciler tek yapı bekler. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Alan bazlı doğrulama hataları: { email: "Geçersiz adres" } */
    fields: z.record(z.string()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });

/**
 * Cursor tabanlı sayfalama. Offset yerine cursor kullanıyoruz çünkü ticket
 * listesi canlı güncelleniyor — offset'te yeni kayıt geldikçe sayfalar kayar.
 */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export const okResponseSchema = z.object({ ok: z.literal(true) });
