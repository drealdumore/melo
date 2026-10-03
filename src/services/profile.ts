/**
 * Profile identity for the MVP.
 *
 * Identity lives on the device: a user UUID and a Melo ID generated with
 * `expo-crypto`, mirrored into AsyncStorage and upserted into `profiles`.
 * Uninstalling loses both. See supabase/README.md → Phase 10.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import {
  isSupabaseConfigured,
  requireSupabase,
  SupabaseNotConfiguredError,
} from '@/services/supabase';
import { isAvatarKey } from '@/constants/avatars';
import { createLogger } from '@/services/logger';
import type { Profile } from '@/types/models';
import type { TableUpdate } from '@/types/database';

const log = createLogger('profile');

const STORAGE_KEY = 'melo.profile.v1';
/**
 * Identity is written as soon as it is drawn, separately from the profile row.
 * That way the Melo ID screen can show a stable ID while the profile is still
 * saving, and a retry reuses the same UUID rather than orphaning a half-made
 * user.
 */
const IDENTITY_KEY = 'melo.identity.v1';

export const MELO_ID_SUFFIX_LENGTH = 5;
/** Longest run of the display name that goes into the ID. */
export const MELO_ID_NAME_MAX = 6;
export const MELO_ID_MIN_LENGTH = 1 + MELO_ID_SUFFIX_LENGTH;
export const MELO_ID_MAX_LENGTH = MELO_ID_NAME_MAX + MELO_ID_SUFFIX_LENGTH;
/**
 * Shape only: a–z0–9, 6 to 11 characters.
 *
 * Deliberately loose about where the name ends and the suffix begins. The split
 * is unambiguous in practice because the suffix is always exactly
 * `MELO_ID_SUFFIX_LENGTH` characters, but a stricter pattern would be ambiguous
 * — in `abcde23456` there is no way to tell a 5-character name from a 4.
 *
 * This also still matches the 11-character purely-random IDs drawn before this
 * format existed, so nobody has to change the ID already on their card.
 */
const MELO_ID_PATTERN = /^[a-z0-9]{6,11}$/;

/**
 * The suffix alphabet. Excluding 0/o/1/l/i kills the usual read-aloud and typo
 * confusions, which matters far more here than anywhere else in the ID: this is
 * the part a human dictates or squints at across a table. No hyphens either —
 * `-` separates the two Melo IDs inside a room id (see `roomIdFor`).
 */
const MELO_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

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

/**
 * Splits an ID back into the name it was built from and its random suffix.
 * The suffix length is fixed, so this needs no pattern matching.
 */
export function splitMeloId(meloId: string): { name: string; suffix: string } | null {
  if (!isValidMeloId(meloId)) return null;
  return {
    name: meloId.slice(0, meloId.length - MELO_ID_SUFFIX_LENGTH),
    suffix: meloId.slice(-MELO_ID_SUFFIX_LENGTH),
  };
}

const COMBINING_MARKS = { from: 0x300, to: 0x36f };

function isCombiningMark(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= COMBINING_MARKS.from && code <= COMBINING_MARKS.to;
}

/**
 * The display name reduced to something an ID can carry: lowercase a-z0-9 with
 * spaces and punctuation dropped, so "Be Cool" -> "becool" and "Jose" -> "jose".
 *
 * Note the asymmetry with the suffix alphabet: `i`, `l` and `o` are *kept* here
 * even though the suffix drops them. Those letters are ambiguous to read, but
 * they are also someone's actual name, and a user who cannot get the ID they
 * expected is a worse outcome than a slightly misread character.
 */
export function slugifyName(displayName: string): string {
  // NFD splits an accented letter into its base letter plus a combining mark, so
  // the marks can be dropped and the base letters kept. Comparing code points
  // rather than using a regex character class keeps this source pure ASCII: a
  // literal combining-mark range is invisible in an editor, and if it were ever
  // mangled the failure mode is silently corrupted names rather than an error.
  const withoutMarks = displayName
    .normalize('NFD')
    .split('')
    .filter((char) => !isCombiningMark(char))
    .join('')
    .toLowerCase();

  return withoutMarks.replace(/[^a-z0-9]/g, '').slice(0, MELO_ID_NAME_MAX);
}

