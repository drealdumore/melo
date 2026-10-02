

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Mascot } from '@/components/ui/Mascot';
import { screenEnter, screenFadeEnter } from '@/theme/motion';

const HEADER_ENTER = screenEnter();
const HEADER_REDUCED_ENTER = screenFadeEnter();
const HEADING_ENTER = screenEnter(40);
const HEADING_REDUCED_ENTER = screenFadeEnter(40);
const CONTENT_ENTER = screenEnter(80);
const CONTENT_REDUCED_ENTER = screenFadeEnter(80);
const MASCOT_ENTER = screenEnter(120);
const MASCOT_REDUCED_ENTER = screenFadeEnter(120);
const FOOTER_ENTER = screenEnter(160);
const FOOTER_REDUCED_ENTER = screenFadeEnter(160);

export interface OnboardingScreenProps {
  /** 1 of 4, 2 of 4, 3 of 4, 4 of 4. */
  step: number;
  totalSteps?: number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
  /** Pinned to the bottom. */
  footer: ReactNode;
  children: ReactNode;
  /** Optional speech bubble message from Melo mascot at the bottom of the screen. */
  mascotMessage?: string;
  /** Optional action aligned to the right of the progress bar. */
  headerAction?: ReactNode;
  /** Lifts the footer clear of the keyboard. Off for the language step. */
  avoidKeyboard?: boolean;
  testID?: string;
}

export function OnboardingScreen({
  step,
  totalSteps = 4,
  eyebrow,
  title,
  subtitle,
  onBack,
  footer,
  children,
  mascotMessage,
  headerAction,
  avoidKeyboard = false,
  testID,
}: OnboardingScreenProps) {
  const { colors, typography, screenPadding } = useTheme();
  const { headerTop, footerBottom } = useScreenInsets();
  const reducedMotion = useReducedMotion();

  const body = (
    <View style={styles.body} testID={testID}>
      <Animated.View entering={reducedMotion ? HEADING_REDUCED_ENTER : HEADING_ENTER}>
        {eyebrow ? (
          <Text style={[typography.label, styles.eyebrow, { color: colors.textMuted }]}>
            {eyebrow}
          </Text>
        ) : null}
        <Text accessibilityRole="header" style={[typography.screenTitle, styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[typography.body, styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </Animated.View>

      <Animated.View
        entering={reducedMotion ? CONTENT_REDUCED_ENTER : CONTENT_ENTER}
        style={styles.contentArea}
      >
        {children}
      </Animated.View>

      {mascotMessage ? (
        <Animated.View
          entering={reducedMotion ? MASCOT_REDUCED_ENTER : MASCOT_ENTER}
          style={styles.mascotContainer}
        >
          <Mascot message={mascotMessage} size={52} />
        </Animated.View>
      ) : null}
    </View>
  );

  const header = (
    <Animated.View
      entering={reducedMotion ? HEADER_REDUCED_ENTER : HEADER_ENTER}
      style={{ paddingTop: headerTop }}
    >
      <View style={styles.header}>
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
      {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
    </Animated.View>
  );

  const pinnedFooter = (
    <Animated.View
      entering={reducedMotion ? FOOTER_REDUCED_ENTER : FOOTER_ENTER}
      style={[styles.footer, { paddingBottom: footerBottom }]}
    >
      {footer}
    </Animated.View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
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
  headerAction: { alignItems: 'flex-end', paddingTop: 2 },
  progress: { flex: 1 },
  body: { flex: 1, paddingTop: 20 },
  eyebrow: { marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontSize: 26, lineHeight: 32, letterSpacing: -0.4 },
  subtitle: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  contentArea: { flex: 1 },
  mascotContainer: { paddingVertical: 12, marginTop: 'auto' },
  footer: { paddingTop: 12 },
});
