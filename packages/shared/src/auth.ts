import { z } from 'zod';
import { roleSchema } from './enums.js';

/**
 * Lisans anahtarı formatı: TCK-A7K2-9MRT-4XQP-B8ZW
 * Crockford Base32 alfabesi (I, L, O, U yok — okuma hatalarını önler).
 */
export const LICENSE_KEY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LICENSE_KEY_REGEX = /^TCK-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

export const licenseKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(LICENSE_KEY_REGEX, 'Lisans anahtarı formatı geçersiz (örn. TCK-A7K2-9MRT-4XQP-B8ZW)');

export const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .max(128, 'Şifre en fazla 128 karakter olabilir');

export const emailSchema = z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin');

/** Masaüstü uygulamanın ilk açılışında çalışan aktivasyon isteği. */
export const activateRequestSchema = z.object({
  licenseKey: licenseKeySchema,
  email: emailSchema,
  name: z.string().trim().min(2, 'Ad soyad en az 2 karakter olmalı').max(120),
  password: passwordSchema,
});
export type ActivateRequest = z.infer<typeof activateRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Şifre gerekli'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  orgId: z.string().nullable(),
  orgName: z.string().nullable(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Access token'ın geçerlilik süresi (saniye) — istemci yenilemeyi buna göre zamanlar. */
  expiresIn: z.number().int(),
  user: sessionUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** JWT payload'ı — API ve Socket.IO handshake'i aynı yapıyı bekler. */
export const accessTokenPayloadSchema = z.object({
  sub: z.string(),
  role: roleSchema,
  orgId: z.string().nullable(),
});
export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;
