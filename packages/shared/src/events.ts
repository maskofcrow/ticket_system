import type { Comment, TicketSummary } from './ticket.js';

/**
 * Socket.IO event isimleri. Sunucu ve iki istemci de bu sabitleri kullanır —
 * string literal'ları elle yazmak, sessizce dinlenmeyen event'lere yol açıyor.
 */
export const SOCKET_EVENTS = {
  ticketCreated: 'ticket:created',
  ticketUpdated: 'ticket:updated',
  commentCreated: 'comment:created',
} as const;

/**
 * Oda isimleri. Her bağlı kullanıcı bağlantı anında tam olarak BİR odaya girer:
 * destek ekibi `agents`, müşteriler kendi firmalarının `org:{id}` odasına.
 *
 * Bilinçli olarak ticket bazlı oda yok: kullanıcı zaten ilgili olduğu tüm
 * olayları bu odalardan alıyor, ikinci bir oda eklemek aynı olayın iki kez
 * gönderilmesine ve iç notların müşteriye sızmasına yol açıyordu.
 * İstemci hangi ticket'ı gösterdiğini kendisi filtreler.
 */
export const socketRooms = {
  agents: () => 'agents',
  org: (orgId: string) => `org:${orgId}`,
} as const;

export interface TicketCreatedEvent {
  ticket: TicketSummary;
}

export interface TicketUpdatedEvent {
  ticket: TicketSummary;
  /** Hangi alanlar değişti — istemci "durum güncellendi" gibi bildirim metni üretir. */
  changed: string[];
}

export interface CommentCreatedEvent {
  ticketId: string;
  ticketNumber: number;
  ticketTitle: string;
  comment: Comment;
}

export interface ServerToClientEvents {
  'ticket:created': (payload: TicketCreatedEvent) => void;
  'ticket:updated': (payload: TicketUpdatedEvent) => void;
  'comment:created': (payload: CommentCreatedEvent) => void;
}

/** İstemci sunucuya event göndermez — abonelik bağlantı anında sunucuda belirlenir. */
export type ClientToServerEvents = Record<string, never>;
