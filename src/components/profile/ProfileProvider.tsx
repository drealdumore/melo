/**
 * Owns the app's single profile instance. Mounted once in the root layout.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createProfile, loadProfile, updateProfile, type LocalIdentity } from '@/services/profile';
import { clearDraft } from '@/services/onboardingDraft';
import { ProfileContext, type ProfileContextValue } from '@/hooks/useProfile';
import type { Profile } from '@/types/models';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const stored = await loadProfile();
    setProfile(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Reading the stored profile is an external-system read, so the state
    // update lands in the callback rather than synchronously in the effect.
    void loadProfile().then((stored) => {
      if (cancelled) return;
      setProfile(stored);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const create = useCallback(
    async (identity: LocalIdentity, input: { displayName: string; readingLanguage: string }) => {
      const created = await createProfile(identity, input);
      // The profile now carries these answers, so the draft has done its job.
      await clearDraft();
      setProfile(created);
      return created;
    },
    []
  );

  const update = useCallback(
    async (changes: { displayName?: string; readingLanguage?: string }) => {
      if (!profile) throw new Error('No profile yet.');
      const next = await updateProfile(profile, changes);
      setProfile(next);
      return next;
    },
    [profile]
  );

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      loading,
      needsOnboarding: !loading && profile === null,
      create,
      update,
      reload,
    }),
    [profile, loading, create, update, reload]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}
