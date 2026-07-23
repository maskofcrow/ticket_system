import { z } from 'zod';

/**
 * Ortam değişkenleri süreç başlarken bir kez doğrulanır. Eksik/yanlış bir
 * değişkenle sunucu hiç ayağa kalkmaz — çalışma anında "undefined secret" ile
 * sessizce güvensiz duruma düşmesindense erken patlaması iyi.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3000),
  API_HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET en az 32 karakter olmalı'),
  LICENSE_PEPPER: z.string().min(32, 'LICENSE_PEPPER en az 32 karakter olmalı'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  S3_ENDPOINT: z.string().url(),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('ticket-attachments'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default('IT Destek <destek@localhost>'),

  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Ortam değişkenleri hatalı:\n${issues}\n\n.env.example dosyasını .env olarak kopyalayın.`);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
