import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  categorySchema,
  createCategorySchema,
  errorResponseSchema,
  idParamSchema,
  okResponseSchema,
} from '@ticket/shared';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';

export const categoryRoutes: FastifyPluginAsyncZod = async (app) => {
  // Listeleme herkese açık (müşteri de ticket açarken kategori seçiyor).
  app.get(
    '/',
    {
      preHandler: app.auth,
      schema: {
        tags: ['categories'],
        summary: 'Kategori listesi',
        response: { 200: z.array(categorySchema) },
      },
    },
    async () => {
      const rows = await prisma.category.findMany({ orderBy: { name: 'asc' } });
      return rows.map((c) => ({ id: c.id, name: c.name, color: c.color }));
    },
  );

  app.post(
    '/',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['categories'],
        summary: 'Kategori oluştur',
        body: createCategorySchema,
        response: { 201: categorySchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const existing = await prisma.category.findFirst({
        where: { name: { equals: request.body.name, mode: 'insensitive' } },
      });
      if (existing) throw conflict('Bu kategori zaten var', { name: 'Kategori adı kullanılıyor' });

      const category = await prisma.category.create({ data: request.body });
      return reply.status(201).send(category);
    },
  );

  app.delete(
    '/:id',
    {
      preHandler: app.requireRole('ADMIN'),
      schema: {
        tags: ['categories'],
        summary: 'Kategori sil',
        description: "Kategoriye bağlı ticket'lar silinmez, kategorisiz kalır.",
        params: idParamSchema,
        response: { 200: okResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const existing = await prisma.category.findUnique({ where: { id: request.params.id } });
      if (!existing) throw notFound('Kategori bulunamadı');

      await prisma.category.delete({ where: { id: existing.id } });
      return { ok: true as const };
    },
  );
};
