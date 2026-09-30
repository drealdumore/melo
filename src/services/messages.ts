/**
 * The send pipeline and history queries.
 *
 * Order of operations, which is what makes a send look instant and never get
 * stuck:
 *   1. mint a client UUID, render the message as `sending`
 *   2. INSERT with translation_status = 'pending'  →  `sent`
 *   3. translate, then UPDATE the row with the result
 *   4. realtime echoes merge by id, so the sender never sees a duplicate
 *
 * A failure or a 10s timeout is always `failed` — never a message stuck in
 * `sending`. Retrying reuses the same UUID, so a duplicate-key error means the
 * first attempt actually landed.
 */
import * as Crypto from 'expo-crypto';

import { requireSupabase, isSupabaseConfigured } from '@/services/supabase';
import { translateWithStatus } from '@/services/translation';
import type { LocalMessage, Message, SendState, TranslationStatus } from '@/types/models';

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

export interface SendHandle {
  id: string;
  /** Resolves once the row is durably inserted (`sent`). */
  sent: Promise<void>;
}

export function isMessageTooLong(text: string): boolean {
  return text.length > MAX_MESSAGE_LENGTH;
}

/* -------------------------------------------------------------------------- */
/* History                                                                     */
/* -------------------------------------------------------------------------- */

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
  if (error) console.warn('markDelivered failed', error.message);
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
  if (error) console.warn('markRead failed', error.message);
}

/* -------------------------------------------------------------------------- */
/* Send pipeline                                                               */
/* -------------------------------------------------------------------------- */

export type SendCallbacks = {
  /** Optimistic row to render immediately. */
  onPending: (message: LocalMessage) => void;
  onStateChange: (id: string, state: SendState) => void;
  /** Fired after the row is inserted and we know its server timestamps. */
  onSent?: (message: LocalMessage) => void;
  /** Fired once translation is written back. */
  onTranslated?: (message: LocalMessage) => void;
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
 * Step 2 only: insert the row and resolve when the server has it. A duplicate
 * key counts as success, which is exactly what makes retry safe.
 */
async function insertMessage(row: LocalMessage): Promise<LocalMessage> {
  if (!isSupabaseConfigured) {
    return { ...row, sendState: 'sent', created_at: new Date().toISOString() };
  }

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
        translation_status: row.translation_status,
      })
      .select()
      .single(),
    INSERT_TIMEOUT_MS,
    'The message could not be sent.'
  );

  if (error) {
    if (error.code === '23505') {
      // A previous attempt with this UUID already landed. Fetch it so the UI
      // can adopt the real timestamps.
      const { data: existing } = await requireSupabase()
        .from('messages')
        .select('*')
        .eq('id', row.id)
        .maybeSingle();
      if (existing) return { ...existing, sendState: 'sent' };
    }
    throw error;
  }

  return { ...data, sendState: 'sent' };
}

/**
 * Step 3: translate, then write the outcome back onto the same row. The
 * original text is never touched.
 */
async function applyTranslation(row: LocalMessage): Promise<LocalMessage> {
  const result = await translateWithStatus(
    row.original_text,
    row.target_language,
    row.source_language
  );

  const status: TranslationStatus = result.status;
  const translatedText = status === 'translated' ? result.text : null;

  if (!isSupabaseConfigured) {
    return {
      ...row,
      translated_text: translatedText,
      translation_status: status,
      sendState: 'sent',
    };
  }

  const { data, error } = await requireSupabase()
    .from('messages')
    .update({ translated_text: translatedText, translation_status: status })
    .eq('id', row.id)
    .select()
    .single();

  if (error) {
    // The message itself is safely stored. Surface a genuine "couldn't
    // translate" rather than pretending it worked.
    console.warn('Could not record translation result', error.message);
    return {
      ...row,
      translated_text: null,
      translation_status: 'failed',
      sendState: 'sent',
    };
  }

  return { ...data, sendState: 'sent' };
}

/**
 * Runs the full pipeline. Returns as soon as the optimistic row exists so the
 * composer can clear instantly; the rest settles in the background.
 */
export function sendMessage(input: NewMessageInput, callbacks: SendCallbacks): SendHandle {
  const id = input.id ?? Crypto.randomUUID();
  const pending = optimisticMessage(input, id, new Date().toISOString());

  callbacks.onPending(pending);

  const sent = (async () => {
    try {
      const inserted = await insertMessage(pending);
      callbacks.onStateChange(id, 'sent');
      callbacks.onSent?.(inserted);
    } catch (error) {
      console.warn('Send failed', error);
      callbacks.onStateChange(id, 'failed');
      throw error;
    }
  })();

  // A rejected `sent` must not surface as an unhandled rejection; the caller
  // sees the failure through onStateChange and the retry affordance.
  const guarded = sent.catch(() => undefined);

  void (async () => {
    const inserted = await sent.catch(() => null);
    if (!inserted) return;
    try {
      const finished = await applyTranslation(inserted);
      callbacks.onTranslated?.(finished);
    } catch (error) {
      console.warn('Translation step failed', error);
    }
  })();

  return { id, sent: guarded };
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
    const previous = byId.get(row.id);
    if (!previous) {
      byId.set(row.id, { ...row, sendState: 'sent' });
      changed = true;
      continue;
    }
    // Keep the optimistic sendState: the server has no idea it was "sending".
    const merged: LocalMessage = { ...previous, ...row, sendState: previous.sendState ?? 'sent' };
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
 * Re-runs the translation for a message that came back `failed`.
 *
 * The message itself is intact — only the translation is missing — so this
 * reuses the row and never re-sends anything. Returns the updated row, or null
 * if the retry failed again, so the caller can put the message back to `failed`
 * rather than pretending it is still in progress.
 */
export async function retryTranslation(message: Message): Promise<Message | null> {
  try {
    const updated = await applyTranslation({ ...message, sendState: 'sent' });
    return updated.translation_status === 'translated' ? updated : null;
  } catch (error) {
    console.warn('Translation retry failed', error);
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
  } catch (error) {
    console.warn('Could not delete the message', error);
  }
}

function sameMessage(a: LocalMessage, b: LocalMessage): boolean {
  return (
    a.translation_status === b.translation_status &&
    a.translated_text === b.translated_text &&
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
