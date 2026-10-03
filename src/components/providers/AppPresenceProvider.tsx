/**
 * Owns app-level presence for the whole app.
 *
 * Two things make this a provider rather than a hook: it must survive navigating
 * between the Chats list and a chat (otherwise the friend would flicker offline
 * on every push), and it has to react to the app being backgrounded.
 *
 * `setActiveRoom` is how a screen says "I am the room the user is looking at",
 * which is what separates a solid ring from a dashed one.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  subscribeToAppPresence,
  type AppPresenceEntry,
  type AppPresenceSubscription,
  type ChannelStatus,
} from '@/services/realtime';
import { useProfile } from '@/hooks/useProfile';
import { createLogger } from '@/services/logger';
import type { PresenceState } from '@/types/models';

const log = createLogger('presence.app');

interface AppPresenceValue {
  /** Everyone in the app, keyed by user id. */
  entries: Record<string, AppPresenceEntry>;
  live: boolean;
  /** Solid ring: the friend is in the app. */
  presenceOf: (userId: string) => PresenceState;
  /** Solid vs dashed ring: is the friend looking at this very room? */
  isInRoom: (userId: string, roomId: string) => boolean;
  /** Called by a chat screen on focus and blur. */
  setActiveRoom: (roomId: string | null) => void;
}

const AppPresenceContext = createContext<AppPresenceValue | null>(null);

export function AppPresenceProvider({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  const meId = profile?.id ?? null;

  const [entries, setEntries] = useState<Record<string, AppPresenceEntry>>({});
  const [live, setLive] = useState(false);

  // Kept in a ref so `setActiveRoom` is stable and screens can call it from an
  // effect without re-subscribing.
  const activeRoomRef = useRef<string | null>(null);
  const subscriptionRef = useRef<AppPresenceSubscription | null>(null);

  useEffect(() => {
    if (!meId) return;

    const subscription = subscribeToAppPresence(meId, {
      onPresenceChange: (next) => {
        const byId: Record<string, AppPresenceEntry> = {};
        // We are not interested in advertising ourselves back to ourselves.
        for (const entry of next) {
          if (entry.userId !== meId) byId[entry.userId] = entry;
        }
        setEntries(byId);
      },
      onStatusChange: (status: ChannelStatus) => {
        setLive(status === 'subscribed');
        if (status !== 'subscribed') {
          // Every ring in the app is about to fall back to "offline", which is
          // indistinguishable from a friend who actually left.
          log.warn(`app presence is ${status}; online rings are now guesses`);
        }
      },
    });
    subscriptionRef.current = subscription;

    return () => {
      subscriptionRef.current = null;
      void subscription.unsubscribe();
    };
  }, [meId]);

  // Foreground only. Backgrounding untracks, so a backgrounded device reads as
  // offline to the friend rather than as a stale "Online".
  useEffect(() => {
    const subscription = subscriptionRef.current;
    if (!subscription) return;

    const handle = (state: AppStateStatus) => {
      if (state === 'active') {
        log.debug('foreground: re-advertising presence');
        subscription.update(activeRoomRef.current);
      } else {
        log.debug(`backgrounding (${state}): untracking presence`);
        void subscription.untrack();
      }
    };

    const listener = AppState.addEventListener('change', handle);
    return () => listener.remove();
  }, [meId]);

  const setActiveRoom = useCallback((roomId: string | null) => {
    activeRoomRef.current = roomId;
    // This is the user moving between the chats list and a conversation, and
    // it is the only thing that separates a solid ring from a dashed one.
    log.info(roomId ? `user is now viewing ${roomId}` : 'user left the chat', { roomId });
    subscriptionRef.current?.update(roomId);
  }, []);

  const value = useMemo<AppPresenceValue>(
    () => ({
      entries,
      live,
      presenceOf: (userId) => (live && entries[userId] ? 'online' : 'offline'),
      isInRoom: (userId, roomId) => entries[userId]?.roomId === roomId,
      setActiveRoom,
    }),
    [entries, live, setActiveRoom]
  );

  return <AppPresenceContext.Provider value={value}>{children}</AppPresenceContext.Provider>;
}

export function useAppPresence(): AppPresenceValue {
  const value = useContext(AppPresenceContext);
  if (!value) {
    throw new Error('useAppPresence must be used inside <AppPresenceProvider>.');
  }
  return value;
}
