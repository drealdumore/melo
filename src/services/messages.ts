/**
 * The send pipeline and history queries.
 *
 * Order of operations:
 *   1. mint a client UUID and render a sender-only optimistic bubble
 *   2. INSERT the message untranslated, with status `pending`
 *   3. translate, then write the translation onto the row in place
 *   4. realtime echoes merge by id, so the sender never sees a duplicate
 *
 * Delivery deliberately does not wait on the translation endpoint. The endpoint
 * is unofficial and rate-limits by IP; blocking a send on it meant a throttle
 * cost the reader the message entirely, not just the translation. A send is
 * `sent` as soon as the row lands, and a translation failure is recorded on the
 * row instead of discarding words that were already readable.
 *
 * A failure or a 10s timeout is always `failed` — never a message stuck in
 * `sending`. Retrying reuses the same UUID, so a duplicate-key error means the
 * first attempt actually landed.
 */
import * as Crypto from 'expo-crypto';

import { requireSupabase, isSupabaseConfigured } from '@/services/supabase';
import { createLogger, now, since } from '@/services/logger';
import { sameLanguage, translateWithStatus } from '@/services/translation';
import type { LocalMessage, Message, SendState } from '@/types/models';

const log = createLogger('messages');

export const HISTORY_LIMIT = 50;
export const MAX_MESSAGE_LENGTH = 4000;
const INSERT_TIMEOUT_MS = 10_000;

export interface NewMessageInput {
  roomId: string;
  senderId: string;
  text: string;
  /** The sender's own reading language. */
  sourceLanguage: string;
  /** The recipient's reading language. */
  targetLanguage: string;
  /** Reused on retry so the same logical message is never sent twice. */
  id?: string;
}

