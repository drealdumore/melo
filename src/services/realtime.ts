/**
 * Realtime.
 *
 * One channel per room, `room:{roomId}`, carrying three things:
 *   1. `postgres_changes` on `messages` (INSERT + UPDATE) — new messages,
 *      completed translations, and delivered/read all arrive through here.
 *   2. Presence keyed by user UUID. The friend is online when their UUID is in
 *      the presence state. Tracked on subscribe and on AppState changes.
 *   3. Broadcast `typing`, which is never written to the database.
 *
 * Lifecycle is owned by the caller: subscribe on focus, unsubscribe on blur and
 * unmount. On CHANNEL_ERROR / TIMED_OUT / CLOSED we surface `reconnecting` and
 * retry with backoff; the caller refetches anything newer than it last saw.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { requireSupabase } from '@/services/supabase';
import type { Message } from '@/types/models';

export type ChannelStatus = 'connecting' | 'subscribed' | 'reconnecting' | 'error';

export const TYPING_EVENT = 'typing';
export const PRESENCE_EVENT = 'presence';

export interface TypingPayload {
  userId: string;
  isTyping: boolean;
}

export interface RoomRealtimeHandlers {
  onMessage: (message: Message) => void;
  onStatusChange?: (status: ChannelStatus) => void;
  onPresenceChange?: (presentUserIds: string[]) => void;
  onTyping?: (payload: TypingPayload) => void;
}

export interface RoomSubscription {
  channel: RealtimeChannel;
  /** Tell the channel we are still here, after a resume or a resubscribe. */
  heartbeat: () => void;
  sendTyping: (isTyping: boolean) => void;
  unsubscribe: () => Promise<void>;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
/** Matches the typing throttle in the hook layer. */
const TYPING_THROTTLE_MS = 2000;

function channelName(roomId: string): string {
  return `room:${roomId}`;
}

/**
 * Subscribes to everything a single chat needs. The Supabase client already
 * retries its socket internally, so this layer is about the *channel*:
 * surfacing "Reconnecting…" and letting the UI refetch.
 */
export function subscribeToRoom(
  roomId: string,
  meId: string,
  handlers: RoomRealtimeHandlers
): RoomSubscription {
  const client: SupabaseClient = requireSupabase();
  const channel = client.channel(channelName(roomId));

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => handlers.onMessage(payload.new as Message)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => handlers.onMessage(payload.new as Message)
    )
    .on(PRESENCE_EVENT, { event: 'sync' }, () => {
      const state = channel.presenceState<Record<string, unknown[]>>();
      const ids = Object.keys(state);
      handlers.onPresenceChange?.(ids);
    })
    .on(PRESENCE_EVENT, { event: 'join' }, () => {
      handlers.onPresenceChange?.(Object.keys(channel.presenceState()));
    })
    .on(PRESENCE_EVENT, { event: 'leave' }, () => {
      handlers.onPresenceChange?.(Object.keys(channel.presenceState()));
    })
    .on('broadcast', { event: TYPING_EVENT }, ({ payload }) => {
      const data = payload as TypingPayload;
      if (data?.userId && data.userId !== meId) handlers.onTyping?.(data);
    })
    .subscribe(async (status, error) => {
      switch (status) {
        case 'SUBSCRIBED':
          handlers.onStatusChange?.('subscribed');
          await channel.track({ userId: meId, online_at: new Date().toISOString() });
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          handlers.onStatusChange?.('reconnecting');
          console.warn(`Realtime ${status} on ${channelName(roomId)}`, error?.message ?? '');
          break;
        case 'CLOSED':
          handlers.onStatusChange?.('reconnecting');
          break;
        default:
          handlers.onStatusChange?.('connecting');
      }
    });

  let lastTypingSentAt = 0;

  return {
    channel,
    heartbeat: () => {
      void channel.track({ userId: meId, online_at: new Date().toISOString() });
    },
    sendTyping: (isTyping: boolean) => {
      const elapsed = Date.now() - lastTypingSentAt;
      // Starting to type is throttled to one broadcast per 2s. Stopping is
      // sent straight away (bar a 100ms coalesce) so the indicator can never
      // stick on the other device.
      if (isTyping ? elapsed < TYPING_THROTTLE_MS : elapsed < 100) return;
      lastTypingSentAt = Date.now();
      void channel.send({
        type: 'broadcast',
        event: TYPING_EVENT,
        payload: { userId: meId, isTyping },
      });
    },
    unsubscribe: async () => {
      try {
        await channel.untrack();
      } catch {
        // The socket may already be gone; nothing to clean up.
      }
      await client.removeChannel(channel);
    },
  };
}

