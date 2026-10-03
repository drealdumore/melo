/**
 * App-facing models. These wrap the database rows with the little bit of
 * client-only state the UI needs (optimistic send status, chat previews).
 */

import type { TableRow } from '@/types/database';

export type Profile = TableRow<'profiles'>;
export type Room = TableRow<'rooms'>;
export type Message = TableRow<'messages'>;

export type TranslationStatus = 'pending' | 'translated' | 'failed' | 'skipped';

/** Local-only lifecycle of an outgoing message. Never stored in Postgres. */
export type SendState = 'sending' | 'sent' | 'failed';

export interface LocalMessage extends Message {
  /**
   * Present only for messages this device authored. The server row has no such
   * column; we merge it away once the insert echoes back.
   */
  sendState?: SendState;
}

/** A room joined with the other participant, as rendered by the Chats list. */
export interface ChatSummary {
  room: Room;
  /** The other person, never me. */
  friend: Profile;
  lastMessage: LocalMessage | null;
  unreadCount: number;
}

/** Presence for one participant of a room. */
export type PresenceState = 'online' | 'offline';

export interface ChatParticipant {
  profile: Profile;
  presence: PresenceState;
}

/** Result of the Connect screen's "Start Chat" action. */
export type ConnectResult =
  | { ok: true; roomId: string }
  | { ok: false; reason: 'not_found' | 'self' }
  | { ok: false; reason: 'unknown'; error: unknown };
