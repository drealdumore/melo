/**
 * The standard header: a circular back button on the left, a centred title, and
 * a slot on the right for the user's initial. Every screen outside onboarding
 * uses this, so the chrome is identical everywhere.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { IconButton } from '@/components/ui/IconButton';
import { initialsOf } from '@/components/ui/Avatar';

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** Hidden where there is nothing to go back to. */
  showBack?: boolean;
  /** Opens the profile sheet. Omit to leave the right side empty. */
  userName?: string;
  onPressUser?: () => void;
}

export function ScreenHeader({
  title,
  onBack,
  showBack = true,
  userName,
  onPressUser,
}: ScreenHeaderProps) {
  const { colors, typography, screenPadding, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top + spacing.sm, paddingHorizontal: screenPadding },
      ]}
    >
      <View style={styles.side}>
        {showBack ? (
          <IconButton
            name="chevronLeft"
            onPress={onBack}
            accessibilityLabel="Go back"
            size={38}
            iconSize={20}
            testID="header-back"
          />
        ) : null}
      </View>

      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[typography.section, styles.title, { color: colors.textPrimary }]}
      >
        {title}
      </Text>

      <View style={[styles.side, styles.sideRight]}>
        {userName && onPressUser ? <InitialButton name={userName} onPress={onPressUser} /> : null}
      </View>
    </View>
  );
}

/** The header's right-hand initial: 38pt, and a target big enough to hit. */
function InitialButton({ name, onPress }: { name: string; onPress: () => void }) {
  const { colors, typography, isDark } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Open your profile"
      testID="header-initial"
      style={[
        styles.initial,
        { backgroundColor: colors.accentTint, borderColor: colors.border },
        style,
      ]}
    >
      <Text
        style={[
          typography.bodyStrong,
          { color: isDark ? colors.textPrimary : colors.accent, fontSize: 17 },
        ]}
      >
        {initialsOf(name).slice(0, 1)}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  // Fixed-width sides keep the title optically centred no matter what is in them.
  side: { width: 44, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
  initial: { borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