/**
 * Subscribes to INSERTs across several rooms at once, so the Chats list's
 * unread dots and previews update without polling.
 */
export function subscribeToRoomsForUser(
  meId: string,
  roomIds: string[],
  onMessage: (message: Message) => void,
  onStatusChange?: (status: ChannelStatus) => void
): () => void {
  if (roomIds.length === 0) return () => {};

  const client = requireSupabase();
  const channel = client.channel(`user:${meId}`);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      const message = payload.new as Message;
      if (roomIds.includes(message.room_id)) onMessage(message);
    }
  );

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') onStatusChange?.('subscribed');
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatusChange?.('reconnecting');
    }
  });

  return () => {
    void client.removeChannel(channel);
  };
}

/** Milliseconds to wait before the n'th reconnect attempt. */
export function backoffFor(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 15000;
}

/**
 * App-level presence.
 *
 * Room presence alone cannot answer the questions the UI actually asks. A friend
 * sitting on the Chats list is in the app but in no room, so room-only presence
 * would report them offline; and a friend in *this* chat needs a different ring
 * from a friend somewhere else in the app.
 *
 * So there is one shared channel, `app:presence`, keyed by user UUID, whose
 * payload also says which room that user currently has open. Combined with room
 * presence it gives the full picture:
 *
 *   in this room              → solid `success` ring
 *   in the app, another room  → dashed muted ring
 *   not in the app            → offline
 *
 * Tracked only while the app is in the foreground: backgrounding untracks, which
 * is what makes "in the app" mean what the user thinks it means.
 */
export interface AppPresenceEntry {
  userId: string;
  /** The room the user currently has open, or null if they are on a list. */
  roomId: string | null;
  at: string;
}

export interface AppPresenceHandlers {
  onPresenceChange?: (entries: AppPresenceEntry[]) => void;
  onStatusChange?: (status: ChannelStatus) => void;
}

export interface AppPresenceSubscription {
  /** Re-publish our own presence, e.g. after navigating to a different room. */
  update: (roomId: string | null) => void;
  /** Stop advertising presence, e.g. when the app backgrounds. */
  untrack: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

const APP_PRESENCE_CHANNEL = 'app:presence';

function readAppPresence(channel: RealtimeChannel): AppPresenceEntry[] {
  // The generic on `presenceState` describes the *value* shape, but the state is
  // a map of key to rows, so the rows are read off the value directly here.
  const state = channel.presenceState() as unknown as Record<string, Partial<AppPresenceEntry>[]>;
  const entries: AppPresenceEntry[] = [];
  for (const [key, rows] of Object.entries(state)) {
    // A key is the tracked userId; the row carries the room they are in.
    const row = rows[rows.length - 1];
    entries.push({
      userId: row?.userId ?? key,
      roomId: row?.roomId ?? null,
      at: row?.at ?? new Date().toISOString(),
    });
  }
  return entries;
}

export function subscribeToAppPresence(
  meId: string,
  handlers: AppPresenceHandlers
): AppPresenceSubscription {
  const client: SupabaseClient = requireSupabase();
  const channel = client.channel(APP_PRESENCE_CHANNEL);

  const publish = (roomId: string | null) =>
    void channel.track({ userId: meId, roomId, at: new Date().toISOString() });

  const emit = () => handlers.onPresenceChange?.(readAppPresence(channel));

  channel
    .on(PRESENCE_EVENT, { event: 'sync' }, emit)
    .on(PRESENCE_EVENT, { event: 'join' }, emit)
    .on(PRESENCE_EVENT, { event: 'leave' }, emit)
    .subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          handlers.onStatusChange?.('subscribed');
          publish(null);
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
        case 'CLOSED':
          handlers.onStatusChange?.('reconnecting');
          break;
        default:
          handlers.onStatusChange?.('connecting');
      }
    });

  return {
    update: publish,
    untrack: async () => {
      try {
        await channel.untrack();
      } catch {
        // The socket may already be gone; nothing to clean up.
      }
    },
    unsubscribe: async () => {
      try {
        await channel.untrack();
      } catch {
        // Nothing to clean up.
      }
      await client.removeChannel(channel);
    },
  };
}

/** Applies an exponential backoff that survives the component unmounting. */
export function scheduleRetry(attempt: number, run: () => void): () => void {
  const timer = setTimeout(run, backoffFor(attempt));
  return () => clearTimeout(timer);
}
