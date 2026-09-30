/**
 * Step 3: your Melo ID, and the moment the profile is created.
 *
 * Styled to match Image 1 & 2 reference images: High-impact hero ID card,
 * mono ID typography, quick copy & share buttons, mascot speech bubble ("You are all set!"),
 * and full-width continue CTA pill button.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { loadOrCreateIdentity, type LocalIdentity } from '@/services/profile';
import { loadDraft } from '@/services/onboardingDraft';

type SaveState =
  | { status: 'drafting' }
  | { status: 'saving'; identity: LocalIdentity }
  | { status: 'ready'; identity: LocalIdentity }
  | { status: 'failed'; identity: LocalIdentity; message: string };

export default function MeloIdScreen() {
  const { colors, typography, isDark, fontFamily } = useTheme();
  const router = useRouter();
  const { create } = useProfile();

  const [state, setState] = useState<SaveState>({ status: 'drafting' });
  const [copied, setCopied] = useState(false);

  const identityRef = useRef<LocalIdentity | null>(null);
  const draftRef = useRef<{ displayName?: string; readingLanguage?: string }>({});

  const save = useCallback(
    async (identity: LocalIdentity) => {
      setState({ status: 'saving', identity });
      try {
        const { displayName, readingLanguage } = draftRef.current;
        if (!displayName || !readingLanguage) {
          throw new Error('The onboarding draft is incomplete.');
        }
        const profile = await create(identity, { displayName, readingLanguage });
        const settled: LocalIdentity = { id: profile.id, meloId: profile.melo_id };
        identityRef.current = settled;
        setState({ status: 'ready', identity: settled });
      } catch (error) {
        console.error('Could not save the profile', error);
        setState({
          status: 'failed',
          identity,
          message:
            error instanceof Error && error.name === 'MeloIdTakenError'
              ? "We couldn't find a free Melo ID. Try again."
              : 'Something went wrong. Try again.',
        });
      }
    },
    [create]
  );

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      const [identity, draft] = await Promise.all([loadOrCreateIdentity(), loadDraft()]);
      if (cancelled) return;
      identityRef.current = identity;
      draftRef.current = { ...draft };
      await save(identity);
    })();

    return () => {
      cancelled = true;
    };
  }, [save]);

  const onRetry = useCallback(() => {
    const identity = identityRef.current;
    if (identity) void save(identity);
  }, [save]);

  const onShare = useCallback(async () => {
    if (state.status === 'drafting') return;
    try {
      await Share.share({
        message: `My Melo ID is ${state.identity.meloId}. Add me in Melo and we'll be talking across languages!`,
      });
    } catch (error) {
      console.warn('Share sheet dismissed', error);
    }
  }, [state]);

  const identity = state.status === 'drafting' ? null : state.identity;
  const saving = state.status === 'drafting' || state.status === 'saving';
  const failed = state.status === 'failed';

  const cardBg = isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface;
  const cardBorder = failed
    ? colors.danger
    : isDark
    ? 'rgba(255, 255, 255, 0.12)'
    : colors.border;

  return (
    <OnboardingScreen
      step={3}
      title="This is your Melo ID"
      subtitle="Send it to a friend. This is how they'll find you."
      onBack={() => router.back()}
      mascotMessage={failed ? undefined : 'You are all set! Share your ID to start chatting.'}
      footer={
        failed ? (
          <Button label="Try again" icon="retry" onPress={onRetry} testID="retry" />
        ) : (
          <Button
            label="Continue"
            onPress={() => router.replace('/connect')}
            disabled={saving}
            icon="arrowRight"
            testID="continue"
          />
        )
      }
      testID="id-screen"
    >
      <Animated.View
        entering={FadeInUp.duration(300)}
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
          },
        ]}
      >
        <Text style={[typography.label, styles.cardLabel, { color: colors.textMuted }]}>
          YOUR MELO ID
        </Text>

        {saving || !identity ? (
          <View style={styles.skeletonRow}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              Creating your Melo ID…
            </Text>
          </View>
        ) : (
          <Text
            accessibilityLabel={`Melo ID, ${identity.meloId.split('').join(' ')}`}
            style={[
              typography.monoId,
              styles.meloId,
              { color: colors.textPrimary, fontFamily: fontFamily.mono },
            ]}
          >
            {identity.meloId}
          </Text>
        )}

        <View style={styles.copyArea}>
          <CopyButton meloId={identity?.meloId ?? ''} onCopy={() => setCopied(true)} />
        </View>

        {failed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[typography.caption, styles.error, { color: colors.danger }]}
          >
            {state.status === 'failed' ? state.message : ''}
          </Text>
        ) : null}
      </Animated.View>

      <Text
        accessibilityLiveRegion="polite"
        style={[
          typography.caption,
          styles.status,
          { color: copied ? colors.success : colors.textMuted },
        ]}
      >
        {copied ? '✓ Copied to clipboard' : 'Tap above to copy'}
      </Text>

      <View style={styles.share}>
        <Button
          label="Share my ID"
          icon="share"
          variant="surface"
          onPress={() => void onShare()}
          disabled={saving}
        />
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 22,
    borderWidth: 1.5,
    borderRadius: 24,
    marginTop: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardLabel: { fontSize: 12, letterSpacing: 0.8 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  meloId: { textAlign: 'center', fontSize: 26, letterSpacing: 1.5 },
  copyArea: { alignSelf: 'stretch', marginTop: 4 },
  error: { textAlign: 'center' },
  status: { textAlign: 'center', marginTop: 10, minHeight: 18, fontSize: 13 },
  share: { marginTop: 16 },
});