/** Draws `length` characters uniformly from the alphabet using CSPRNG bytes. */
function randomFrom(alphabet: string, length: number): string {
  const bytes = Crypto.getRandomBytes(length * 2);
  let out = '';
  // Reject the tail of the byte range that would bias the modulo.
  const limit = 256 - (256 % alphabet.length);
  let i = 0;
  while (out.length < length) {
    if (i >= bytes.length) break;
    const b = bytes[i] as number;
    i += 1;
    if (b >= limit) continue;
    out += alphabet[b % alphabet.length];
  }
  // Astronomically unlikely, but never return a short string.
  while (out.length < length) out += alphabet[0] as string;
  return out;
}

/**
 * Builds a Melo ID from the display name plus a random suffix, e.g. "Becool" →
 * `becool7f3k`.
 *
 * The suffix is what stops two people called Alex from colliding, and it is
 * regenerated on a uniqueness collision. Read the trade-off before changing
 * this: the Melo ID is the only credential the app has — there is no password
 * and no auth (see `supabase.ts`) — so anyone who can guess a Melo ID can open a
 * room with that person. A name-derived ID makes guessing a matter of typing a
 * name. That is the intended trade here: easy to say out loud, easy to recognise
 * in a list, weaker as a secret.
 */
export function deriveMeloId(displayName: string): string {
  let name = slugifyName(displayName);
  if (name.length === 0) {
    // A name made entirely of emoji or non-Latin script. There is no
    // transliteration here, so fall back to a random name-shaped prefix rather
    // than shipping a bare suffix that looks broken.
    name = randomFrom(MELO_ID_ALPHABET, 3);
    log.warn('the display name has no usable Latin characters; using a random ID prefix', {
      name: displayName,
      using: name,
    });
  }
  return `${name}${randomFrom(MELO_ID_ALPHABET, MELO_ID_SUFFIX_LENGTH)}`;
}

/**
 * A fresh suffix for an ID that is already taken.
 *
 * Only the suffix moves. Keeping the name half stable matters more than it looks:
 * the ID is on screen while the profile is still saving, so redrawing the whole
 * thing would visibly change the name the user is about to hand to a friend.
 */
export function redrawMeloSuffix(previousId: string): string {
  const suffix = randomFrom(MELO_ID_ALPHABET, MELO_ID_SUFFIX_LENGTH);
  const name = previousId.length > MELO_ID_SUFFIX_LENGTH
    ? previousId.slice(0, previousId.length - MELO_ID_SUFFIX_LENGTH)
    : '';
  return `${name}${suffix}`;
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
    if (!raw) {
      log.debug('no saved identity on this device');
      return null;
    }
    const parsed = JSON.parse(raw) as LocalIdentity;
    if (!parsed?.id || !isValidMeloId(parsed.meloId ?? '')) {
      log.warn('saved identity was malformed and has been ignored', { raw });
      return null;
    }
    return parsed;
  } catch (error) {
    log.warn('could not read the saved identity', error);
    return null;
  }
}

export async function clearIdentity(): Promise<void> {
  await AsyncStorage.removeItem(IDENTITY_KEY);
}

/**
 * Returns the device's identity, drawing it the first time.
 *
 * `displayName` only matters on the very first call, where it becomes the
 * readable half of the Melo ID. Draw-then-persist means the ID the user is
 * looking at is the ID that gets used, even if the upsert that follows has to be
 * retried.
 */
