/**
 * Groups a flat, oldest-first message list into renderable runs so consecutive
 * messages from the same person share a bubble corner and one timestamp, and
 * flags the day changes so the list can label them.
 */
import type { LocalMessage } from '@/types/models';

export interface MessageGroup {
  /** Stable key for the row. */
  key: string;
  messages: LocalMessage[];
  isMine: boolean;
  /** The last message of the group carries the timestamp. */
  last: LocalMessage;
  /** This run opens a new day, so a date separator goes above it. */
  startsNewDay: boolean;
}

const GROUP_WINDOW_MS = 5 * 60_000;

function startOfDay(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function groupMessages(messages: LocalMessage[], meId: string): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let previousDay: number | null = null;

  for (const message of messages) {
    const isMine = message.sender_id === meId;
    const current = groups[groups.length - 1];
    const day = startOfDay(message.created_at);
    const startsNewDay = previousDay === null || day !== previousDay;
    previousDay = day;

    if (current && current.isMine === isMine && !startsNewDay) {
      const gap = Date.parse(message.created_at) - Date.parse(current.last.created_at);
      if (gap < GROUP_WINDOW_MS) {
        current.messages.push(message);
        current.last = message;
        continue;
      }
    }

    groups.push({ key: message.id, messages: [message], isMine, last: message, startsNewDay });
  }

  return groups;
}
