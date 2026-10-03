/**
 * Owns the single `room:{roomId}` channel for a chat and fans its three feeds
 * out to the UI: messages, presence, and typing.
 *
 *   - messages:  postgres_changes INSERT + UPDATE, deduped by id, so a sender
 *                never sees their own message twice.
 *   - presence:  Realtime presence keyed by user UUID, heartbeated on
 *                subscribe and on every app foreground.
 *   - typing:    broadcast only, never written to the database.
 *
 * The channel is subscribed on focus and torn down on blur/unmount. On
 * CHANNEL_ERROR / TIMED_OUT / CLOSED we surface `reconnecting`, retry with
 * backoff, and refetch anything newer than the last `created_at` we hold.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  loadMessages,
  loadMessagesSince,
  markDelivered,
  markRead,
  mergeMessages,
  HISTORY_LIMIT,
} from '@/services/messages';
import {
  scheduleRetry,
  subscribeToRoom,
  type ChannelStatus,
  type RoomSubscription,
} from '@/services/realtime';
import { createLogger } from '@/services/logger';
import type { LocalMessage, Message, Profile, SendState } from '@/types/models';

const READ_DEBOUNCE_MS = 300;
const TYPING_IDLE_MS = 3000;
const PRESENCE_HEARTBEAT_MS = 25_000;

const log = createLogger('messages.live');

export interface UseRealtimeMessagesResult {
  messages: LocalMessage[];
  loading: boolean;
  status: ChannelStatus;
  appIsActive: boolean;
  /** User UUIDs currently present on the channel, including me. */
  presenceIds: string[];
  /** True once the friend stops typing, or 3s after they go idle. */
  friendIsTyping: boolean;
  /** Throttled to one broadcast per 2s inside the service. */
  sendTyping: (isTyping: boolean) => void;
  /** Merge an optimistic row in and report its server state. */
  applyLocalMessage: (message: LocalMessage) => void;
  /** Local-only: flips an outgoing message between sending, sent and failed. */
  setSendState: (id: string, state: SendState) => void;
  /** Server fields only: used to move a failed translation back to pending. */
  patchLocalMessage: (
    id: string,
    patch: Partial<Pick<LocalMessage, 'translation_status' | 'translated_text'>>
  ) => void;
  /** Drops a message the user has discarded. */
  removeLocalMessage: (id: string) => void;
}

export interface UseRealtimeMessagesOptions {
  roomId: string;
  me: Profile;
  friend: Profile;
  /** Only hold a channel open while the chat is on screen. */
  active: boolean;
}

