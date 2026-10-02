/**
 * Owns the app's single profile instance. Mounted once in the root layout.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { createProfile, loadProfile, saveProfile, syncProfileFromServer, updateProfile, clearIdentity, type LocalIdentity } from '@/services/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearDraft } from '@/services/onboardingDraft';
import { ProfileContext, type ProfileContextValue } from '@/hooks/useProfile';
import { createLogger } from '@/services/logger';
import type { Profile } from '@/types/models';

const log = createLogger('profile');
const ONBOARDING_COMPLETE_KEY = 'melo.onboarding.complete.v1';

async function loadOnboardingComplete(profile: Profile | null): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return profile !== null;
  } catch (error) {
    log.error('could not read onboarding completion state', error);
    return profile !== null;
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const profileGeneration = useRef(0);

  const reload = useCallback(async () => {
    const generation = ++profileGeneration.current;
    const stored = await loadProfile();
    const completed = await loadOnboardingComplete(stored);
    if (generation !== profileGeneration.current) return;
    setProfile(stored);
    setOnboardingComplete(completed);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const generation = profileGeneration.current;
    void (async () => {
      const stored = await loadProfile();
      const completed = await loadOnboardingComplete(stored);
      if (cancelled || generation !== profileGeneration.current) return;
      // Render from the device copy first and reconcile afterwards. Holding the
      // first paint on a network round trip would make every cold start feel
      // broken, and the stored profile is right almost every time.
      setProfile(stored);
      setOnboardingComplete(completed);
      setLoading(false);
      if (!stored) return;

      try {
        const result = await syncProfileFromServer(stored);
        if (cancelled || generation !== profileGeneration.current) return;
        if (result.outcome === 'ok' && result.changed.length > 0) {
          await saveProfile(result.profile);
          if (cancelled || generation !== profileGeneration.current) return;
          setProfile(result.profile);
        }
      } catch (error) {
        // A failed sync must not cost the user their session: the device copy is
        // still the best thing we have.
        log.warn('could not reconcile the profile with the server', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const create = useCallback(
    async (
      identity: LocalIdentity,
      input: { displayName: string; readingLanguage: string; avatarKey?: string | null }
    ) => {
      const generation = ++profileGeneration.current;
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'false');
      if (generation !== profileGeneration.current) {
        throw new Error('Profile creation was superseded by a newer profile action.');
      }
      setOnboardingComplete(false);
      const created = await createProfile(identity, input);
      if (generation !== profileGeneration.current) {
        throw new Error('Profile creation was superseded by a newer profile action.');
      }
      // The profile now carries these answers, so the draft has done its job.
      await clearDraft();
      if (generation !== profileGeneration.current) {
        throw new Error('Profile creation was superseded by a newer profile action.');
      }
      setProfile(created);
      return created;
    },
    []
  );

  const completeOnboarding = useCallback(async () => {
    const currentProfile = profile ?? await loadProfile();
    if (!currentProfile) throw new Error('Cannot complete onboarding without a profile.');
    await clearDraft();
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setOnboardingComplete(true);
  }, [profile]);

  const update = useCallback(
    async (changes: { displayName?: string; readingLanguage?: string; avatarKey?: string | null }) => {
      if (!profile) throw new Error('No profile yet.');
      const generation = profileGeneration.current;
      const next = await updateProfile(profile, changes);
      if (generation !== profileGeneration.current) return next;
      setProfile(next);
      return next;
    },
    [profile]
  );

  const reset = useCallback(async () => {
    const generation = ++profileGeneration.current;
    await clearIdentity();
    await AsyncStorage.removeItem('melo.profile.v1');
    await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
    await clearDraft();
    if (generation !== profileGeneration.current) return;
    setProfile(null);
    setOnboardingComplete(false);
    setLoading(false);
  }, []);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading,
      onboardingComplete,
      needsOnboarding: !loading && profile === null,
      create,
      completeOnboarding,
      update,
      reload,
      reset,
    }),
    [profile, loading, onboardingComplete, create, completeOnboarding, update, reload, reset]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
