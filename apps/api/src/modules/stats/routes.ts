import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Prisma } from '@prisma/client';
import {
  dashboardStatsSchema,
  prioritySchema,
  ticketStatusSchema,
  type Priority,
  type TicketStatus,
} from '@ticket/shared';
import { prisma } from '../../lib/prisma.js';
import { isStaff, requireUser } from '../../plugins/auth.js';

export const statsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.auth);

  app.get(
    '/dashboard',
    {
      schema: {
        tags: ['stats'],
        summary: 'Panel özeti',
        description: 'Müşteri için kendi firmasının, destek ekibi için tüm sistemin özeti.',
        response: { 200: dashboardStatsSchema },
      },
    },
    async (request) => {
      const user = requireUser(request);
      const scope: Prisma.TicketWhereInput = isStaff(user) ? {} : { orgId: user.orgId ?? ' ' };

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // groupBy ile tek sorguda dağılım — durum/öncelik başına ayrı count atmıyoruz.
      const [byStatusRows, byPriorityRows, unassigned, resolvedToday] = await Promise.all([
        prisma.ticket.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
        prisma.ticket.groupBy({ by: ['priority'], where: scope, _count: { _all: true } }),
        prisma.ticket.count({
          where: { ...scope, assignedToId: null, status: { notIn: ['RESOLVED', 'CLOSED'] } },
        }),
        prisma.ticket.count({ where: { ...scope, resolvedAt: { gte: startOfDay } } }),
      ]);

      // Cevap şeması tüm enum anahtarlarını bekliyor: hiç ticket'ı olmayan
      // durum/öncelik de 0 olarak dönmeli, eksik anahtar serileştirmeyi düşürür.
      const byStatus = zeroFilled(ticketStatusSchema.options) as Record<TicketStatus, number>;
      for (const row of byStatusRows) byStatus[row.status] = row._count._all;

      const byPriority = zeroFilled(prioritySchema.options) as Record<Priority, number>;
      for (const row of byPriorityRows) byPriority[row.priority] = row._count._all;

      return {
        open: byStatus.OPEN,
        inProgress: byStatus.IN_PROGRESS,
        unassigned,
        resolvedToday,
        byPriority,
        byStatus,
      };
    },
  );
};

function zeroFilled(keys: readonly string[]): Record<string, number> {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}
