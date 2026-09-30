/**
 * Conversation header: back, the friend, and the language this room runs on.
 *
 * The language is a pill because it is the answer to the question every user has
 * on opening a chat — "who is this going to arrive as?" — and tapping it says
 * the whole thing out loud rather than making them open a profile sheet.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { languageName, nativeLanguageName } from '@/constants/languages';
import type { PresenceState } from '@/types/models';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';

export interface ChatHeaderProps {
  name: string;
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
  readingLanguage,
  myLanguage,
  presence,
  presenceLive,
  elsewhere = false,
  onBack,
  onPressName,
}: ChatHeaderProps) {
  const { colors, typography, screenPadding } = useTheme();
  const [hintVisible, setHintVisible] = useState(false);

  const online = presenceLive && presence === 'online';
  const explanation = `Anything you write in ${languageName(myLanguage)} arrives here in ${languageName(
    readingLanguage
  )}.`;

  const subtitle = online
    ? elsewhere
      ? 'In Melo'
      : 'In your circle'
    : `Reads in ${languageName(readingLanguage)}`;

  return (
    <View
      style={[
        styles.root,
        { paddingHorizontal: screenPadding, backgroundColor: colors.background },
      ]}
    >
      {/* Left Back Button */}
      <IconButton
        name="chevronLeft"
        onPress={onBack}
        accessibilityLabel="Back to chats"
        size={42}
        iconSize={22}
        testID="chat-back"
      />

      {/* Center Profile & Info */}
      <NameCenterButton
        name={name}
        subtitle={subtitle}
        online={online}
        elsewhere={elsewhere}
        onPress={onPressName}
      />

      {/* Right Options / Details Button */}
      <View style={styles.trailing}>
        <LanguagePill
          language={readingLanguage}
          onPress={() => setHintVisible((value) => !value)}
          expanded={hintVisible}
        />
      </View>

      {hintVisible ? (
        <Text style={[typography.caption, styles.hint, { color: colors.textMuted }]}>{explanation}</Text>
      ) : null}
    </View>
  );
}

function NameCenterButton({
  name,
  subtitle,
  online,
  elsewhere,
  onPress,
}: {
  name: string;
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
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
        },
        style,
      ]}
    >
      <Text
        style={[typography.caption, { color: colors.textMuted }]}
        numberOfLines={1}
      >
        {nativeLanguageName(language)}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 },
  centerContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 8 },
  centerText: { alignItems: 'flex-start' },
  nameText: { fontSize: 16 },
  trailing: { alignItems: 'flex-end' },
  pill: { borderWidth: StyleSheet.hairlineWidth, paddingVertical: 6, minWidth: 42, alignItems: 'center' },
  hint: { position: 'absolute', top: '100%', right: 20, left: 20, paddingTop: 6, textAlign: 'center' },
});
