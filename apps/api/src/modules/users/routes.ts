import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Organization, User as UserRow } from '@prisma/client';
import {
  createStaffSchema,
  errorResponseSchema,
  idParamSchema,
  updateUserSchema,
  userListQuerySchema,
  userSchema,
  type User,
} from '@ticket/shared';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { hashPassword } from '../../lib/password.js';
import { revokeAllUserTokens } from '../../lib/tokens.js';

function toUser(row: UserRow & { organization: Organization | null }): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    orgId: row.orgId,
    orgName: row.organization?.name ?? null,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Listeleme AGENT'a da açık: ticket atarken ekip üyelerini görmesi gerekiyor.
   * Değişiklik uçları ADMIN'e kapalı tutuluyor (aşağıda tek tek).
   */
  app.get(
    '/',
    {
      preHandler: app.requireRole('AGENT', 'ADMIN'),
      schema: {
        tags: ['users'],
        summary: 'Kullanıcı listesi',
        querystring: userListQuerySchema,
        response: { 200: z.array(userSchema) },
      },
    },
    async (request) => {
      const rows = await prisma.user.findMany({
        where: {
          role: request.query.role,
          orgId: request.query.orgId,
          isActive: request.query.isActive,
        },
        include: { organization: true },
        orderBy: [{ role: 'asc' }, { name: 'asc' }],
      });
      return rows.map(toUser);
    },
  );

  app.post(
    '/',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['users'],
        summary: 'Ekip üyesi (AGENT/ADMIN) oluştur',
        description: 'Müşteri hesapları buradan açılmaz — onlar lisans anahtarıyla kendileri kaydolur.',
        body: createStaffSchema,
        response: { 201: userSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const { email, name, password, role } = request.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        throw conflict('Bu e-posta zaten kayıtlı', { email: 'E-posta kullanılıyor' });
      }

      const user = await prisma.user.create({
        data: { email, name, role, passwordHash: await hashPassword(password) },
        include: { organization: true },
      });

      await prisma.auditLog.create({
        data: {
          actorId: request.user!.id,
          action: 'user.create',
          targetId: user.id,
          meta: { role },
        },
      });

      return reply.status(201).send(toUser(user));
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['users'],
        summary: 'Kullanıcı güncelle',
        params: idParamSchema,
        body: updateUserSchema,
        response: { 200: userSchema, 400: errorResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const actorId = request.user!.id;
      const target = await prisma.user.findUnique({ where: { id: request.params.id } });
      if (!target) throw notFound('Kullanıcı bulunamadı');

      // Yöneticinin kendini kilitlemesini engelle.
      if (target.id === actorId) {
        if (request.body.isActive === false) throw badRequest('Kendi hesabınızı devre dışı bırakamazsınız');
        if (request.body.role && request.body.role !== 'ADMIN') {
          throw badRequest('Kendi yönetici yetkinizi kaldıramazsınız');
        }
      }

      // Müşteri hesabı ekip rolüne terfi ettirilemez: orgId'si dolu bir AGENT
      // yetkilendirme mantığında tanımsız bir durum yaratırdı.
      if (request.body.role && request.body.role !== 'CUSTOMER' && target.orgId) {
        throw forbidden('Müşteri hesapları ekip üyesi yapılamaz');
      }

      const user = await prisma.user.update({
        where: { id: target.id },
        data: {
          name: request.body.name,
          role: request.body.role,
          isActive: request.body.isActive,
          ...(request.body.password ? { passwordHash: await hashPassword(request.body.password) } : {}),
        },
        include: { organization: true },
      });

      // Şifre değişimi ve pasifleştirme mevcut oturumları geçersiz kılar.
      if (request.body.password || request.body.isActive === false) {
        await revokeAllUserTokens(user.id);
      }

      return toUser(user);
    },
  );
};
