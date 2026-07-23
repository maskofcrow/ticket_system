import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  activateRequestSchema,
  authResponseSchema,
  errorResponseSchema,
  loginRequestSchema,
  okResponseSchema,
  refreshRequestSchema,
  sessionUserSchema,
} from '@ticket/shared';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { licenseLookupHash, verifyLicenseKey } from '../../lib/license.js';
import { revokeRefreshToken, rotateRefreshToken } from '../../lib/tokens.js';
import { conflict, forbidden, unauthorized } from '../../lib/errors.js';
import { strictRateLimit } from '../../lib/rate-limit.js';
import { buildAuthResponse, toSessionUser } from './service.js';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Masaüstü uygulamanın ilk açılışı: firma lisans anahtarıyla müşteri hesabı
   * oluşturur ve doğrudan oturum açar.
   */
  app.post(
    '/activate',
    {
      config: strictRateLimit,
      schema: {
        tags: ['auth'],
        summary: 'Lisans anahtarı ile müşteri hesabı oluştur',
        body: activateRequestSchema,
        response: { 200: authResponseSchema, 400: errorResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const { licenseKey, email, name, password } = request.body;

      // Deterministik lookup hash'i ile tek indeksli sorgu; ardından argon2 doğrulaması.
      const org = await prisma.organization.findUnique({
        where: { licenseLookup: licenseLookupHash(licenseKey) },
      });

      // Anahtar bulunamadı ile anahtar yanlış aynı hatayı döner — hangi
      // anahtarların var olduğu bilgisini sızdırmamak için.
      if (!org || !(await verifyLicenseKey(org.licenseKeyHash, licenseKey))) {
        throw unauthorized('Lisans anahtarı geçersiz');
      }
      if (!org.isActive) {
        throw forbidden('Firmanızın erişimi devre dışı bırakılmış, IT ekibiyle görüşün');
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw conflict('Bu e-posta adresi zaten kayıtlı, giriş yapmayı deneyin', {
          email: 'Bu e-posta zaten kayıtlı',
        });
      }

      const seatsUsed = await prisma.user.count({ where: { orgId: org.id, isActive: true } });
      if (seatsUsed >= org.seatLimit) {
        throw forbidden('Firmanızın kullanıcı limiti dolmuş, IT ekibiyle görüşün');
      }

      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: await hashPassword(password),
          role: 'CUSTOMER',
          orgId: org.id,
          lastLoginAt: new Date(),
        },
        include: { organization: true },
      });

      return buildAuthResponse(user, { userAgent: request.headers['user-agent'] });
    },
  );

  app.post(
    '/login',
    {
      config: strictRateLimit,
      schema: {
        tags: ['auth'],
        summary: 'E-posta ve şifre ile giriş',
        body: loginRequestSchema,
        response: { 200: authResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const { email, password } = request.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: { organization: true },
      });

      // Kullanıcı yoksa da argon2 doğrulaması çalıştırılır: aksi halde cevap
      // süresi farkından hangi e-postaların kayıtlı olduğu anlaşılabilir.
      const passwordOk = user
        ? await verifyPassword(user.passwordHash, password)
        : await verifyPassword(DUMMY_HASH, password);

      if (!user || !passwordOk) {
        throw unauthorized('E-posta veya şifre hatalı');
      }
      if (!user.isActive) {
        throw forbidden('Hesabınız devre dışı bırakılmış');
      }
      if (user.organization && !user.organization.isActive) {
        throw forbidden('Firmanızın erişimi devre dışı bırakılmış');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      return buildAuthResponse(user, { userAgent: request.headers['user-agent'] });
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Access token yenile (refresh token rotasyonlu)',
        body: refreshRequestSchema,
        response: { 200: authResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const { user, refreshToken } = await rotateRefreshToken(
        request.body.refreshToken,
        request.headers['user-agent'],
      );
      return buildAuthResponse(user, { refreshToken });
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Oturumu kapat',
        body: refreshRequestSchema,
        response: { 200: okResponseSchema },
      },
    },
    async (request) => {
      await revokeRefreshToken(request.body.refreshToken);
      return { ok: true as const };
    },
  );

  app.get(
    '/me',
    {
      preHandler: app.auth,
      schema: {
        tags: ['auth'],
        summary: 'Oturumdaki kullanıcı',
        response: { 200: sessionUserSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user!.id },
        include: { organization: true },
      });
      if (!user || !user.isActive) throw unauthorized();
      return toSessionUser(user);
    },
  );
};

/**
 * Var olmayan kullanıcı için de doğrulama yapılabilsin diye sabit bir hash.
 * Değeri önemsiz — hiçbir şifreyle eşleşmemesi yeterli.
 */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0Zq3vJ0RJZ0Yv3nJ0F0Y0Zq3vJ0RJZ0Yv3nJ0F0Y0Zo';
