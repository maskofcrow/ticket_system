import { z } from 'zod';
import { roleSchema } from './enums.js';
import { emailSchema, passwordSchema } from './auth.js';

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Anahtarın son 4 hanesi — panelde "TCK-••••-••••-••••-B8ZW" gösterimi için. */
  licenseSuffix: z.string(),
  seatLimit: z.number().int(),
  seatsUsed: z.number().int(),
  isActive: z.boolean(),
  ticketCount: z.number().int(),
  contactEmail: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, 'Firma adı en az 2 karakter olmalı').max(160),
  seatLimit: z.number().int().min(1).max(10000).default(10),
  contactEmail: emailSchema.nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});
export type CreateOrgRequest = z.infer<typeof createOrgSchema>;

export const updateOrgSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    seatLimit: z.number().int().min(1).max(10000).optional(),
    isActive: z.boolean().optional(),
    contactEmail: emailSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'En az bir alan gönderilmeli');
export type UpdateOrgRequest = z.infer<typeof updateOrgSchema>;

/**
 * Ham lisans anahtarı SADECE bu cevapta döner (firma oluşturma ve rotate).
 * Veritabanında hash'li tutulduğu için sonradan bir daha okunamaz.
 */
export const licenseKeyResponseSchema = z.object({
  organization: organizationSchema,
  licenseKey: z.string(),
});
export type LicenseKeyResponse = z.infer<typeof licenseKeyResponseSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: roleSchema,
  orgId: z.string().nullable(),
  orgName: z.string().nullable(),
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

/** Ekip üyesi (AGENT/ADMIN) oluşturma — müşteriler lisans anahtarıyla kendileri kaydolur. */
export const createStaffSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(2).max(120),
  password: passwordSchema,
  role: z.enum(['AGENT', 'ADMIN']),
});
export type CreateStaffRequest = z.infer<typeof createStaffSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'En az bir alan gönderilmeli');
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

export const userListQuerySchema = z.object({
  role: roleSchema.optional(),
  orgId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Renk #RRGGBB formatında olmalı')
    .default('#64748b'),
});
export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;
