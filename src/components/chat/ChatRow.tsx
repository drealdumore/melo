/**
 * A single row in the Chats list: who, when, and the last line in the language
 * you read.
 *
 * Two details worth calling out. Translation failures degrade quietly here —
 * the row shows the original rather than an error, because a list is a scanning
 * surface and a red warning per row would shout over the names. And unread is a
 * single dot, not a count badge: Melo has three users, so a number is noise.
 */
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { nativeLanguageName } from '@/constants/languages';
import { previewTextFor } from '@/services/messages';
import { formatRelativeTime } from '@/utils/time';
import type { ChatSummary } from '@/types/models';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';

export interface ChatRowProps {
  chat: ChatSummary;
  myId: string;
  /** From app-level presence: are they in the app at all? */
  online: boolean;
  onPress: (roomId: string) => void;
}

function ChatRowComponent({ chat, myId, online, onPress }: ChatRowProps) {
  const { colors, typography, spacing, radii, screenPadding } = useTheme();
  const { friend, lastMessage } = chat;
  const { onPressIn, onPressOut, style: pressStyle } = usePressable();

  const isMine = lastMessage?.sender_id === myId;
  const preview = lastMessage
    ? previewTextFor(lastMessage, isMine)
    : `Say hello in ${nativeLanguageName(friend.reading_language)}`;
  const untranslated =
    !!lastMessage && !isMine && lastMessage.translation_status === 'failed';
  const unread = chat.unreadCount > 0;

  return (
    <AnimatedPressable
      onPress={() => onPress(chat.room.id)}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${friend.display_name}${online ? ', online' : ''}`}
      accessibilityHint={lastMessage ? `Last message: ${preview}` : 'No messages yet'}
      testID={`chat-row-${chat.room.id}`}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.row,
          marginHorizontal: screenPadding,
          marginBottom: spacing.sm,
          paddingVertical: 14,
          paddingHorizontal: 14,
        },
        pressStyle,
      ]}
    >
      <Avatar name={friend.display_name} size={50} presence={online ? 'online' : 'offline'} />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={[typography.bodyStrong, styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {friend.display_name}
          </Text>
          <View style={styles.timeRow}>
            {unread ? <UnreadDot /> : null}
            {lastMessage ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {formatRelativeTime(lastMessage.created_at)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.bottomLine}>
          {untranslated ? <Icon name="alert" size={13} color={colors.textMuted} /> : null}
          <Text
            style={[typography.body, styles.preview, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {preview}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

/** A single accent dot that breathes while there is something unread. */
function UnreadDot() {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      // Cancel a pulse that may already be running and park the dot at rest, so
      // toggling the setting mid-animation cannot leave it mid-scale.
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.25, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [pulse, reduced]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: colors.info }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export const ChatRow = memo(ChatRowComponent);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  body: { flex: 1, gap: 4 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  preview: { flex: 1, fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