export async function loadOrCreateIdentity(displayName: string): Promise<LocalIdentity> {
  const existing = await loadIdentity();
  if (existing) {
    // Going back a step and editing the name does not re-roll the ID. That is
    // deliberate — the ID may already have been shared — but it means the ID can
    // stop matching the name, so say so rather than leaving it to be noticed.
    const parts = splitMeloId(existing.meloId);
    const expected = slugifyName(displayName);
    if (expected && parts && parts.name !== expected) {
      log.warn(`keeping the existing Melo ID "${existing.meloId}" even though the name now slugs to "${expected}"`, {
        reason: 'the ID is already fixed for this device; re-rolling it would orphan the chats under it',
      });
    }
    log.info('identity loaded from this device', {
      meloId: existing.meloId,
      uuid: existing.id.slice(0, 8),
    });
    return existing;
  }

  const identity: LocalIdentity = {
    id: Crypto.randomUUID(),
    meloId: deriveMeloId(displayName),
  };
  await saveIdentity(identity);
  // This is the "user created" moment: a brand new person exists on this device.
  log.info('drew a new identity for this device', {
    meloId: identity.meloId,
    uuid: identity.id.slice(0, 8),
    fromName: displayName,
  });
  return identity;
}

async function insertProfileWithUniqueMeloId(
  identity: LocalIdentity,
  base: { id: string; display_name: string; reading_language: string; avatar_key: string | null },
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
      const previous = meloId;
      meloId = redrawMeloSuffix(meloId);
      await saveIdentity({ id: base.id, meloId });
      log.warn(`Melo ID ${previous} was already taken; drew ${meloId} instead`, {
        attempt: attempt + 1,
        of: attempts,
        // With a name-derived ID the readable half is preserved, so this is a
        // much smaller change to the user than a full re-roll used to be.
        keptName: splitMeloId(meloId)?.name,
      });
      continue;
    }
    log.error(`profile upsert failed on attempt ${attempt + 1}/${attempts}`, error);
    throw error;
  }

  log.error(`Melo ID generation failed after ${attempts} attempts`, lastError);
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
  input: { displayName: string; readingLanguage: string; avatarKey?: string | null }
): Promise<Profile> {
  const displayName = input.displayName.trim().slice(0, 30);
  if (displayName.length < 1) throw new Error('Display name is required.');

  const base = {
    id: identity.id,
    display_name: displayName,
    reading_language: input.readingLanguage,
    // Null is a real choice ("use my initials"), not a missing value, so it is
    // written rather than defaulted. An unknown slug is dropped: the client
    // falls back to initials, and storing it would only spread the bad value.
    avatar_key: isAvatarKey(input.avatarKey) ? input.avatarKey : null,
  };

  if (!isSupabaseConfigured) {
    if (!__DEV__) throw new SupabaseNotConfiguredError();

    // Offline/dev fallback so the flow is still explorable without a backend.
    // This looks identical to a real signup from the outside, which is exactly
    // why it is a warn: the ID the user is about to share resolves to nothing.
    log.warn('creating a LOCAL-ONLY profile: Supabase is not configured, so nothing was written to the database', {
      meloId: identity.meloId,
      name: input.displayName,
      device: 'written',
      server: 'skipped',
    });
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
  log.info('profile created', {
    meloId: profile.melo_id,
    name: profile.display_name,
    reads: profile.reading_language,
    device: 'written',
    server: 'written',
    redrawn: profile.melo_id !== identity.meloId,
  });
  return profile;
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      log.debug('no profile on this device → onboarding');
      return null;
    }
    const parsed = JSON.parse(raw) as Profile;
    if (!parsed?.id || !isValidMeloId(parsed.melo_id ?? '')) {
      log.warn('saved profile was malformed and has been ignored', { raw });
      return null;
    }
    // Worth being blunt about: this is a device-local read with no server round
    // trip and no auth, so it cannot know the row still exists. The app will
    // happily show Chats for a profile that has since been deleted server-side,
    // and every write will then fail. Startup decides onboarding from this
    // return value alone (app/index.tsx), so the distinction matters.
    log.info(`resumed ${parsed.display_name} (${parsed.melo_id}) from this device`, {
      reads: parsed.reading_language,
      uuid: parsed.id.slice(0, 8),
      verifiedWithServer: false,
    });
    return parsed;
  } catch (error) {
    log.warn('could not read the saved profile', error);
    return null;
  }
}

