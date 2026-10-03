/**
 * Conversation header: back, the friend, and the language this room runs on.
 *
 * The language is a pill because it is the answer to the question every user has
 * on opening a chat — "who is this going to arrive as?" — and tapping it says
 * the whole thing out loud rather than making them open a profile sheet.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { languageName } from '@/constants/languages';
import type { PresenceState } from '@/types/models';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { duration, spring } from '@/theme/motion';

export interface ChatHeaderProps {
  name: string;
  avatarKey?: string | null;
  readingLanguage: string;
  myLanguage: string;
  presence: PresenceState;
  /** False while reconnecting or offline; a lone dot should not claim "here". */
  presenceLive: boolean;
  /** They are in the app, just not in this chat. */
  elsewhere?: boolean;
  onBack: () => void;
  onPressName: () => void;
}

export function ChatHeader({
  name,
  avatarKey,
  readingLanguage,
  myLanguage,
  presence,
  presenceLive,
  elsewhere = false,
  onBack,
  onPressName,
}: ChatHeaderProps) {
  const { colors, typography, screenPadding } = useTheme();
  const reduced = useReducedMotion();
  const [hintVisible, setHintVisible] = useState(false);
  const [hintHeight, setHintHeight] = useState(0);
  const hintH = useSharedValue(0);
  const measured = hintHeight > 0;

  const online = presenceLive && presence === 'online';
  const explanation = `How this chat works\nYou write in ${languageName(myLanguage)}. ${name} reads it in ${languageName(
    readingLanguage
  )}.\n${name} writes in ${languageName(readingLanguage)}. You read it in ${languageName(
    myLanguage
  )}.\nThat's it.`;

  const subtitle = online
    ? elsewhere
      ? 'In Melo'
      : 'Here now'
    : `Reads in ${languageName(readingLanguage)}`;

  const hintContainerStyle = useAnimatedStyle(() => ({
    height: hintH.value,
    overflow: 'hidden',
  }));

  const toggleHint = () => {
    if (!measured) return;
    const next = !hintVisible;
    setHintVisible(next);
    const target = next ? hintHeight : 0;
    hintH.value = reduced
      ? withTiming(target, { duration: duration.fast })
      : withSpring(target, { stiffness: spring.stiffness, damping: spring.damping, mass: 0.7 });
  };

  return (
    <View style={{ paddingHorizontal: screenPadding, backgroundColor: colors.background }}>
      <View style={styles.row}>
        <IconButton
          name="chevronLeft"
          onPress={onBack}
          accessibilityLabel="Back to chats"
          size={42}
          iconSize={22}
          testID="chat-back"
        />

        <NameCenterButton
          name={name}
          avatarKey={avatarKey}
          subtitle={subtitle}
          online={online}
          elsewhere={elsewhere}
          onPress={onPressName}
        />

        <View style={styles.trailing}>
          <LanguagePill
            language={readingLanguage}
            onPress={toggleHint}
            expanded={hintVisible}
          />
        </View>
      </View>

      {/* Animated panel — springs open and pushes the list down, never overlaps */}
      <Animated.View style={hintContainerStyle}>
        <Text style={[typography.caption, styles.hintText, { color: colors.textMuted }]}>
          {explanation}
        </Text>
      </Animated.View>

      {/* Off-screen clone measures the natural height before the first tap */}
      <View
        pointerEvents="none"
        style={styles.measure}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0 && h !== hintHeight) {
            setHintHeight(h);
            if (hintVisible) hintH.value = h;
          }
        }}
      >
        <Text style={[typography.caption, styles.hintText, { color: colors.textMuted }]}>
          {explanation}
        </Text>
      </View>
    </View>
  );
}

function NameCenterButton({
  name,
  avatarKey,
  subtitle,
  online,
  elsewhere,
  onPress,
}: {
  name: string;
  avatarKey?: string | null;
  subtitle: string;
  online: boolean;
  elsewhere: boolean;
  onPress: () => void;
}) {
  const { colors, typography } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${name}'s profile`}
      testID="chat-name"
      style={[styles.centerContainer, style]}
    >
      <Avatar
        name={name}
        avatarKey={avatarKey}
        size={42}
        presence={online ? 'online' : 'offline'}
        idle={elsewhere && online}
      />
      <View style={styles.centerText}>
        <Text numberOfLines={1} style={[typography.bodyStrong, styles.nameText, { color: colors.textPrimary }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

function LanguagePill({
  language,
  onPress,
  expanded,
}: {
  language: string;
  onPress: () => void;
  expanded: boolean;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Reads Melo in ${languageName(language)}. Tap for details.`}
      accessibilityState={{ expanded }}
      testID="chat-language-pill"
      style={[
        styles.pill,
        {
          backgroundColor: expanded ? colors.accentTint : colors.surface,
          borderColor: expanded ? colors.accent : colors.border,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
    >
      <Text style={[typography.caption, { color: expanded ? colors.accent : colors.textMuted }]} numberOfLines={1}>
        {languageName(language)}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  centerContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 8 },
  centerText: { alignItems: 'flex-start' },
  nameText: { fontSize: 16 },
  trailing: { alignItems: 'flex-end' },
  pill: { borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, minWidth: 42, alignItems: 'center' },
  hintText: { textAlign: 'center', paddingBottom: 8 },
  measure: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
});