export function useRealtimeMessages({
  roomId,
  me,
  friend,
  active,
}: UseRealtimeMessagesOptions): UseRealtimeMessagesResult {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ChannelStatus>('connecting');
  const [presenceIds, setPresenceIds] = useState<string[]>([]);
  const [friendIsTyping, setFriendIsTyping] = useState(false);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');

  const subscriptionRef = useRef<RoomSubscription | null>(null);
  const retryAttemptRef = useRef(0);
  const cancelRetryRef = useRef<(() => void) | null>(null);
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Newest `created_at` we hold. Anything older is already on screen. */
  const lastSeenCreatedAtRef = useRef<string | null>(null);
  /** Cleared on unmount so a late broadcast can never touch a dead component. */
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const ingest = useCallback((rows: Message[]) => {
    if (rows.length === 0 || !mountedRef.current) return;
    setMessages((current) => {
      const next = mergeMessages(current, rows);
      for (const row of rows) {
        if (lastSeenCreatedAtRef.current === null || row.created_at > lastSeenCreatedAtRef.current) {
          lastSeenCreatedAtRef.current = row.created_at;
        }
      }
      return next;
    });
  }, []);

  const catchUp = useCallback(async () => {
    const since = lastSeenCreatedAtRef.current;
    try {
      const rows = since
        ? await loadMessagesSince(roomId, since)
        : await loadMessages(roomId, HISTORY_LIMIT);
      // A catch-up that returns nothing after a reconnect is the interesting
      // case: it means the gap really was empty, rather than the fetch failing.
      log.debug(`caught up on ${roomId}`, {
        rows: rows.length,
        mode: since ? 'since-last-seen' : 'full-history',
      });
      ingest(rows);
    } catch (error) {
      // History is the app's only record of a conversation. If this fails the
      // screen shows an empty chat, which reads as "they never spoke".
      log.error(`could not load messages for ${roomId}`, {
        mode: since ? 'since-last-seen' : 'full-history',
      }, error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [ingest, roomId]);

  const clearTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    if (mountedRef.current) setFriendIsTyping(false);
  }, []);

  /* --------------------------------------------------------- app lifecycle */

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const isActive = next === 'active';
      setAppIsActive(isActive);
      log.info(`app ${isActive ? 'came to the foreground' : 'went to the background'}`);
      if (isActive) {
        // Foreground: re-announce presence and pull anything we missed.
        subscriptionRef.current?.heartbeat();
        void catchUp();
      } else {
        clearTyping();
      }
    });
    return () => sub.remove();
  }, [catchUp, clearTyping]);

  /* ------------------------------------------------------ channel lifecycle */

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    lastSeenCreatedAtRef.current = null;
    log.info(`taking the channel for ${roomId} (active=${active})`);
    // No `setLoading(true)` here on purpose: `loading` starts true, and on a
    // later resubscribe the history we already hold is better than a spinner —
    // `catchUp` merges into it.
    void catchUp();

    const connect = () => {
      if (cancelled) return;
      log.debug(`connect() for ${roomId}`);
      try {
        subscriptionRef.current = subscribeToRoom(roomId, me.id, {
          onMessage: (message) => ingest([message]),
          onPresenceChange: (ids) => {
            if (mountedRef.current) setPresenceIds(ids);
          },
          onTyping: ({ isTyping }) => {
            if (!mountedRef.current) return;
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
            if (isTyping) {
              setFriendIsTyping(true);
              // Belt and braces: never leave the indicator on for good.
              typingTimerRef.current = setTimeout(() => setFriendIsTyping(false), TYPING_IDLE_MS);
            } else {
              typingTimerRef.current = null;
              setFriendIsTyping(false);
            }
          },
          onStatusChange: (next) => {
            if (!mountedRef.current) return;
            setStatus(next);
            if (next === 'subscribed') {
              retryAttemptRef.current = 0;
              cancelRetryRef.current?.();
              cancelRetryRef.current = null;
              void catchUp();
            } else if (next === 'reconnecting') {
              const attempt = retryAttemptRef.current;
              retryAttemptRef.current += 1;
              cancelRetryRef.current?.();
              cancelRetryRef.current = scheduleRetry(attempt, connect);
            }
          },
        });
      } catch (error) {
        // Thrown synchronously by `requireSupabase` when the app is not
        // configured at all, so this is a configuration problem, not a network one.
        log.error(`the realtime channel for ${roomId} could not be opened`, {
          cause: 'Supabase is probably not configured on this build',
        }, error);
        setStatus('error');
      }
    };

    connect();

    const presenceTimer = setInterval(() => {
      subscriptionRef.current?.heartbeat();
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      cancelled = true;
      log.info(`releasing the channel for ${roomId}`);
      clearInterval(presenceTimer);
      cancelRetryRef.current?.();
      cancelRetryRef.current = null;
      const subscription = subscriptionRef.current;
      subscriptionRef.current = null;
      if (subscription) void subscription.unsubscribe();
    };
  }, [active, roomId, me.id, ingest, catchUp]);

  useEffect(() => {
    return () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  /* ---------------------------------------------------- delivered and read */

  useEffect(() => {
    if (messages.length === 0) return;
    const fromFriend = messages
      .filter((m) => m.sender_id === friend.id && m.delivered_at === null)
      .map((m) => m.id);
    if (fromFriend.length === 0) return;
    void markDelivered(fromFriend, friend.id);
  }, [messages, friend.id]);

  useEffect(() => {
    if (readTimerRef.current) {
      clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
    }
    // Never while backgrounded, and never for our own messages.
    if (!active || !appIsActive || messages.length === 0) return;

    const unread = messages
      .filter((m) => m.sender_id === friend.id && m.read_at === null)
      .map((m) => m.id);
    if (unread.length === 0) return;

    // Debounced so a burst of arrivals costs one UPDATE, not twenty.
    readTimerRef.current = setTimeout(() => {
      readTimerRef.current = null;
      void markRead(unread, friend.id);
    }, READ_DEBOUNCE_MS);

    return () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  }, [messages, active, appIsActive, friend.id]);

  /* -------------------------------------------------------------- actions */

  const applyLocalMessage = useCallback((message: LocalMessage) => {
    if (!mountedRef.current) return;
    setMessages((current) => mergeMessages(current, [message]));
  }, []);

  /**
   * `sendState` is client-only, so it has to be driven by us: the server row
   * knows nothing about it, and without this a timed-out send would sit on
   * "sending" forever with no retry affordance.
   */
  const setSendState = useCallback((id: string, state: SendState) => {
    if (!mountedRef.current) return;
    setMessages((current) => {
      const index = current.findIndex((m) => m.id === id);
      if (index === -1 || current[index]?.sendState === state) return current;
      const next = [...current];
      const target = next[index] as LocalMessage;
      next[index] = { ...target, sendState: state };
      return next;
    });
  }, []);

  const sendTyping = useCallback((isTyping: boolean) => {
    subscriptionRef.current?.sendTyping(isTyping);
  }, []);

  /**
   * Patches a message we already hold, e.g. moving a failed translation back to
   * `pending` while a retry runs. Server fields only — `sendState` stays local.
   */
  const patchLocalMessage = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<LocalMessage, 'translation_status' | 'translated_text' | 'target_language'>
      >
    ) => {
      if (!mountedRef.current) return;
      setMessages((current) => {
        const index = current.findIndex((m) => m.id === id);
        if (index === -1) return current;
        const target = current[index] as LocalMessage;
        if (
          target.translation_status === patch.translation_status &&
          target.target_language === patch.target_language
        ) {
          return current;
        }
        const next = [...current];
        next[index] = { ...target, ...patch };
        return next;
      });
    },
    []
  );

  /** Drops a message entirely, for a send the user has given up on. */
  const removeLocalMessage = useCallback((id: string) => {
    if (!mountedRef.current) return;
    setMessages((current) => {
      const next = current.filter((m) => m.id !== id);
      return next.length === current.length ? current : next;
    });
  }, []);

  return {
    messages,
    loading,
    status,
    appIsActive,
    presenceIds,
    friendIsTyping,
    sendTyping,
    applyLocalMessage,
    setSendState,
    patchLocalMessage,
    removeLocalMessage,
  };
}
