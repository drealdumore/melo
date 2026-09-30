/**
 * Entry point. No profile means onboarding; a profile means Chats. This screen
 * exists only to make that decision, so it never renders anything itself.
 */
import { Redirect } from 'expo-router';

import { useProfile } from '@/hooks/useProfile';

export default function Index() {
  const { loading, profile } = useProfile();

  if (loading) return null;
  return <Redirect href={profile ? '/chats' : '/onboarding/welcome'} />;
}
