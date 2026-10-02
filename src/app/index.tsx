/** Choose onboarding, resume its final step, or open Chats from persisted state. */
import { Redirect } from 'expo-router';

import { useProfile } from '@/hooks/useProfile';

export default function Index() {
  const { loading, profile, onboardingComplete } = useProfile();

  if (loading) return null;
  if (!profile) return <Redirect href="/onboarding/welcome" />;
  return <Redirect href={onboardingComplete ? '/chats' : '/onboarding/id'} />;
}
