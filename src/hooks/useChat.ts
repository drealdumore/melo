/**
 * Everything one conversation needs, in one place: the room, the other person,
 * the message list, the send pipeline, typing, and presence.
 *
 * Screens call this and render. They never talk to Supabase directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useIsFocused } from 'expo-router';

import { useProfile } from '@/hooks/useProfile';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { usePresence } from '@/hooks/usePresence';
import { findRoom, getRoomPartner } from '@/services/rooms';
import { createLogger } from '@/services/logger';
import {
  deleteFailedMessage,
  isMessageTooLong,
  needsRetargeting,
  retargetMessage,
  retryTranslation as retryTranslationService,
  sendMessage,
  type NewMessageInput,
} from '@/services/messages';
import type { LocalMessage, PresenceState, Profile, Room } from '@/types/models';

/** Stop announcing typing after this long without a keystroke. */
const TYPING_STOP_MS = 3000;

const log = createLogger('chat');

/** Stable stand-in so the realtime hook is not re-created while the room loads. */
const EMPTY_PROFILE: Profile = {
  id: '00000000-0000-0000-0000-000000000000',
  melo_id: '00000000000',
  display_name: '',
  reading_language: 'en',
  avatar_key: null,
  created_at: '',
  updated_at: '',
};

/** A room load outcome, tagged with the id it was resolved for. */
interface LoadedRoom {
  roomId: string;
  room: Room | null;
  friend: Profile | null;
  notFound: boolean;
}

export interface UseChatResult {
  loading: boolean;
  notFound: boolean;
  room: Room | null;
  friend: Profile | null;
  messages: LocalMessage[];
  send: (text: string) => boolean;
  retry: (message: LocalMessage) => void;
  /** Drops a message this device failed to send. */
  discard: (message: LocalMessage) => void;
  /** Re-runs a failed translation for an already-delivered message. */
  retryTranslation: (message: LocalMessage) => void;
  friendIsTyping: boolean;
  noteTyping: (isTyping: boolean) => void;
  presence: PresenceState;
  presenceLive: boolean;
  connection: 'connecting' | 'subscribed' | 'reconnecting' | 'error';
  appIsActive: boolean;
}

