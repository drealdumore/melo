/**
 * A single row in the Chats list: who, when, and the last line in the language
 * you read.
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
  const { colors, typography, spacing, radii, screenPadding, isDark } = useTheme();
  const { friend, lastMessage } = chat;
  const { onPressIn, onPressOut, style: pressStyle } = usePressable({ scale: 0.975 });

  const isMine = lastMessage?.sender_id === myId;
  const preview = lastMessage
    ? previewTextFor(lastMessage, isMine)
    : 'Say something…';
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
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.border,
          borderWidth: 1,
          borderRadius: radii.row,
          marginHorizontal: screenPadding,
          marginBottom: spacing.sm,
          paddingVertical: 14,
          paddingHorizontal: 14,
        },
        pressStyle,
      ]}
    >
      <Avatar
        name={friend.display_name}
        avatarKey={friend.avatar_key}
        size={50}
        presence={online ? 'online' : 'offline'}
        animateRing
      />

      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text
            style={[typography.bodyStrong, styles.name, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {friend.display_name}
          </Text>
          <View style={styles.timeRow}>
            {unread ? <UnreadDot /> : null}
            {lastMessage ? (
              <Text style={[typography.caption, styles.time, { color: colors.textMuted }]}>
                {formatRelativeTime(lastMessage.created_at)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.bottomLine}>
          {untranslated ? <Icon name="alert" size={13} color={colors.danger} /> : null}
          <Text
            style={[
              typography.body,
              styles.preview,
              { color: unread ? colors.textPrimary : colors.textMuted, fontWeight: unread ? '500' : '400' },
            ]}
            numberOfLines={1}
          >
            {preview}
          </Text>
          {online ? (
            <View style={styles.onlineLabel} accessibilityElementsHidden importantForAccessibility="no">
              <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
              <Text style={[typography.caption, { color: colors.success }]}>Online</Text>
            </View>
          ) : null}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderCurve: 'continuous',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  body: { flex: 1, gap: 4 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 16, letterSpacing: -0.2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { fontVariant: ['tabular-nums'], fontSize: 12 },
  bottomLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  preview: { flex: 1, fontSize: 14, lineHeight: 18 },
  onlineLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
