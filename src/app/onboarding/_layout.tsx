import { Redirect, Slot } from 'expo-router';

import { useProfile } from '@/hooks/useProfile';

export default function OnboardingLayout() {
  const { loading, profile, onboardingComplete } = useProfile();

  if (loading) return null;
  if (profile && onboardingComplete) return <Redirect href="/chats" />;

  return <Slot />;
}
