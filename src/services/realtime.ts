/**
 * Realtime.
 *
 * One channel per room, `room:{roomId}`, carrying three things:
 *   1. `postgres_changes` on `messages` (INSERT + UPDATE) — new messages,
 *      completed translations, and delivered/read all arrive through here.
 *   2. Presence payloads include the user UUID. Realtime state is keyed by
 *      connection, so the friend is online when their UUID appears in a payload.
 *      Tracked on subscribe and on AppState changes.
 *   3. Broadcast `typing`, which is never written to the database.
 *
 * Lifecycle is owned by the caller: subscribe on focus, unsubscribe on blur and
 * unmount. On CHANNEL_ERROR / TIMED_OUT / CLOSED we surface `reconnecting` and
 * retry with backoff; the caller refetches anything newer than it last saw.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import { requireSupabase } from '@/services/supabase';
import { createLogger } from '@/services/logger';
import type { Message } from '@/types/models';

const log = createLogger('realtime');

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

function readRoomPresenceIds(channel: RealtimeChannel): string[] {
  const state = channel.presenceState<Record<string, unknown[]>>();
  const ids = new Set<string>();

  for (const [key, presences] of Object.entries(state)) {
    for (const presence of presences) {
      const userId =
        typeof presence === 'object' &&
        presence !== null &&
        'userId' in presence &&
        typeof presence.userId === 'string'
          ? presence.userId
          : key;
      ids.add(userId);
    }
  }

  return [...ids];
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
  const name = channelName(roomId);
  const channel = client.channel(name);
  log.debug(`subscribing to ${name}`);

  // Both message events land in the same handler, but they mean different
  // things: INSERT is a new message, UPDATE is usually a translation landing.
  // Logging the event type is what makes "the bubble never appeared" traceable.
  const onChange = (event: string) => (payload: { new: Message }) => {
    const message = payload.new as Message;
    log.debug(`${event} ${message.id.slice(0, 8)} in ${name}`, {
      from: message.sender_id === meId ? 'me' : 'friend',
      chars: message.original_text?.length ?? 0,
      translation: message.translation_status,
    });
    handlers.onMessage(message);
  };

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      onChange('INSERT')
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      },
      onChange('UPDATE')
    )
    .on(PRESENCE_EVENT, { event: 'sync' }, () => {
      const ids = readRoomPresenceIds(channel);
      log.debug(`presence sync on ${name}: ${ids.length} online`, { meOnline: ids.includes(meId) });
      handlers.onPresenceChange?.(ids);
    })
    .on(PRESENCE_EVENT, { event: 'join' }, () => {
      const ids = readRoomPresenceIds(channel);
      log.debug(`presence join on ${name}: ${ids.length} online`);
      handlers.onPresenceChange?.(ids);
    })
    .on(PRESENCE_EVENT, { event: 'leave' }, () => {
      const ids = readRoomPresenceIds(channel);
      log.debug(`presence leave on ${name}: ${ids.length} still online`);
      handlers.onPresenceChange?.(ids);
    })
    .on('broadcast', { event: TYPING_EVENT }, ({ payload }) => {
      const data = payload as TypingPayload;
      if (data?.userId && data.userId !== meId) {
        log.debug(`friend is ${data.isTyping ? 'typing' : 'stopped typing'}`, {
          from: data.userId.slice(0, 8),
        });
        handlers.onTyping?.(data);
      }
    })
    .subscribe(async (status, error) => {
      switch (status) {
        case 'SUBSCRIBED':
          handlers.onStatusChange?.('subscribed');
          await channel.track({ userId: meId, online_at: new Date().toISOString() });
          log.info(`${name} is live`);
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
          handlers.onStatusChange?.('reconnecting');
          // Logged at warn so LogBox flags a chat that has gone quiet, which is
          // otherwise just messages that silently stop arriving.
          log.warn(`${name} hit ${status}`, { detail: error?.message ?? 'no error given' });
          break;
        case 'CLOSED':
          handlers.onStatusChange?.('reconnecting');
          log.info(`${name} was closed`);
          break;
        default:
          handlers.onStatusChange?.('connecting');
          log.debug(`${name} is ${status}`);
      }
    });

  let lastTypingSentAt = 0;

  return {
    channel,
    heartbeat: () => {
      log.debug(`heartbeat on ${name}`);
      void channel.track({ userId: meId, online_at: new Date().toISOString() });
    },
    sendTyping: (isTyping: boolean) => {
      const elapsed = Date.now() - lastTypingSentAt;
      // Starting to type is throttled to one broadcast per 2s. Stopping is
      // sent straight away (bar a 100ms coalesce) so the indicator can never
      // stick on the other device.
      if (isTyping ? elapsed < TYPING_THROTTLE_MS : elapsed < 100) return;
      lastTypingSentAt = Date.now();
      log.debug(`broadcasting typing=${isTyping} on ${name}`);
      void channel.send({
        type: 'broadcast',
        event: TYPING_EVENT,
        payload: { userId: meId, isTyping },
      });
    },
    unsubscribe: async () => {
      log.info(`leaving ${name}`);
      try {
        await channel.untrack();
      } catch {
        // The socket may already be gone; nothing to clean up.
        log.debug(`untrack on ${name} failed; the socket is probably already closed`);
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
  if (roomIds.length === 0) {
    log.debug('no rooms to watch for the chats list');
    return () => {};
  }

  const client = requireSupabase();
  const name = `user:${meId}`;
  const channel = client.channel(name);
  log.debug(`subscribing to ${name} for ${roomIds.length} room(s)`);

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => {
      const message = payload.new as Message;
      // A message in a room this client is not showing is normal: the chats
      // list watches every room, and only some are open.
      if (!roomIds.includes(message.room_id)) {
        log.debug(`ignored ${message.id.slice(0, 8)} from an unwatched room`);
        return;
      }
      onMessage(message);
    }
  );

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      onStatusChange?.('subscribed');
      log.info(`${name} is live`);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatusChange?.('reconnecting');
      log.warn(`${name} hit ${status}; unread dots may go stale`);
    }
  });

  return () => {
    log.info(`leaving ${name}`);
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
 * So there is one shared channel, `app:presence`, whose payload includes the
 * user UUID and the room they currently have open. Combined with room presence
 * it gives the full picture:
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
    // Supabase keys state by connection; the payload identifies the user.
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
  handlers: AppPresenceHandlers,
  isForeground: () => boolean,
  initialRoomId: string | null
): AppPresenceSubscription {
  const client: SupabaseClient = requireSupabase();
  const channel = client.channel(APP_PRESENCE_CHANNEL);
  let activeRoomId = initialRoomId;
  let channelSubscribed = false;
  log.debug(`subscribing to ${APP_PRESENCE_CHANNEL} as ${meId.slice(0, 8)}`);

  const publish = (roomId: string | null) => {
    activeRoomId = roomId;
    log.debug(`advertising presence: room ${roomId ?? 'none'}`);
    if (!channelSubscribed || !isForeground()) return;

    void channel
      .track({ userId: meId, roomId, at: new Date().toISOString() })
      .then((status) => {
        if (status !== 'ok') {
          log.warn(`presence track returned ${status} for ${APP_PRESENCE_CHANNEL}`);
        }
      })
      .catch((error: unknown) => {
        log.error(`could not publish presence on ${APP_PRESENCE_CHANNEL}`, error);
      });
  };

  const emit = () => {
    const entries = readAppPresence(channel);
    log.debug(`${APP_PRESENCE_CHANNEL}: ${entries.length} user(s) in the app`, {
      rooms: entries.map((entry) => entry.roomId ?? 'list'),
    });
    handlers.onPresenceChange?.(entries);
  };

  channel
    .on(PRESENCE_EVENT, { event: 'sync' }, emit)
    .on(PRESENCE_EVENT, { event: 'join' }, emit)
    .on(PRESENCE_EVENT, { event: 'leave' }, emit)
    .subscribe((status) => {
      switch (status) {
        case 'SUBSCRIBED':
          channelSubscribed = true;
          handlers.onStatusChange?.('subscribed');
          publish(activeRoomId);
          log.info(`${APP_PRESENCE_CHANNEL} is live`);
          break;
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT':
        case 'CLOSED':
          channelSubscribed = false;
          handlers.onStatusChange?.('reconnecting');
          log.warn(`${APP_PRESENCE_CHANNEL} hit ${status}; online rings will be wrong`);
          break;
        default:
          channelSubscribed = false;
          handlers.onStatusChange?.('connecting');
          log.debug(`${APP_PRESENCE_CHANNEL} is ${status}`);
      }
    });

  return {
    update: publish,
    untrack: async () => {
      log.info('going to the background: untracking presence');
      try {
        await channel.untrack();
      } catch {
        // The socket may already be gone; nothing to clean up.
        log.debug('untrack failed; the socket is probably already closed');
      }
    },
    unsubscribe: async () => {
      try {
        await channel.untrack();
      } catch {
        // Nothing to clean up.
      }
      await client.removeChannel(channel);
      log.info(`left ${APP_PRESENCE_CHANNEL}`);
    },
  };
}

/** Applies an exponential backoff that survives the component unmounting. */
export function scheduleRetry(attempt: number, run: () => void): () => void {
  const wait = backoffFor(attempt);
  log.info(`reconnect attempt ${attempt + 1} in ${wait}ms`);
  const timer = setTimeout(run, wait);
  return () => clearTimeout(timer);
}
