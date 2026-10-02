/**
 * The onboarding draft.
 *
 * The language and name screens each save their answer as soon as the user
 * commits it, before the profile exists. Without this, backing out of the ID
 * screen would throw the answers away and ask again.
 *
 * Deliberately separate from `melo.profile.v1`: the draft is throwaway local
 * state, the profile is identity.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger } from '@/services/logger';

const STORAGE_KEY = 'melo.onboarding.draft.v1';

const log = createLogger('onboarding');

export interface OnboardingDraft {
  /** Set by the language screen. */
  readingLanguage?: string;
  /** Set by the name screen. */
  displayName?: string;
  /** Set by the avatar screen. `null` means initials, and is a real choice. */
  avatarKey?: string | null;
}

export async function saveDraft(patch: OnboardingDraft): Promise<void> {
  const current = (await loadDraft()) ?? {};
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  log.debug('draft saved', { fields: Object.keys(patch) });
}

export async function loadDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingDraft;
  } catch (error) {
    // Non-fatal: the user just gets asked the question again. Logged anyway,
    // because a draft that keeps failing to parse means the writes are broken
    // too, and every answer is silently being forgotten.
    log.warn('could not read the onboarding draft; the user will be asked again', error);
    return null;
  }
}

/** Called once the profile exists, so a later crash cannot resurrect a draft. */
export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
