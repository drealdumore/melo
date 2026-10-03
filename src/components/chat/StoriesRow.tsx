/**
 * Profile and chat shortcuts at the top of the Chats screen.
 * Follows benchmark messenger patterns with live presence rings and instant friend jumps.
 */
import { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import type { ChatSummary } from '@/types/models';

export interface StoriesRowProps {
  myProfileName?: string;
  myAvatarKey?: string | null;
  chats: ChatSummary[];
  presenceOf: (id: string) => 'online' | 'offline';
  onOpenMyProfile: () => void;
  onOpenChat: (roomId: string) => void;
  onConnectFriend?: () => void;
}

function StoriesRowComponent({
  myProfileName = 'You',
  myAvatarKey,
  chats,
  presenceOf,
  onOpenMyProfile,
  onOpenChat,
  onConnectFriend,
}: StoriesRowProps) {
  const { colors, screenPadding } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingHorizontal: screenPadding },
      ]}
      style={styles.container}
    >
      {/* Profile Shortcut */}
      <StoryItem
        name={myProfileName}
        onPress={onOpenMyProfile}
        renderAvatar={() => (
          <View style={styles.avatarWrap}>
            <View style={[styles.myAvatarBorder, { borderColor: colors.border }]}>
              <Avatar
                name={myProfileName}
                avatarKey={myAvatarKey}
                size={54}
              />
            </View>
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.accent, borderColor: colors.background },
              ]}
            >
              <Icon name="person" size={11} color={colors.onAccent} strokeWidth={2.4} />
            </View>
          </View>
        )}
      />


      {/* Friend Chat Shortcuts */}
      {chats.map((chat) => {
        const friend = chat.friend;
        const firstName =
          friend.display_name.trim().split(/\s+/)[0] ?? friend.display_name;
        const online = presenceOf(friend.id) === 'online';

        return (
          <StoryItem
            key={chat.room.id}
            name={firstName}
            onPress={() => onOpenChat(chat.room.id)}
            renderAvatar={() => (
              <View style={styles.avatarWrap}>
                <View
                  style={[
                    styles.storyRing,
                    {
                      borderColor: online ? colors.info : colors.border,
                      backgroundColor: online ? colors.accentTint : 'transparent',
                    },
                  ]}
                >
                  <Avatar
                    name={friend.display_name}
                    avatarKey={friend.avatar_key}
                    size={52}
                  />
                </View>
                {online ? (
                  <View
                    style={[
                      styles.onlineBadge,
                      { backgroundColor: colors.info, borderColor: colors.background },
                    ]}
                  />
                ) : null}
              </View>
            )}
          />
        );
      })}
    </ScrollView>
  );
}

function StoryItem({
  name,
  onPress,
  renderAvatar,
}: {
  name: string;
  onPress: () => void;
  renderAvatar: () => React.ReactNode;
}) {
  const { colors, typography } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable({ scale: 0.94 });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={[styles.item, style]}
    >
      {renderAvatar()}
      <Text
        numberOfLines={1}
        style={[
          typography.caption,
          styles.label,
          { color: colors.textPrimary },
        ]}
      >
        {name}
      </Text>
    </AnimatedPressable>
  );
}

export const StoriesRow = memo(StoriesRowComponent);

const styles = StyleSheet.create({
  container: { flexGrow: 0, marginVertical: 6 },
  scrollContent: { gap: 14, alignItems: 'center', paddingVertical: 4 },
  item: { alignItems: 'center', width: 68, gap: 6 },
  avatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  myAvatarBorder: {
    padding: 2,
    borderRadius: 34,
    borderWidth: 1.5,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRing: {
    padding: 2.5,
    borderRadius: 34,
    borderWidth: 2,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  label: { textAlign: 'center', fontSize: 13, letterSpacing: -0.2 },
});
