/**
 * Rooms.
 *
 * A room id is derived, never generated: `sorted(meloA, meloB).join('-')`.
 * That makes A+B and B+A land on the identical row, so two people who both
 * tap "Start Chat" at the same time cannot create two rooms. Creation is
 * client-side and race-safe with `on conflict do nothing` followed by a select.
 */
import { requireSupabase, isSupabaseConfigured } from '@/services/supabase';
import { findProfileByMeloId, normalizeMeloId, isValidMeloId, MELO_ID_LENGTH } from '@/services/profile';
import type { ConnectResult, Profile, Room } from '@/types/models';
import type { TableRow } from '@/types/database';

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

  const { error: insertError } = await requireSupabase()
    .from('rooms')
    .upsert(
      { id: roomId, user_one_id: userOneId, user_two_id: userTwoId },
      { onConflict: 'id', ignoreDuplicates: true }
    );

  // 23505 just means the other device won the race, which is a success for us.
  if (insertError && insertError.code !== '23505') throw insertError;

  const room = await findRoom(roomId);
  if (!room) throw new Error('Could not open the room. Try again.');
  return room;
}

/**
 * The Connect screen's single entry point. Distinguishes "no such person" from
 * "that is you" from "something broke" so the UI can say which.
 */
export async function connectWithMeloId(me: Profile, rawMeloId: string): Promise<ConnectResult> {
  const meloId = normalizeMeloId(rawMeloId);
  if (!isValidMeloId(meloId) || meloId.length !== MELO_ID_LENGTH) {
    return { ok: false, reason: 'not_found' };
  }
  if (meloId === me.melo_id) return { ok: false, reason: 'self' };

  try {
    const friend = await findProfileByMeloId(meloId);
    if (!friend) return { ok: false, reason: 'not_found' };
    if (friend.id === me.id) return { ok: false, reason: 'self' };

    const room = await createOrFindRoom(me, friend);
    return { ok: true, roomId: room.id };
  } catch (error) {
    console.error('connectWithMeloId failed', error);
    return { ok: false, reason: 'unknown' };
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
  if (!rooms?.length) return [];

  const friendIds = rooms.map((room) =>
    room.user_one_id === me.id ? room.user_two_id : room.user_one_id
  );

  const { data: friends, error: friendsError } = await requireSupabase()
    .from('profiles')
    .select('*')
    .in('id', friendIds);
  if (friendsError) throw friendsError;

  const byId = new Map((friends ?? []).map((p: Profile) => [p.id, p]));
  return rooms.flatMap((room: TableRow<'rooms'>) => {
    const friendId = room.user_one_id === me.id ? room.user_two_id : room.user_one_id;
    const friend = byId.get(friendId);
    return friend ? [{ room, friend }] : [];
  });
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
