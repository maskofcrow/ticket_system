import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS, type ServerToClientEvents } from '@ticket/shared';
import { API_URL, getAccessToken } from './api';
import { queryKeys } from './queries';

/**
 * Canlı güncelleme: sunucudan gelen olay ilgili sorguları geçersiz kılar,
 * TanStack Query da veriyi kendi tazeler. Olay gövdesindeki veriyi doğrudan
 * cache'e yazmıyoruz — kullanıcının yetkisine göre filtrelenmiş hali (örn. iç
 * notlar) yalnızca sunucudan gelen cevapta doğru.
 */
export function useRealtime(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;

    const socket: Socket<ServerToClientEvents> = io(API_URL, {
      path: '/realtime',
      auth: { token },
      transports: ['websocket'],
    });

    const invalidateLists = () => {
      void qc.invalidateQueries({ queryKey: ['tickets'] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats });
    };

    socket.on(SOCKET_EVENTS.ticketCreated, invalidateLists);
    socket.on(SOCKET_EVENTS.ticketUpdated, ({ ticket }) => {
      invalidateLists();
      void qc.invalidateQueries({ queryKey: queryKeys.ticket(ticket.id) });
    });
    socket.on(SOCKET_EVENTS.commentCreated, ({ ticketId }) => {
      invalidateLists();
      void qc.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
    });

    return () => {
      socket.close();
    };
  }, [enabled, qc]);
}
