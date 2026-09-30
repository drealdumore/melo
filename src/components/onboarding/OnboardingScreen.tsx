/**
 * The frame every onboarding step shares: a circular back button, a segmented progress
 * bar that grows as you go, an ambient glowing background, a scrollable body, 
 * an optional mascot speech bubble, and a primary action pinned above the home indicator.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { AmbientGlow } from '@/components/ui/AmbientGlow';
import { Mascot } from '@/components/ui/Mascot';

export interface OnboardingScreenProps {
  /** 1 of 3, 2 of 3, 3 of 3. */
  step: number;
  totalSteps?: number;
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Pinned to the bottom. */
  footer: ReactNode;
  children: ReactNode;
  /** Optional speech bubble message from Melo mascot at the bottom of the screen. */
  mascotMessage?: string;
  /** Lifts the footer clear of the keyboard. Off for the language step. */
  avoidKeyboard?: boolean;
  testID?: string;
}

export function OnboardingScreen({
  step,
  totalSteps = 3,
  title,
  subtitle,
  onBack,
  footer,
  children,
  mascotMessage,
  avoidKeyboard = false,
  testID,
}: OnboardingScreenProps) {
  const { colors, typography, screenPadding, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const body = (
    <View style={styles.body} testID={testID}>
      <Animated.View entering={FadeIn.duration(260)}>
        <Text accessibilityRole="header" style={[typography.screenTitle, styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.body, styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </Animated.View>

      <View style={styles.contentArea}>{children}</View>

      {mascotMessage ? (
        <Animated.View entering={FadeIn.delay(150).duration(300)} style={styles.mascotContainer}>
          <Mascot message={mascotMessage} size={52} />
        </Animated.View>
      ) : null}
    </View>
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
      <IconButton
        name="chevronLeft"
        onPress={onBack}
        accessibilityLabel="Go back"
        size={38}
        iconSize={20}
        variant="surface"
        testID="back"
      />
      <View style={styles.progress}>
        <ProgressBar progress={step / totalSteps} totalSteps={totalSteps} />
      </View>
    </View>
  );

  const pinnedFooter = (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + spacing.xs }]}>
      {footer}
    </View>
  );

  return (
    <View style={styles.root}>
      <AmbientGlow />
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.container, { paddingHorizontal: screenPadding }]}
        >
          {header}
          {body}
          {pinnedFooter}
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.container, { paddingHorizontal: screenPadding }]}>
          {header}
          {body}
          {pinnedFooter}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, paddingTop: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 4 },
  progress: { flex: 1 },
  body: { flex: 1, paddingTop: 20 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  contentArea: { flex: 1 },
  mascotContainer: { paddingVertical: 12, marginTop: 'auto' },
  footer: { paddingTop: 12 },
});