export async function updateProfile(
  profile: Profile,
  changes: { displayName?: string; readingLanguage?: string; avatarKey?: string | null }
): Promise<Profile> {
  const patch: TableUpdate<'profiles'> = {};
  if (changes.displayName !== undefined) {
    const name = changes.displayName.trim().slice(0, 30);
    if (name.length < 1) throw new Error('Display name is required.');
    patch.display_name = name;
  }
  if (changes.readingLanguage !== undefined) patch.reading_language = changes.readingLanguage;
  if (changes.avatarKey !== undefined) {
    // Undefined means "leave it alone", null means "back to initials", and an
    // unrecognised slug is stored as null rather than persisted and re-read as
    // an empty circle forever.
    patch.avatar_key = isAvatarKey(changes.avatarKey) ? changes.avatarKey : null;
  }

  let next: Profile = { ...profile, ...stripUndefined(patch) } as Profile;
  // Where the change actually landed. "Saved" is not one thing here: without a
  // configured Supabase the edit exists only on this device and will vanish
  // with it, while the UI reports success either way.
  let server: 'written' | 'skipped' | 'unchanged' = isSupabaseConfigured ? 'written' : 'skipped';

  if (isSupabaseConfigured && Object.keys(patch).length > 0) {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)
      .select()
      .single();
    // A failure throws, so `server: 'written'` is only ever logged after the
    // row is confirmed back from the server.
    if (error) throw error;
    if (data) next = data;
  } else if (Object.keys(patch).length === 0) {
    server = 'unchanged';
  }

  await saveProfile(next);
  log.info('profile updated', {
    fields: Object.keys(patch),
    name: next.display_name,
    reads: next.reading_language,
    avatar: next.avatar_key ?? 'initials',
    device: 'written',
    server,
  });
  if (server === 'skipped') {
    log.warn('the profile edit was NOT written to the database; it is device-local only');
  }
  return next;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export type ProfileSyncResult =
  /** The server row was fetched; `changed` names the fields that differed. */
  | { outcome: 'ok'; profile: Profile; changed: string[] }
  /** No row answers to this identity's id or Melo ID. */
  | { outcome: 'missing' }
  /** No Supabase, so there is no server to reconcile against. */
  | { outcome: 'skipped' };

/**
 * Reconciles the device's copy of the profile with the server's.
 *
 * Without this the device is the only source of truth, permanently. `loadProfile`
 * reads AsyncStorage and never asks the server, so an edit made in the database —
 * or on another device — is invisible here, and the next `updateProfile` writes
 * the stale row straight back over it. That is fine for the fields this device
 * owns and wrong for everything else, which is the whole reason this exists.
 *
 * The lookup deliberately falls back to `melo_id`. Reconciling by `id` cannot
 * discover an `id` that was edited in the database, because the device only knows
 * the old one and asking for it finds nothing. `melo_id` is unique, indexed, and
 * is the identifier people actually share, so it is the one key that survives a
 * primary-key edit.
 *
 * The server wins. This device has no way to authenticate, so it has no standing
 * to override a row anyone else can also write. Persistence is left to the
 * caller so it can discard a stale result if the device identity was reset
 * while the server request was in flight.
 */