export function isMessageTooLong(text: string): boolean {
  return text.length > MAX_MESSAGE_LENGTH;
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every delivered row, whatever its translation status.
 *
 * These queries used to ask for `translated` or `skipped` only, because a row
 * was not written until its translation had succeeded. Delivery no longer waits
 * on the translation endpoint, so `pending` is the normal state of a message
 * that has just arrived and `failed` is a message whose words arrived without
 * one. Filtering on the translation would hide both — putting the endpoint's
 * latency back in front of the reader, and dropping failed messages from history
 * entirely.
 */
export async function loadMessages(roomId: string, limit = HISTORY_LIMIT): Promise<Message[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await requireSupabase()
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  // Newest first, which is the order the inverted FlatList wants.
  log.debug(`history for ${roomId}`, { rows: data?.length ?? 0, limit });
  return data ?? [];
}

/** Used on resubscribe: only rows we have never seen. */
export async function loadMessagesSince(roomId: string, sinceIso: string): Promise<Message[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await requireSupabase()
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .gt('created_at', sinceIso)
    .order('created_at', { ascending: false });

  if (error) throw error;
  log.debug(`catch-up for ${roomId} since ${sinceIso}`, { rows: data?.length ?? 0 });
  return data ?? [];
}

/**
 * The newest message in each of several rooms, for the Chats list. One query
 * for the whole list rather than N round trips, and an empty result is normal
 * for a brand new conversation.
 */
export async function loadLatestPerRoom(roomIds: string[]): Promise<Map<string, Message>> {
  const latest = new Map<string, Message>();
  if (roomIds.length === 0 || !isSupabaseConfigured) return latest;

  const { data, error } = await requireSupabase()
    .from('messages')
    .select('*')
    .in('room_id', roomIds)
    .order('created_at', { ascending: false })
    .limit(roomIds.length * 4);

  if (error) throw error;
  log.debug(`latest per room for ${roomIds.length} room(s)`, {
    rows: data?.length ?? 0,
  });
  for (const row of data ?? []) {
    if (!latest.has(row.room_id)) latest.set(row.room_id, row);
  }
  return latest;
}

/**
 * Stamps `delivered_at` on the other person's messages. The `sender_id` filter
 * is applied server-side as a second line of defence, on top of the caller only
 * ever passing ids it knows belong to the friend.
 */
export async function markDelivered(messageIds: string[], friendId: string): Promise<void> {
  if (messageIds.length === 0 || !isSupabaseConfigured) return;

  const { error } = await requireSupabase()
    .from('messages')
    .update({ delivered_at: new Date().toISOString() })
    .in('id', messageIds)
    .is('delivered_at', null)
    .eq('sender_id', friendId);
  if (error) log.warn('markDelivered failed', { ids: messageIds.length }, error);
  else log.debug(`marked ${messageIds.length} message(s) delivered`);
}

/**
 * Stamps `read_at` on the other person's messages. Callers must only invoke
 * this while the chat is focused *and* the app is active.
 */
export async function markRead(messageIds: string[], friendId: string): Promise<void> {
  if (messageIds.length === 0 || !isSupabaseConfigured) return;

  const { error } = await requireSupabase()
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .in('id', messageIds)
    .is('read_at', null)
    .eq('sender_id', friendId);
  if (error) log.warn('markRead failed', { ids: messageIds.length }, error);
  else log.debug(`marked ${messageIds.length} message(s) read`);
}

/* -------------------------------------------------------------------------- */
/* Send pipeline                                                               */
/* -------------------------------------------------------------------------- */

export type SendCallbacks = {
  /** Optimistic row to render immediately. */
  onPending: (message: LocalMessage) => void;
  onStateChange: (id: string, state: SendState) => void;
  /**
   * Fired once when the row is durably delivered, and again when its
   * translation is written. Callers must tolerate being called twice for one
   * send and treat the first call as the delivery.
   */
  onSent?: (message: LocalMessage) => void;
};

function optimisticMessage(input: NewMessageInput, id: string, now: string): LocalMessage {
  return {
    id,
    room_id: input.roomId,
    sender_id: input.senderId,
    original_text: input.text,
    translated_text: null,
    source_language: input.sourceLanguage,
    target_language: input.targetLanguage,
    translation_status: 'pending',
    created_at: now,
    delivered_at: null,
    read_at: null,
    sendState: 'sending',
  };
}

/**
 * Rejects after `ms`. The caller (the send pipeline) has already moved the
 * message to a failure state, so the underlying request is simply abandoned.
 */
function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

/**
 * Inserts a fully translated row. A duplicate is updated with the completed
 * translation too, covering retries of rows left pending by an older app.
 */
async function insertMessage(row: LocalMessage): Promise<LocalMessage> {
  if (!isSupabaseConfigured) {
    log.warn('insert skipped: Supabase is not configured', { id: row.id.slice(0, 8) });
    return { ...row, sendState: 'sent', created_at: new Date().toISOString() };
  }

  const started = now();
  const translatedFields = {
    translated_text: row.translated_text,
    translation_status: row.translation_status,
  };
  const { data, error } = await withTimeout(
    requireSupabase()
      .from('messages')
      .insert({
        id: row.id,
        room_id: row.room_id,
        sender_id: row.sender_id,
        original_text: row.original_text,
        source_language: row.source_language,
        target_language: row.target_language,
        ...translatedFields,
      })
      .select()
      .single(),
    INSERT_TIMEOUT_MS,
    'The message could not be sent.'
  );

  if (error) {
    if (error.code === '23505') {
      // A previous attempt may have inserted a pending row before translation
      // was required. Do not treat that row as delivered until it is completed.
      const { data: existing, error: updateError } = await requireSupabase()
        .from('messages')
        .update(translatedFields)
        .eq('id', row.id)
        .select()
        .maybeSingle();
      if (updateError) {
        log.error(`could not complete duplicate ${row.id.slice(0, 8)}`, updateError);
        throw updateError;
      }
      if (existing) {
        log.info(`insert ${row.id.slice(0, 8)} was a duplicate; completed its translation`, {
          latency: since(started),
        });
        return { ...existing, sendState: 'sent' };
      }
    }
    log.error(`insert failed after ${since(started)}`, {
      id: row.id.slice(0, 8),
      room: row.room_id,
      code: error.code,
    }, error);
    throw error;
  }

  log.info(`inserted ${row.id.slice(0, 8)} in ${since(started)}`, {
    room: row.room_id,
    chars: row.original_text.length,
  });
  return { ...data, sendState: 'sent' };
}

/* -------------------------------------------------------------------------- */
/* Translation                                                                 */
/* -------------------------------------------------------------------------- */

async function applyTranslation(
  row: Message,
  targetLanguage?: string
): Promise<LocalMessage> {
  const target = targetLanguage ?? row.target_language;
  const result = await translateWithStatus(row.original_text, target, row.source_language);
  const translatedText = result.status === 'translated' ? result.text : null;
  const localOutcome: LocalMessage = {
    ...row,
    target_language: target,
    translated_text: translatedText,
    translation_status: result.status,
    sendState: 'sent',
  };

  if (!isSupabaseConfigured) return localOutcome;

  const { data, error } = await requireSupabase()
    .from('messages')
    .update({
      translated_text: translatedText,
      translation_status: result.status,
      target_language: target,
    })
    .eq('id', row.id)
    .select()
    .single();

  if (error) {
    log.error(`translation result could not be written for ${row.id.slice(0, 8)}`, error);
    return localOutcome;
  }

  return { ...data, sendState: 'sent' };
}

/**
 * Completes the translation of a row that has already been delivered, and hands
 * the updated row back so the sender's bubble reflects the outcome.
 *
 * Never throws. The message is already in the other person's chat by the time
 * this runs, so a translation failure is recorded as `failed` on the row rather
 * than surfaced as a failed send — the words arrived, only the translation did
 * not, and the reader gets the original with a retry chip.
 */
async function completeTranslation(
  row: LocalMessage,
  callbacks: SendCallbacks
): Promise<void> {
  try {
    const updated = await applyTranslation(row);
    callbacks.onSent?.(updated);
    log.info(`translation ${updated.translation_status} for ${row.id.slice(0, 8)}`, {
      target: updated.target_language,
      toChars: updated.translated_text?.length ?? 0,
    });
  } catch (error) {
    log.error(`translation for ${row.id.slice(0, 8)} threw`, error);
  }
}

/**
 * Shows the sender an optimistic bubble immediately, delivers the row
 * untranslated, then completes the translation in place.
 *
 * `onSent` fires twice by design: once when the row is durably delivered and
 * once when the translation lands. A send is `sent` from the first call, because
 * from that moment the message is in the other person's chat.
 */
export function sendMessage(input: NewMessageInput, callbacks: SendCallbacks): void {
  const id = input.id ?? Crypto.randomUUID();
  const pending = optimisticMessage(input, id, new Date().toISOString());
  const started = now();
  const isRetry = Boolean(input.id);

  log.info(
    `${isRetry ? 'retry' : 'send'} ${id.slice(0, 8)} ${input.sourceLanguage} → ${input.targetLanguage}`,
    { room: input.roomId, chars: input.text.length, retry: isRetry }
  );

  callbacks.onPending(pending);

  const sent = (async () => {
    try {
      // The row goes in first, untranslated, with the status the reader can see
      // as "still working". Delivery used to wait on the translation endpoint,
      // which meant a throttle cost up to 12s of "Sending…" and then dropped the
      // message entirely — the reader never saw words that the sender could see.
      const inserted = await insertMessage(pending);
      callbacks.onSent?.(inserted);
      callbacks.onStateChange(id, 'sent');
      log.info(`send ${id.slice(0, 8)} delivered in ${since(started)}`);

      await completeTranslation(inserted, callbacks);
    } catch (error) {
      log.error(`send ${id.slice(0, 8)} failed after ${since(started)}`, {
        retry: isRetry,
        delivered: false,
      }, error);
      callbacks.onStateChange(id, 'failed');
      throw error;
    }
  })();

  // The rejection must not surface as an unhandled one; the caller sees the
  // failure through onStateChange and the retry affordance.
  sent.catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Merging                                                                     */
/* -------------------------------------------------------------------------- */

/** Merge-by-id with server-wins. The single place duplicates are prevented. */
export function mergeMessages(existing: LocalMessage[], incoming: Message[]): LocalMessage[] {
  if (incoming.length === 0) return existing;

  const byId = new Map<string, LocalMessage>(existing.map((m) => [m.id, m]));
  let changed = false;

  for (const row of incoming) {
    const localSendState =
      'sendState' in row &&
      (row.sendState === 'sending' || row.sendState === 'sent' || row.sendState === 'failed')
        ? row.sendState
        : undefined;

    const previous = byId.get(row.id);

    // A row we have never seen is new whatever its translation status. This used
    // to skip anything that was not `translated` or `skipped`, which was safe
    // only while a row was never written until its translation succeeded. Now a
    // freshly delivered message arrives as `pending`, and dropping it would hide
    // the message from the reader until the translation endpoint answered —
    // reintroducing, on the receiving side, exactly the wait the send pipeline
    // was changed to remove.
    if (!previous) {
      byId.set(row.id, { ...row, sendState: 'sent' });
      changed = true;
      continue;
    }

    // For a row we already hold, the local sendState wins: the server has no
    // idea it was "sending", and a failed send has no server row to speak for
    // it. Everything else, including the translation, is the server's.
    const merged: LocalMessage = {
      ...previous,
      ...row,
      sendState: localSendState ?? previous.sendState ?? 'sent',
    };
    if (!sameMessage(previous, merged)) {
      byId.set(row.id, merged);
      changed = true;
    }
  }

  if (!changed) return existing;
  return sortMessages([...byId.values()]);
}

/* -------------------------------------------------------------------------- */
/* Recovery                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Whether a delivered message is sitting in a language this reader no longer
 * reads.
 *
 * The target language is chosen by the sender, on the sender's device, from
 * their copy of the reader's profile at the moment they hit send. It is then
 * frozen into the row. So when the reader switches language, every message that
 * was addressed to their old one is stale — and nothing in the schema or the
 * read path would ever notice.
 *
 * Only the reader's own messages qualify, and only once the sender is finished
 * with them: a `pending` row is mid-translation on the other device, and
 * re-targeting it would have the two writes race.
 */
export function needsRetargeting(
  message: Message,
  readerId: string,
  readerLanguage: string
): boolean {
  if (message.sender_id === readerId) return false;
  if (message.translation_status === 'pending') return false;
  if (!readerLanguage) return false;
  return !sameLanguage(message.target_language, readerLanguage);
}

/**
 * Brings one stale message forward into the reader's current language.
 *
 * This is a last-writer-wins patch on `translated_text`, which is worth being
 * explicit about: the row has room for exactly one translation, so a message
 * read by two people in two languages cannot hold both. The sender's own bubble
 * never renders `translated_text`, so nothing is lost on their side, and a
 * reader who switches back simply gets it re-translated again on their next
 * open.
 */
export async function retargetMessage(
  message: Message,
  readerLanguage: string
): Promise<LocalMessage | null> {
  const id = message.id.slice(0, 8);
  log.info(`retargeting ${id} into ${readerLanguage}`, {
    was: message.target_language,
    now: readerLanguage,
  });
  try {
    const updated = await applyTranslation(message, readerLanguage);
    if (updated.translation_status === 'failed') {
      log.error(`retargeting ${id} into ${readerLanguage} failed`, {
        status: updated.translation_status,
      });
      return null;
    }
    log.info(`retargeted ${id} into ${readerLanguage}`, {
      status: updated.translation_status,
    });
    return updated;
  } catch (error) {
    log.error(`retargeting ${id} threw`, error);
    return null;
  }
}

/**
 * Re-runs the translation for a message that came back `failed`.
 *
 * The message itself is intact — only the translation is missing — so this
 * reuses the row and never re-sends anything. Returns the updated row, or null
 * if the retry failed again, so the caller can put the message back to `failed`
 * rather than pretending it is still in progress.
 */
export async function retryTranslation(message: Message): Promise<Message | null> {
  const id = message.id.slice(0, 8);
  log.info(`retrying translation for ${id}`, {
    source: message.source_language,
    target: message.target_language,
  });
  try {
    const updated = await applyTranslation(message);
    if (updated.translation_status === 'failed') {
      log.error(`translation retry for ${id} did not succeed`, {
        status: updated.translation_status,
      });
      return null;
    }
    if (updated.translation_status === 'skipped') {
      // The service answered that there was nothing to translate. That is a
      // result, not a failure, and re-running it will not change it.
      log.info(`translation retry for ${id} needed no translation`, {
        declared: message.source_language,
        target: message.target_language,
      });
      return updated;
    }
    log.info(`translation retry for ${id} succeeded`);
    return updated;
  } catch (error) {
    log.error(`translation retry for ${id} threw`, error);
    return null;
  }
}

/**
 * Removes a message this device failed to send.
 *
 * A failed send was never inserted, so this is usually a no-op against the
 * database; it is still attempted, because a send can fail *after* a successful
 * insert (a lost translation response, say) and then the row really is there.
 * Errors are swallowed on purpose: the caller always drops it from local state,
 * and a message the user threw away does not need an error dialog.
 */
export async function deleteFailedMessage(messageId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await requireSupabase().from('messages').delete().eq('id', messageId);
    log.info(`discarded failed message ${messageId.slice(0, 8)}`);
  } catch (error) {
    // Swallowed on purpose: the caller always drops it from local state, and a
    // message the user threw away does not need an error dialog. It does still
    // need a line in the log, in case the row is now orphaned in the database.
    log.warn(`could not delete message ${messageId.slice(0, 8)}; it may be orphaned`, error);
  }
}

function sameMessage(a: LocalMessage, b: LocalMessage): boolean {
  return (
    a.translation_status === b.translation_status &&
    a.translated_text === b.translated_text &&
    // Part of the translation outcome: a message re-targeted into a new language
    // can come back with the same text and status, and the merge has to notice
    // or the re-targeting effect will keep re-running against a stale target.
    a.target_language === b.target_language &&
    a.delivered_at === b.delivered_at &&
    a.read_at === b.read_at &&
    a.sendState === b.sendState
  );
}

/** Newest last, so a plain (non-inverted) mental model is easy to reason about. */
export function sortMessages(messages: LocalMessage[]): LocalMessage[] {
  return [...messages].sort((a, b) => {
    const delta = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : 1;
  });
}

/** What the Chats list shows: translated when it exists, original otherwise. */
export function previewTextFor(message: LocalMessage, isMine: boolean): string {
  if (isMine) return message.original_text;
  if (message.translation_status === 'translated' && message.translated_text) {
    return message.translated_text;
  }
  return message.original_text;
}
