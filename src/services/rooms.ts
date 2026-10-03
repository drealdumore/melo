/**
 * Rooms.
 *
 * A room id is derived, never generated: `sorted(meloA, meloB).join('-')`.
 * That makes A+B and B+A land on the identical row, so two people who both
 * tap "Start Chat" at the same time cannot create two rooms. Creation is
 * client-side and race-safe with `on conflict do nothing` followed by a select.
 */
import { requireSupabase, isSupabaseConfigured } from '@/services/supabase';
import { findProfileByMeloId, normalizeMeloId, isValidMeloId, MELO_ID_MIN_LENGTH, MELO_ID_MAX_LENGTH } from '@/services/profile';
import { createLogger } from '@/services/logger';
import type { ConnectResult, Profile, Room } from '@/types/models';
import type { TableRow } from '@/types/database';

const log = createLogger('rooms');

export const ROOM_ID_SEPARATOR = '-';

/** `sorted(meloA, meloB).join('-')`. Order never matters. */
export function roomIdFor(meloA: string, meloB: string): string {
  return [meloA, meloB].sort().join(ROOM_ID_SEPARATOR);
}

/** Splits a room id back into the two Melo IDs that form it. */
export function parseRoomId(roomId: string): [string, string] | null {
  const parts = roomId.split(ROOM_ID_SEPARATOR);
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!a || !b) return null;
  return [a, b];
}

export function isRoomId(value: string): boolean {
  const parsed = parseRoomId(value);
  return parsed !== null && parsed.every(isValidMeloId);
}

/** The two user UUIDs are always written in sorted order too. */
function orderedUserIds(idA: string, idB: string): [string, string] {
  return [idA, idB].sort() as [string, string];
}

export async function findRoom(roomId: string): Promise<Room | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await requireSupabase()
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw error;
  log.debug(data ? `room ${roomId} exists` : `room ${roomId} does not exist yet`);
  return data;
}

/**
 * Idempotent room creation. Two devices calling this simultaneously produce one
 * row, because the second INSERT collides on the primary key and is dropped.
 */
export async function createOrFindRoom(
  me: Profile,
  friend: Profile
): Promise<Room> {
  if (me.id === friend.id) throw new Error('Cannot open a room with yourself.');
  if (!isSupabaseConfigured) {
    return {
      id: roomIdFor(me.melo_id, friend.melo_id),
      user_one_id: me.id,
      user_two_id: friend.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const roomId = roomIdFor(me.melo_id, friend.melo_id);
  const [userOneId, userTwoId] = orderedUserIds(me.id, friend.id);
  log.info(`opening room ${roomId}`, { with: friend.display_name });

  const { error: insertError } = await requireSupabase()
    .from('rooms')
    .upsert(
      { id: roomId, user_one_id: userOneId, user_two_id: userTwoId },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  // 23505 just means the other device won the race, which is a success for us.
  if (insertError && insertError.code !== '23505') {
    log.error(`could not create room ${roomId}`, insertError);
    throw insertError;
  }
  if (insertError) log.debug(`room ${roomId} already existed; reusing it`);

  const room = await findRoom(roomId);
  if (!room) {
    log.error(`room ${roomId} is missing immediately after being created`);
    throw new Error('Could not open the room. Try again.');
  }
  return room;
}

/**
 * The Connect screen's single entry point. Distinguishes "no such person" from
 * "that is you" from "something broke" so the UI can say which.
 */
export async function connectWithMeloId(me: Profile, rawMeloId: string): Promise<ConnectResult> {
  const meloId = normalizeMeloId(rawMeloId);
  if (!isValidMeloId(meloId) || meloId.length < MELO_ID_MIN_LENGTH || meloId.length > MELO_ID_MAX_LENGTH) {
    // Normalized rather than raw: the shape of what was typed is the useful
    // part, and this is whatever the user pasted in, not a secret.
    log.info(`connect rejected: "${meloId}" is not a valid Melo ID`, {
      typedLength: rawMeloId.length,
      normalizedLength: meloId.length,
      expected: `${MELO_ID_MIN_LENGTH}-${MELO_ID_MAX_LENGTH} characters`,
    });
    return { ok: false, reason: 'not_found' };
  }
  if (meloId === me.melo_id) {
    log.info(`connect rejected: ${meloId} is this user's own ID`);
    return { ok: false, reason: 'self' };
  }

  try {
    const friend = await findProfileByMeloId(meloId);
    if (!friend) {
      log.info(`connect failed: no profile has Melo ID ${meloId}`);
      return { ok: false, reason: 'not_found' };
    }
    if (friend.id === me.id) {
      log.info(`connect failed: ${meloId} is this user's own ID on another device`);
      return { ok: false, reason: 'self' };
    }

    const room = await createOrFindRoom(me, friend);
    log.info(`connect ok: ${meloId} (${friend.display_name}) → room ${room.id}`);
    return { ok: true, roomId: room.id };
  } catch (error) {
    log.error(`connect failed: ${meloId} hit an unexpected error`, error);
    return { ok: false, reason: 'unknown', error };
  }
}

/** Every room the user is part of, paired with the other profile. */
export async function listChats(me: Profile): Promise<{ room: Room; friend: Profile }[]> {
  if (!isSupabaseConfigured) return [];

  const { data: rooms, error } = await requireSupabase()
    .from('rooms')
    .select('*')
    .or(`user_one_id.eq.${me.id},user_two_id.eq.${me.id}`);
  if (error) throw error;
  if (!rooms?.length) {
    log.info('no chats yet');
    return [];
  }

  const friendIds = rooms.map((room) =>
    room.user_one_id === me.id ? room.user_two_id : room.user_one_id
  );

  const { data: friends, error: friendsError } = await requireSupabase()
    .from('profiles')
    .select('*')
    .in('id', friendIds);
  if (friendsError) throw friendsError;

  const byId = new Map((friends ?? []).map((p: Profile) => [p.id, p]));
  const chats = rooms.flatMap((room: TableRow<'rooms'>) => {
    const friendId = room.user_one_id === me.id ? room.user_two_id : room.user_one_id;
    const friend = byId.get(friendId);
    return friend ? [{ room, friend }] : [];
  });

  // A room whose partner profile is missing is a real data problem, and it is
  // invisible in the UI: the chat just silently does not appear.
  const orphans = rooms.length - chats.length;
  if (orphans > 0) {
    log.warn(`${orphans} room(s) have a partner profile this client cannot read`, {
      rooms: rooms.length,
      shown: chats.length,
      cause: 'likely row-level security, or a profile that was deleted',
    });
  }
  log.info(`loaded ${chats.length} chat(s)`);
  return chats;
}

/** The other participant of a room. */
export async function getRoomPartner(room: Room, me: Profile): Promise<Profile | null> {
  const friendId = room.user_one_id === me.id ? room.user_two_id : room.user_one_id;
  if (!isSupabaseConfigured) return null;

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('id', friendId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
