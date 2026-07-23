import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Organization as OrgRow } from '@prisma/client';
import {
  createOrgSchema,
  errorResponseSchema,
  idParamSchema,
  licenseKeyResponseSchema,
  organizationSchema,
  updateOrgSchema,
  type Organization,
} from '@ticket/shared';
import { prisma } from '../../lib/prisma.js';
import { conflict, notFound } from '../../lib/errors.js';
import { issueLicenseKey } from '../../lib/license.js';
import { revokeAllOrgTokens } from '../../lib/tokens.js';

type Counts = { seatsUsed: number; ticketCount: number };

function toOrganization(org: OrgRow, counts: Counts): Organization {
  return {
    id: org.id,
    name: org.name,
    licenseSuffix: org.licenseSuffix,
    seatLimit: org.seatLimit,
    seatsUsed: counts.seatsUsed,
    isActive: org.isActive,
    ticketCount: counts.ticketCount,
    contactEmail: org.contactEmail,
    notes: org.notes,
    createdAt: org.createdAt.toISOString(),
  };
}

export const orgRoutes: FastifyPluginAsyncZod = async (app) => {
  // Firma ve lisans yönetimi tamamen ADMIN yetkisinde.
  app.addHook('preHandler', app.requireRole('ADMIN'));

  app.get(
    '/',
    {
      schema: {
        tags: ['orgs'],
        summary: 'Firma listesi',
        response: { 200: z.array(organizationSchema) },
      },
    },
    async () => {
      const orgs = await prisma.organization.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { tickets: true, users: { where: { isActive: true } } } },
        },
      });

      return orgs.map((org) =>
        toOrganization(org, { seatsUsed: org._count.users, ticketCount: org._count.tickets }),
      );
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['orgs'],
        summary: 'Firma oluştur ve lisans anahtarı üret',
        description:
          'Ham lisans anahtarı yalnızca bu cevapta döner. Veritabanında hash olarak saklandığı için sonradan okunamaz.',
        body: createOrgSchema,
        response: { 201: licenseKeyResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const body = request.body;

      const duplicate = await prisma.organization.findFirst({
        where: { name: { equals: body.name, mode: 'insensitive' } },
      });
      if (duplicate) {
        throw conflict('Bu isimde bir firma zaten var', { name: 'Firma adı kullanılıyor' });
      }

      const license = await issueLicenseKey();

      const org = await prisma.organization.create({
        data: {
          name: body.name,
          seatLimit: body.seatLimit,
          contactEmail: body.contactEmail ?? null,
          notes: body.notes ?? null,
          licenseKeyHash: license.licenseKeyHash,
          licenseLookup: license.licenseLookup,
          licenseSuffix: license.licenseSuffix,
        },
      });

      await prisma.auditLog.create({
        data: { actorId: request.user!.id, action: 'org.create', targetId: org.id },
      });

      return reply.status(201).send({
        organization: toOrganization(org, { seatsUsed: 0, ticketCount: 0 }),
        licenseKey: license.licenseKey,
      });
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['orgs'],
        summary: 'Firma bilgilerini güncelle',
        params: idParamSchema,
        body: updateOrgSchema,
        response: { 200: organizationSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const existing = await prisma.organization.findUnique({ where: { id: request.params.id } });
      if (!existing) throw notFound('Firma bulunamadı');

      const org = await prisma.organization.update({
        where: { id: existing.id },
        data: {
          name: request.body.name,
          seatLimit: request.body.seatLimit,
          isActive: request.body.isActive,
          contactEmail: request.body.contactEmail,
          notes: request.body.notes,
        },
        include: {
          _count: { select: { tickets: true, users: { where: { isActive: true } } } },
        },
      });

      // Firma pasifleştirildiyse açık oturumlar da düşmeli — sonraki refresh
      // zaten reddedilir, ama beklemeye gerek yok.
      if (request.body.isActive === false) {
        await revokeAllOrgTokens(org.id);
      }

      return toOrganization(org, {
        seatsUsed: org._count.users,
        ticketCount: org._count.tickets,
      });
    },
  );

  app.post(
    '/:id/license/rotate',
    {
      schema: {
        tags: ['orgs'],
        summary: 'Lisans anahtarını yenile',
        description:
          'Eski anahtar geçersiz olur. Mevcut kullanıcılar etkilenmez — anahtar sadece yeni kayıtlarda kullanılır.',
        params: idParamSchema,
        response: { 200: licenseKeyResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const existing = await prisma.organization.findUnique({ where: { id: request.params.id } });
      if (!existing) throw notFound('Firma bulunamadı');

      const license = await issueLicenseKey();

      const org = await prisma.organization.update({
        where: { id: existing.id },
        data: {
          licenseKeyHash: license.licenseKeyHash,
          licenseLookup: license.licenseLookup,
          licenseSuffix: license.licenseSuffix,
        },
        include: {
          _count: { select: { tickets: true, users: { where: { isActive: true } } } },
        },
      });

      await prisma.auditLog.create({
        data: { actorId: request.user!.id, action: 'license.rotate', targetId: org.id },
      });

      return {
        organization: toOrganization(org, {
          seatsUsed: org._count.users,
          ticketCount: org._count.tickets,
        }),
        licenseKey: license.licenseKey,
      };
    },
  );
};