export async function syncProfileFromServer(local: Profile): Promise<ProfileSyncResult> {
  if (!isSupabaseConfigured) return { outcome: 'skipped' };

  const { data: byId, error: idError } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('id', local.id)
    .maybeSingle();

  if (idError) {
    // Not fatal: the Melo ID lookup below may still find the row, and a
    // transport error is not the same thing as a row that is gone.
    log.warn(`could not read profile ${local.id.slice(0, 8)} by id`, idError);
  }

  const server = byId ?? (await findProfileByMeloId(local.melo_id));
  if (!server) {
    log.error(`no profile row answers to ${local.melo_id} or ${local.id.slice(0, 8)}`, {
      cause:
        'the row was deleted, or its id and Melo ID were both edited. Every write from this device will now fail until it is reconciled.',
    });
    return { outcome: 'missing' };
  }

  const changed = (
    ['id', 'melo_id', 'display_name', 'reading_language', 'avatar_key'] as const
  ).filter((field) => (server[field] ?? null) !== (local[field] ?? null));

  if (changed.length > 0) {
    log.warn(`adopted the server profile over this device's copy: ${changed.join(', ')}`, {
      localUuid: local.id.slice(0, 8),
      serverUuid: server.id.slice(0, 8),
    });
  } else {
    log.debug(`profile ${server.id.slice(0, 8)} matches this device`, {
      meloId: server.melo_id,
      verifiedWithServer: true,
    });
  }

  return { outcome: 'ok', profile: server, changed };
}

export async function findProfileByMeloId(meloId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('melo_id', meloId)
    .maybeSingle();

  if (error) {
    log.error(`lookup for Melo ID ${meloId} failed`, error);
    throw error;
  }

  // A miss is the single most common cause of "that ID doesn't exist", so it is
  // logged at info with the exact id that was searched for.
  log.info(data ? `found ${data.display_name} (${meloId})` : `no profile has Melo ID ${meloId}`);
  return data;
}

export type RecoverResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'malformed' | 'not_found' | 'unconfigured' | 'lookup_failed' };

/**
 * Re-attaches this device to an account that already exists, so someone on a new
 * phone can get their old Melo ID and their chats back instead of being issued a
 * brand new identity.
 *
 * The Melo ID is the *only* credential — there is no password, no email, no
 * second factor — so whoever supplies a valid ID takes over that account. That
 * is the same property that makes the ID handable in person, and it is the main
 * cost of deriving IDs from names. Treat every successful call as
 * takeover-sensitive: it is logged at warn for that reason, not because it is
 * usually wrong.
 */
export async function recoverIdentity(rawMeloId: string): Promise<RecoverResult> {
  const meloId = normalizeMeloId(rawMeloId);

  if (!isValidMeloId(meloId)) {
    log.info(`recovery rejected: "${meloId}" is not a Melo ID`, {
      typedLength: rawMeloId.length,
      expected: `${MELO_ID_MIN_LENGTH}-${MELO_ID_MAX_LENGTH} characters, a–z0–9`,
    });
    return { ok: false, reason: 'malformed' };
  }

  if (!isSupabaseConfigured) {
    // Recovery is a server lookup by definition; there is nothing to search.
    log.error('recovery is impossible: Supabase is not configured');
    return { ok: false, reason: 'unconfigured' };
  }

  const profile = await findProfileByMeloId(meloId);
  if (!profile) {
    log.info(`recovery failed: no profile has Melo ID ${meloId}`);
    return { ok: false, reason: 'not_found' };
  }

  // A device that already holds a *different* identity is discarding it. That is
  // the case where someone reinstalls and clobbers an account they still had, so
  // it is worth its own line rather than being buried in the success log.
  const previous = await loadIdentity();
  if (previous && previous.id !== profile.id) {
    log.warn(`this device is replacing identity ${previous.meloId} with ${meloId}`, {
      discardedUuid: previous.id.slice(0, 8),
      adoptingUuid: profile.id.slice(0, 8),
    });
  }

  await saveIdentity({ id: profile.id, meloId: profile.melo_id });
  await saveProfile(profile);
  log.warn(`recovered ${profile.display_name} (${profile.melo_id}) onto this device`, {
    uuid: profile.id.slice(0, 8),
    reads: profile.reading_language,
    replacing: previous?.meloId ?? null,
  });
  return { ok: true, profile };
}
