/**
 * The one place the local profile is read. `<ProfileProvider>` (in
 * components/profile) owns the single instance, so editing your name in the
 * profile sheet is instantly visible to the Chats list with no cache to bust.
 */
import { createContext, useContext } from 'react';

import type { Profile } from '@/types/models';
import type { LocalIdentity } from '@/services/profile';

export interface ProfileContextValue {
  profile: Profile | null;
  /** True until we have read AsyncStorage. */
  loading: boolean;
  /** True after the user confirms the final onboarding step. */
  onboardingComplete: boolean;
  /** True once we know for certain there is no profile, i.e. show onboarding. */
  needsOnboarding: boolean;
  /** Writes the profile row for an identity that was already drawn and shown. */
  create: (
    identity: LocalIdentity,
    input: { displayName: string; readingLanguage: string; avatarKey?: string | null }
  ) => Promise<Profile>;
  /** Marks onboarding complete after the user confirms their Melo ID. */
  completeOnboarding: () => Promise<void>;
  update: (
    changes: { displayName?: string; readingLanguage?: string; avatarKey?: string | null }
  ) => Promise<Profile>;
  reload: () => Promise<void>;
  /** Wipes the local identity and profile, sending the user back to onboarding. */
  reset: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfile must be used inside <ProfileProvider>.');
  return value;
}
