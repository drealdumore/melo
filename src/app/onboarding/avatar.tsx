
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { AvatarGrid } from '@/components/profile/AvatarGrid';
import { Button } from '@/components/ui/Button';
import { AVATAR_KEYS, isAvatarKey, type AvatarKey } from '@/constants/avatars';
import { loadDraft, saveDraft } from '@/services/onboardingDraft';
import { createLogger } from '@/services/logger';

const log = createLogger('onboarding.avatar');

export default function AvatarScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<AvatarKey | null>(AVATAR_KEYS[0] ?? null);
  const [ready, setReady] = useState(false);

  // The initials tile previews real initials, so it needs the name the previous
  // step just collected.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await loadDraft();
      if (cancelled) return;
      setName(draft?.displayName ?? '');
      const stored = draft?.avatarKey;
      if (isAvatarKey(stored)) {
        setChosen(stored);
      } else if (stored === null) {
        setChosen(null);
      } else if (stored != null) {
        log.warn('stored avatar is not in this build; using initials', { stored });
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const continueWith = useCallback(async (avatarKey: AvatarKey | null) => {
    await saveDraft({ avatarKey });
    log.info('avatar chosen', { avatarKey: avatarKey ?? 'initials' });
    router.push('/onboarding/id');
  }, [router]);

  return (
    <OnboardingScreen
      step={3}
      eyebrow="Make it yours"
      title="choose your profile picture"
      subtitle="make it easy for friends to spot you."
      onBack={() => router.back()}
      footer={
        <Button
          label="Next"
          onPress={() => void continueWith(chosen)}
          disabled={!ready}
          testID="continue"
        />
      }
      testID="avatar-screen"
    >
      <AvatarGrid
        name={name}
        value={chosen}
        onChange={setChosen}
      />
    </OnboardingScreen>
  );
}
