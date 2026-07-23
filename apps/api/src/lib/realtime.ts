import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import {
  SOCKET_EVENTS,
  socketRooms,
  type ClientToServerEvents,
  type Comment,
  type ServerToClientEvents,
  type TicketSummary,
} from '@ticket/shared';
import { env } from '../env.js';
import { verifyAccessToken } from './tokens.js';

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function initRealtime(httpServer: HttpServer): void {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/realtime',
    cors: { origin: env.CORS_ORIGINS, credentials: true },
  });

  // Handshake'te JWT doğrulaması — HTTP tarafıyla aynı token kullanılır.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('unauthorized'));

      const payload = await verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      socket.data.orgId = payload.orgId;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { role, orgId } = socket.data as { role: string; orgId: string | null };

    // Oda ataması yalnızca token'daki role/orgId'ye göre yapılır; istemci
    // hangi odaya gireceğini söyleyemez.
    if (role === 'AGENT' || role === 'ADMIN') {
      void socket.join(socketRooms.agents());
    } else if (orgId) {
      void socket.join(socketRooms.org(orgId));
    }
  });
}

export async function closeRealtime(): Promise<void> {
  await io?.close();
  io = null;
}

/**
 * Tüm ticket olayları bu üç fonksiyondan geçer. Route'larda elle emit etmek,
 * bir yerde unutulunca sessizce canlı güncellenmeyen ekranlara yol açıyordu.
 */
export function emitTicketCreated(ticket: TicketSummary): void {
  io?.to([socketRooms.agents(), socketRooms.org(ticket.org.id)]).emit(SOCKET_EVENTS.ticketCreated, {
    ticket,
  });
}

export function emitTicketUpdated(ticket: TicketSummary, changed: string[]): void {
  io?.to([socketRooms.agents(), socketRooms.org(ticket.org.id)]).emit(SOCKET_EVENTS.ticketUpdated, {
    ticket,
    changed,
  });
}

export function emitCommentCreated(args: {
  orgId: string;
  ticketId: string;
  ticketNumber: number;
  ticketTitle: string;
  comment: Comment;
}): void {
  const { orgId, ...payload } = args;

  // İç notlar müşteri odasına ASLA gönderilmez.
  const rooms = payload.comment.isInternal
    ? [socketRooms.agents()]
    : [socketRooms.agents(), socketRooms.org(orgId)];

  io?.to(rooms).emit(SOCKET_EVENTS.commentCreated, payload);
}
