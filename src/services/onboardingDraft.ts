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

const STORAGE_KEY = 'melo.onboarding.draft.v1';

export interface OnboardingDraft {
  /** Set by the language screen. */
  readingLanguage?: string;
  /** Set by the name screen. */
  displayName?: string;
}

export async function saveDraft(patch: OnboardingDraft): Promise<void> {
  const current = (await loadDraft()) ?? {};
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function loadDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingDraft;
  } catch (error) {
    console.warn('Could not read the onboarding draft', error);
    return null;
  }
}

/** Called once the profile exists, so a later crash cannot resurrect a draft. */
export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
