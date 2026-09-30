/**
 * Profile identity for the MVP.
 *
 * Identity lives on the device: a user UUID and a Melo ID generated with
 * `expo-crypto`, mirrored into AsyncStorage and upserted into `profiles`.
 * Uninstalling loses both. See supabase/README.md → Phase 10.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { requireSupabase, isSupabaseConfigured } from '@/services/supabase';
import type { Profile } from '@/types/models';
import type { TableUpdate } from '@/types/database';

const STORAGE_KEY = 'melo.profile.v1';
/**
 * Identity is written as soon as it is drawn, separately from the profile row.
 * That way the Melo ID screen can show a stable ID while the profile is still
 * saving, and a retry reuses the same UUID rather than orphaning a half-made
 * user.
 */
const IDENTITY_KEY = 'melo.identity.v1';

export const MELO_ID_LENGTH = 11;
/**
 * Lowercase a–z and 2–9 only. Excluding 0/o/1/l/i kills the usual
 * read-aloud and typo confusions. No hyphens: `-` separates the two Melo IDs
 * inside a room id.
 */
const MELO_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const MELO_ID_PATTERN = /^[a-z2-9]{11}$/;

export class MeloIdTakenError extends Error {
  constructor() {
    super('That Melo ID is already taken.');
    this.name = 'MeloIdTakenError';
  }
}

export function isValidMeloId(value: string): boolean {
  return MELO_ID_PATTERN.test(value);
}

/** Normalises whatever the user typed or pasted into a candidate Melo ID. */
export function normalizeMeloId(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

/** Draws `length` characters uniformly from the alphabet using CSPRNG bytes. */
function randomMeloId(length: number): string {
  const bytes = Crypto.getRandomBytes(length * 2);
  let out = '';
  // Reject the tail of the byte range that would bias the modulo.
  const limit = 256 - (256 % MELO_ID_ALPHABET.length);
  let i = 0;
  while (out.length < length) {
    if (i >= bytes.length) break;
    const b = bytes[i] as number;
    i += 1;
    if (b >= limit) continue;
    out += MELO_ID_ALPHABET[b % MELO_ID_ALPHABET.length];
  }
  // Astronomically unlikely, but never return a short ID.
  while (out.length < length) out += MELO_ID_ALPHABET[0] as string;
  return out;
}

/** The two identifiers, drawn before the profile row exists. */
export interface LocalIdentity {
  id: string;
  meloId: string;
}

export async function saveIdentity(identity: LocalIdentity): Promise<void> {
  await AsyncStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
}

export async function loadIdentity(): Promise<LocalIdentity | null> {
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalIdentity;
    if (!parsed?.id || !isValidMeloId(parsed.meloId ?? '')) return null;
    return parsed;
  } catch (error) {
    console.warn('Could not read the saved identity', error);
    return null;
  }
}

export async function clearIdentity(): Promise<void> {
  await AsyncStorage.removeItem(IDENTITY_KEY);
}

/**
 * Returns the device's identity, drawing it the first time.
 *
 * Draw-then-persist means the ID the user is looking at is the ID that gets
 * used, even if the upsert that follows has to be retried.
 */
export async function loadOrCreateIdentity(): Promise<LocalIdentity> {
  const existing = await loadIdentity();
  if (existing) return existing;

  const identity: LocalIdentity = { id: Crypto.randomUUID(), meloId: randomMeloId(MELO_ID_LENGTH) };
  await saveIdentity(identity);
  return identity;
}

async function insertProfileWithUniqueMeloId(
  identity: LocalIdentity,
  base: { id: string; display_name: string; reading_language: string },
  attempts = 5
): Promise<Profile> {
  const client = requireSupabase();
  let lastError: unknown = null;
  // Start from the ID the user has already been shown. Redrawing must never
  // silently swap the identity out from under them — the caller re-reads
  // `melo_id` off the returned row so the screen can never disagree with it.
  let meloId = identity.meloId;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const { data, error } = await client
      .from('profiles')
      .upsert({ ...base, melo_id: meloId })
      .select()
      .single();

    if (!error && data) return data;

    // 23505 = unique_violation. Only the melo_id unique index is reachable
    // here, so a collision means "draw again" — and because the upsert is keyed
    // on our own UUID, redrawing cannot create a second profile.
    if (error.code === '23505') {
      lastError = error;
      meloId = randomMeloId(MELO_ID_LENGTH);
      await saveIdentity({ id: base.id, meloId });
      continue;
    }
    throw error;
  }

  console.warn('Melo ID generation failed after', attempts, 'attempts', lastError);
  throw new MeloIdTakenError();
}

/**
 * Creates the profile row for a known identity.
 *
 * This is what the Melo ID screen calls once the user has seen their ID: the ID
 * is already ours, so the only work left is to write the row and keep the local
 * copy in step.
 */
export async function createProfile(
  identity: LocalIdentity,
  input: { displayName: string; readingLanguage: string }
): Promise<Profile> {
  const displayName = input.displayName.trim().slice(0, 30);
  if (displayName.length < 1) throw new Error('Display name is required.');

  const base = {
    id: identity.id,
    display_name: displayName,
    reading_language: input.readingLanguage,
  };

  if (!isSupabaseConfigured) {
    // Offline/dev fallback so the flow is still explorable without a backend.
    const local: Profile = {
      ...base,
      melo_id: identity.meloId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await saveProfile(local);
    return local;
  }

  const profile = await insertProfileWithUniqueMeloId(identity, base);
  // A collision redraw means the local copy can disagree with the row, so the
  // row wins and the caller adopts `profile.melo_id` for anything it displays.
  await saveIdentity({ id: profile.id, meloId: profile.melo_id });
  await saveProfile(profile);
  return profile;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed?.id || !isValidMeloId(parsed.melo_id ?? '')) return null;
    return parsed;
  } catch (error) {
    console.warn('Could not read the saved profile', error);
    return null;
  }
}

export async function updateProfile(
  profile: Profile,
  changes: { displayName?: string; readingLanguage?: string }
): Promise<Profile> {
  const patch: TableUpdate<'profiles'> = {};
  if (changes.displayName !== undefined) {
    const name = changes.displayName.trim().slice(0, 30);
    if (name.length < 1) throw new Error('Display name is required.');
    patch.display_name = name;
  }
  if (changes.readingLanguage !== undefined) patch.reading_language = changes.readingLanguage;

  let next: Profile = { ...profile, ...stripUndefined(patch) } as Profile;

  if (isSupabaseConfigured && Object.keys(patch).length > 0) {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)
      .select()
      .single();
    if (error) throw error;
    if (data) next = data;
  }

  await saveProfile(next);
  return next;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function findProfileByMeloId(meloId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('melo_id', meloId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
