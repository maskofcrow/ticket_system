import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS, type ServerToClientEvents } from '@ticket/shared';
import { getAccessToken, getApiUrl } from './api';

/**
 * Canlı bağlantı: destek yanıt verdiğinde native bildirim gösterir ve açık
 * listeleri tazeler. İç notlar sunucu tarafında müşteri odasına hiç
 * gönderilmediği için buraya ulaşmaz.
 */
/**
 * Okunmamış sayacı modül seviyesinde: rozeti temizleyen ekranlarla aynı değeri
 * paylaşmalı, aksi halde temizlemeden sonra sayaç kaldığı yerden devam ederdi.
 */
let unread = 0;

export function useLiveUpdates(enabled: boolean, currentUserId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;

    const socket: Socket<ServerToClientEvents> = io(getApiUrl(), {
      path: '/realtime',
      auth: { token },
      transports: ['websocket'],
    });

    socket.on(SOCKET_EVENTS.commentCreated, (payload) => {
      void qc.invalidateQueries({ queryKey: ['tickets'] });
      void qc.invalidateQueries({ queryKey: ['ticket', payload.ticketId] });

      // Kendi yazdığımız mesaj için bildirim gösterme.
      if (payload.comment.author.id === currentUserId) return;

      unread += 1;
      void window.desktop.app.setBadge(unread);
      void window.desktop.notify(
        `#${payload.ticketNumber} — yanıt geldi`,
        `${payload.comment.author.name}: ${payload.comment.body.slice(0, 120)}`,
      );
    });

    socket.on(SOCKET_EVENTS.ticketUpdated, (payload) => {
      void qc.invalidateQueries({ queryKey: ['tickets'] });
      void qc.invalidateQueries({ queryKey: ['ticket', payload.ticket.id] });

      if (payload.changed.includes('status')) {
        void window.desktop.notify(
          `#${payload.ticket.number} — durum güncellendi`,
          payload.ticket.title,
        );
      }
    });

    socket.on(SOCKET_EVENTS.ticketCreated, () => {
      void qc.invalidateQueries({ queryKey: ['tickets'] });
    });

    return () => {
      socket.close();
    };
  }, [enabled, currentUserId, qc]);
}

/** Kullanıcı talepleri görüntüleyince rozeti ve sayacı sıfırla. */
export function clearBadge(): void {
  unread = 0;
  void window.desktop.app.setBadge(0);
}
