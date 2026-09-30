/**
 * Relative time for chat lists: "now", "4m", "3h", "Tue", "12 Mar". Deliberately
 * terse — the list is a scanning surface, not a place to read a date.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const diff = now - then;
  if (diff < MINUTE) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;

  const date = new Date(then);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const daysAgo = Math.floor((startOfToday.getTime() - then) / DAY) + 1;

  if (daysAgo < 7) return `${date.getDay() === 0 ? 'Sun' : WEEKDAYS[date.getDay() - 1]}`;
  const sameYear = date.getFullYear() === startOfToday.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The timestamp shown under the last bubble of a group. */
export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today", "Yesterday", then a weekday, then a date. For date separators. */
export function formatDateSeparator(iso: string, now = Date.now()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60_000;
  const daysAgo = Math.round((startOfToday.getTime() - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / dayMs);

  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 7) return WEEKDAYS[(then.getDay() + 6) % 7] ?? '';

  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(then.getFullYear() === startOfToday.getFullYear() ? {} : { year: 'numeric' }),
  });
}