export function useChat(roomId: string): UseChatResult {
  const { profile } = useProfile();
  const isFocused = useIsFocused();

  /**
   * The result is tagged with the room it belongs to instead of being reset
   * when `roomId` changes. Navigating between chats therefore renders the new
   * room as loading immediately, with no frame of the previous room's data and
   * no cascading render from clearing state inside the effect.
   */
  const [loaded, setLoaded] = useState<LoadedRoom | null>(null);

  const active = isFocused && profile !== null;

  const result = loaded && loaded.roomId === roomId ? loaded : null;
  const loading = result === null;
  const notFound = result?.notFound ?? false;
  const room = result?.room ?? null;
  const friend = result?.friend ?? null;

  const {
    messages,
    loading: messagesLoading,
    status,
    appIsActive,
    presenceIds,
    friendIsTyping,
    sendTyping,
    applyLocalMessage,
    setSendState,
    patchLocalMessage,
    removeLocalMessage,
  } = useRealtimeMessages({
    roomId,
    me: profile ?? EMPTY_PROFILE,
    friend: friend ?? EMPTY_PROFILE,
    active,
  });

  /* ------------------------------------------------------------ room load */

  useEffect(() => {
    // A malformed link should resolve to "not found", not fire a doomed query.
    if (!profile || !roomId) return;
    let cancelled = false;
    log.debug(`opening ${roomId}`);

    void (async () => {
      try {
        const found = await findRoom(roomId);
        if (cancelled) return;
        if (!found) {
          // The room row is gone or invisible. The UI only says "not found", so
          // the reason is only ever visible here.
          log.warn(`room ${roomId} could not be found`, {
            cause: 'the row is missing, or row-level security hides it from this user',
          });
          setLoaded({ roomId, room: null, friend: null, notFound: true });
          return;
        }
        const partner = await getRoomPartner(found, profile);
        if (cancelled) return;
        if (!partner) {
          log.warn(`room ${roomId} has no readable partner profile`, {
            room: found.id,
            cause: 'the other profile is missing, or hidden by row-level security',
          });
        } else {
          log.info(`in ${roomId} with ${partner.display_name}`, {
            reads: partner.reading_language,
            writes: profile.reading_language,
          });
        }
        setLoaded({ roomId, room: found, friend: partner, notFound: !partner });
      } catch (error) {
        log.error(`could not open room ${roomId}`, error);
        if (!cancelled) {
          setLoaded({ roomId, room: null, friend: null, notFound: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, profile]);

  /* ----------------------------------------------------------------- send */

  /** Remembers the inputs of in-flight sends so a retry can reuse them. */
  const pendingInputs = useRef(new Map<string, NewMessageInput>());

  const send = useCallback(
    (text: string): boolean => {
      if (!profile || !friend) return false;
      const trimmed = text.trim();
      if (trimmed.length === 0 || isMessageTooLong(trimmed)) {
        log.debug('send was rejected before it started', {
          reason: trimmed.length === 0 ? 'empty text' : 'over the length limit',
          chars: trimmed.length,
        });
        return false;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const input: NewMessageInput = {
        roomId,
        senderId: profile.id,
        text: trimmed,
        // The sender writes in their own reading language; the friend reads in
        // theirs, which was fetched when the chat opened.
        sourceLanguage: profile.reading_language,
        targetLanguage: friend.reading_language,
      };

      sendMessage(input, {
        onPending: (message) => {
          pendingInputs.current.set(message.id, input);
          applyLocalMessage(message);
        },
        onStateChange: (id, state) => {
          setSendState(id, state);
          if (state !== 'sending') pendingInputs.current.delete(id);
        },
        onSent: applyLocalMessage,
      });

      return true;
    },
    [profile, friend, roomId, applyLocalMessage, setSendState]
  );

  const retry = useCallback(
    (message: LocalMessage) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const input: NewMessageInput = pendingInputs.current.get(message.id) ?? {
        roomId,
        senderId: profile?.id ?? message.sender_id,
        text: message.original_text,
        sourceLanguage: message.source_language,
        targetLanguage: message.target_language,
      };

      // Reusing the original UUID is what makes a retry idempotent: a
      // duplicate-key error from the server means the first try landed.
      sendMessage({ ...input, id: message.id }, {
        onPending: applyLocalMessage,
        onStateChange: (id, state) => setSendState(id, state),
        onSent: applyLocalMessage,
      });
    },
    [profile?.id, roomId, applyLocalMessage, setSendState]
  );

  /* ------------------------------------------------------------- recovery */

  const discard = useCallback(
    (message: LocalMessage) => {
      void deleteFailedMessage(message.id);
      removeLocalMessage(message.id);
    },
    [removeLocalMessage]
  );

  const retryTranslation = useCallback(
    (message: LocalMessage) => {
      log.info(`user asked to retry the translation of ${message.id.slice(0, 8)}`);
      patchLocalMessage(message.id, { translation_status: 'pending' });
      void retryTranslationService(message).then((updated) => {
        if (updated) {
          applyLocalMessage(updated);
          return;
        }
        patchLocalMessage(message.id, { translation_status: 'failed' });
      });
    },
    [applyLocalMessage, patchLocalMessage]
  );

  /* ------------------------------------------------- language re-targeting */

  /**
   * Messages whose translation was addressed to a language this device no longer
   * reads.
   *
   * `target_language` is chosen by whoever sent the message, from their copy of
   * the reader's profile, and then frozen into the row. Changing the reader's
   * own language therefore cannot reach anything that was already delivered, so
   * without this the conversation stays in the old language indefinitely — and
   * there is no error anywhere to explain why.
   *
   * Serialised rather than `Promise.all`: one request per message against an
   * endpoint that rate-limits by IP is how a history reload earns a 429.
   *
   * Attempts are remembered per message *and* per language, so the set is also
   * the in-flight guard: it stops a second effect pass from firing while the
   * first is running, and it stops a message whose re-targeting failed from
   * being retried on every unrelated state change. Keying on the language means a
   * genuine later switch still gets another attempt.
   */
  const retargetAttemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    const readerId = profile.id;
    const readerLanguage = profile.reading_language;
    if (!readerLanguage) return;

    const attempted = retargetAttemptedRef.current;
    const stale = messages.filter((message) => {
      if (attempted.has(`${message.id}\u0000${readerLanguage}`)) return false;
      return needsRetargeting(message, readerId, readerLanguage);
    });
    if (stale.length === 0) return;

    log.info(`${stale.length} message(s) are not in ${readerLanguage} yet`, {
      reads: readerLanguage,
    });

    let cancelled = false;

    void (async () => {
      for (const message of stale) {
        if (cancelled) return;
        attempted.add(`${message.id}\u0000${readerLanguage}`);
        const updated = await retargetMessage(message, readerLanguage);
        if (cancelled) return;
        if (updated) applyLocalMessage(updated);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, profile, applyLocalMessage]);

  /* --------------------------------------------------------------- typing */

  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noteTyping = useCallback(
    (isTyping: boolean) => {
      sendTyping(isTyping);
      if (typingStopRef.current) {
        clearTimeout(typingStopRef.current);
        typingStopRef.current = null;
      }
      if (isTyping) {
        // Auto-clear after 3s of inactivity, as a safety net for the friend
        // who closes the app mid-sentence.
        typingStopRef.current = setTimeout(() => {
          typingStopRef.current = null;
          sendTyping(false);
        }, TYPING_STOP_MS);
      }
    },
    [sendTyping]
  );

  useEffect(() => {
    return () => {
      if (typingStopRef.current) clearTimeout(typingStopRef.current);
    };
  }, []);

  const { presence, live: presenceLive } = usePresence(presenceIds, friend?.id ?? '', status === 'subscribed');

  const messagesReady = !messagesLoading || messages.length > 0;

  return useMemo(
    () => ({
      loading: loading || !messagesReady,
      notFound,
      room,
      friend,
      messages,
      send,
      retry,
      discard,
      retryTranslation,
      friendIsTyping,
      noteTyping,
      presence,
      presenceLive,
      connection: status,
      appIsActive,
    }),
    [
      loading,
      messagesReady,
      notFound,
      room,
      friend,
      messages,
      send,
      retry,
      discard,
      retryTranslation,
      friendIsTyping,
      noteTyping,
      presence,
      presenceLive,
      status,
      appIsActive,
    ]
  );
}
