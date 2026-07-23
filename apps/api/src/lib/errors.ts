import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { isProduction } from '../env.js';

/** Bilinen, istemciye gösterilebilir hatalar. Beklenmeyenler 500'e düşer. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, 'BAD_REQUEST', message, fields);

export const unauthorized = (message = 'Oturum açmanız gerekiyor') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Bu işlem için yetkiniz yok') =>
  new AppError(403, 'FORBIDDEN', message);

/**
 * Yetkisiz erişimde bilinçli olarak 404 dönüyoruz: başka firmanın ticket'ı için
 * 403 dönmek, o ticket'ın var olduğunu sızdırır.
 */
export const notFound = (message = 'Kayıt bulunamadı') => new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, fields?: Record<string, string>) =>
  new AppError(409, 'CONFLICT', message, fields);

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, fields: error.fields },
      });
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const fields: Record<string, string> = {};
      for (const issue of error.validation) {
        const key = issue.params.issue.path.join('.') || '_';
        fields[key] ??= issue.params.issue.message;
      }
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Gönderilen veriler geçersiz', fields },
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Gönderilen veriler geçersiz',
          fields: zodFields(error),
        },
      });
    }

    // Cevap şeması tutmuyorsa bu bizim hatamız — istemciye sızdırmadan logla.
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, url: request.url }, 'Cevap şeması uyuşmadı');
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Sunucu hatası' },
      });
    }

    // Yukarıdaki tip korumaları `error`'ı daralttığı için buradan itibaren
    // Fastify'ın hata şekline geri açıyoruz.
    const fastifyError = error as FastifyError;

    if (fastifyError.statusCode === 429) {
      return reply.status(429).send({
        error: { code: 'RATE_LIMITED', message: 'Çok fazla istek gönderdiniz, biraz bekleyin' },
      });
    }

    request.log.error({ err: fastifyError, url: request.url }, 'Beklenmeyen hata');
    const status =
      fastifyError.statusCode && fastifyError.statusCode < 500 ? fastifyError.statusCode : 500;

    return reply.status(status).send({
      error: {
        code: 'INTERNAL_ERROR',
        // Üretimde iç hata mesajları sızmasın; geliştirmede tanı için gösterilir.
        message: isProduction ? 'Sunucu hatası' : fastifyError.message,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: { code: 'NOT_FOUND', message: `${request.method} ${request.url} bulunamadı` },
    });
  });
}
