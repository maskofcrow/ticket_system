import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { errorResponseSchema, presignRequestSchema, presignResponseSchema } from '@ticket/shared';
import { env } from '../../env.js';
import { badRequest } from '../../lib/errors.js';
import { uploadRateLimit } from '../../lib/rate-limit.js';
import {
  buildStorageKey,
  presignUpload,
  uploadScopeId,
  UPLOAD_URL_TTL_SECONDS,
} from '../../lib/storage.js';
import { requireUser } from '../../plugins/auth.js';

export const uploadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.auth);

  /**
   * Dosya API üzerinden geçmez: istemci presigned URL'e doğrudan PUT eder.
   * Böylece 25 MB'lık ekran görüntüleri API sürecini meşgul etmez.
   *
   * Buradaki boyut/tip kontrolü ilk savunma hattı; asıl doğrulama ek kaydı
   * oluşturulurken S3'ün bildirdiği gerçek değerler üzerinden yapılır
   * (bkz. modules/tickets/attachments.ts).
   */
  app.post(
    '/presign',
    {
      config: uploadRateLimit,
      schema: {
        tags: ['uploads'],
        summary: 'Dosya yükleme adresi al',
        body: presignRequestSchema,
        response: { 200: presignResponseSchema, 400: errorResponseSchema },
      },
    },
    async (request) => {
      const user = requireUser(request);
      const { filename, mimeType, size } = request.body;

      const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
      if (size > maxBytes) {
        throw badRequest(`Dosya boyutu en fazla ${env.MAX_UPLOAD_MB} MB olabilir`);
      }

      // Destek ekibinin kendi firması olmadığı için ekleri ortak "staff"
      // alanına yazılır; ek doğrulaması da aynı hesabı kullanır.
      const storageKey = buildStorageKey(uploadScopeId(user), filename);

      return {
        uploadUrl: await presignUpload(storageKey, mimeType),
        storageKey,
        expiresIn: UPLOAD_URL_TTL_SECONDS,
      };
    },
  );
};
