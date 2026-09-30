/**
 * The Chats list: every room you are part of, newest activity first, with the
 * last line shown in the language you actually read.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useProfile } from '@/hooks/useProfile';
import { listChats } from '@/services/rooms';
import { loadLatestPerRoom } from '@/services/messages';
import { subscribeToRoomsForUser } from '@/services/realtime';
import type { ChatSummary, LocalMessage, Message, Profile } from '@/types/models';

export interface UseChatsResult {
  chats: ChatSummary[];
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  refresh: () => void;
}

export function useChats(): UseChatsResult {
  const { profile } = useProfile();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  /**
   * Pure with respect to component state: it reads Supabase and returns the
   * summaries. Keeping the `setState` calls out of here is what lets the
   * effects below stay honest — they only update state in a promise callback.
   */
  const fetchChats = useCallback(async (me: Profile): Promise<ChatSummary[]> => {
    const pairs = await listChats(me);
    const latest = await loadLatestPerRoom(pairs.map((pair) => pair.room.id));

    const summaries: ChatSummary[] = pairs.map(({ room, friend }) => {
      const message = latest.get(room.id) ?? null;
      return { room, friend, lastMessage: message, unreadCount: countUnread(message, me.id) };
    });

    // Most recent conversation first; a chat never messaged sits last.
    summaries.sort(byRecency);
    return summaries;
  }, []);

  const apply = useCallback((summaries: ChatSummary[]) => {
    setChats(summaries);
    setError(false);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const failed = useCallback(() => {
    setError(true);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void fetchChats(profile)
      .then((summaries) => {
        if (!cancelled) apply(summaries);
      })
      .catch((error: unknown) => {
        console.warn('Could not load chats', error);
        if (!cancelled) failed();
      });
    return () => {
      cancelled = true;
    };
  }, [profile, fetchChats, apply, failed]);

  // Returning to the list should show what happened in the background.
  useEffect(() => {
    if (!profile) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void fetchChats(profile)
        .then(apply)
        .catch((error: unknown) => console.warn('Could not refresh chats', error));
    });
    return () => subscription.remove();
  }, [profile, fetchChats, apply]);

  const refresh = useCallback(() => {
    if (!profile) return;
    setRefreshing(true);
    void fetchChats(profile)
      .then(apply)
      .catch((error: unknown) => {
        console.warn('Could not refresh chats', error);
        failed();
      });
  }, [profile, fetchChats, apply, failed]);

  /**
   * A preview that updates itself. Without this the Chats list only refreshes on
   * focus, so a message arriving while you are already looking at the list would
   * sit stale — the one moment the list is definitely being watched.
   *
   * The subscription is keyed on a joined string rather than the array so a new
   * message does not tear the channel down and rebuild it.
   */
  const roomKey = chats.map((chat) => chat.room.id).join('|');

  useEffect(() => {
    if (!profile || roomKey.length === 0) return;

    const onMessage = (message: Message) => {
      setChats((current) => {
        const known = current.some((chat) => chat.room.id === message.room_id);
        // A room we have not loaded yet: a full fetch is the honest answer.
        if (!known) {
          void fetchChats(profile)
            .then(apply)
            .catch(() => {});
          return current;
        }

        const next = current.map((chat) =>
          chat.room.id === message.room_id
            ? { ...chat, lastMessage: message, unreadCount: countUnread(message, profile.id) }
            : chat
        );
        next.sort(byRecency);
        return next;
      });
    };

    return subscribeToRoomsForUser(profile.id, roomKey.split('|'), onMessage);
  }, [profile, roomKey, fetchChats, apply]);

  return { chats, loading, refreshing, error, refresh };
}

/** Most recent conversation first; a chat never messaged sorts last. */
function byRecency(a: ChatSummary, b: ChatSummary): number {
  const left = a.lastMessage?.created_at ?? a.room.created_at;
  const right = b.lastMessage?.created_at ?? b.room.created_at;
  return Date.parse(right) - Date.parse(left);
}

function countUnread(message: LocalMessage | null, meId: string): number {
  if (!message) return 0;
  if (message.sender_id === meId) return 0;
  return message.read_at ? 0 : 1;
}
