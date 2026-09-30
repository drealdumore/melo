/**
 * Turns the raw presence list into the one thing the header needs to say.
 *
 * It is deliberately separate from the channel: the channel is owned by
 * `useRealtimeMessages`, and a second channel on the same topic would double
 * join the room. When we have no live connection we say `offline` rather than
 * showing a stale "Online".
 */
import type { PresenceState } from '@/types/models';

export interface UsePresenceResult {
  presence: PresenceState;
  /** True when a live connection is backing the answer. */
  live: boolean;
}

export function usePresence(
  presenceIds: string[],
  friendId: string,
  live: boolean
): UsePresenceResult {
  const presence: PresenceState = live && presenceIds.includes(friendId) ? 'online' : 'offline';
  return { presence, live };
}
