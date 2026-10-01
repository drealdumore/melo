/**
 * The standard header: a circular back button on the left, a centred title, and
 * a slot on the right for the user's initial. Every screen outside onboarding
 * uses this, so the chrome is identical everywhere.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar } from '@/components/ui/Avatar';

export interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** Hidden where there is nothing to go back to. */
  showBack?: boolean;
  /** Opens the profile sheet. Omit to leave the right side empty. */
  userName?: string;
  userAvatarKey?: string | null;
  onPressUser?: () => void;
}

export function ScreenHeader({
  title,
  onBack,
  showBack = true,
  userName,
  userAvatarKey,
  onPressUser,
}: ScreenHeaderProps) {
  const { colors, typography, screenPadding } = useTheme();
  const { headerTop } = useScreenInsets();

  return (
    <View
      style={[
        styles.header,
        { paddingTop: headerTop, paddingHorizontal: screenPadding },
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
        {userName && onPressUser ? <AvatarButton name={userName} avatarKey={userAvatarKey} onPress={onPressUser} /> : null}
      </View>
    </View>
  );
}

function AvatarButton({ name, avatarKey, onPress }: { name: string; avatarKey?: string | null; onPress: () => void }) {
  const { onPressIn, onPressOut, style } = usePressable();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Open your profile"
      testID="header-initial"
      style={style}
    >
      <Avatar name={name} avatarKey={avatarKey} size={38} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  // Fixed-width sides keep the title optically centred no matter what is in them.
  side: { width: 44, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },

});
