/**
 * Stories row at the top of the Chats screen (matching fable-stories.png).
 * Displays "My story" followed by horizontal contacts with story rings.
 */
import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { AnimatedPressable, usePressable } from "@/hooks/usePressable";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { ChatSummary } from "@/types/models";

export interface StoriesRowProps {
  myProfileName?: string;
  chats: ChatSummary[];
  presenceOf: (id: string) => "online" | "offline";
  onOpenMyProfile: () => void;
  onOpenChat: (roomId: string) => void;
}

function StoriesRowComponent({
  myProfileName = "Me",
  chats,
  presenceOf,
  onOpenMyProfile,
  onOpenChat,
}: StoriesRowProps) {
  const { colors, typography, screenPadding } = useTheme();

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
      {/* My Story Item */}
      <StoryItem
        name="My story"
        onPress={onOpenMyProfile}
        renderAvatar={() => (
          <View
            style={[
              styles.myStoryCircle,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Icon
              name="plus"
              size={22}
              color={colors.textPrimary}
              strokeWidth={2.2}
            />
          </View>
        )}
      />

      {/* Friends Stories */}
      {chats.map((chat) => {
        const friend = chat.friend;
        const firstName =
          friend.display_name.trim().split(/\s+/)[0] ?? friend.display_name;
        const online = presenceOf(friend.id) === "online";

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
                      borderColor: online ? colors.info : colors.accent,
                    },
                  ]}
                >
                  <Avatar name={friend.display_name} size={52} />
                </View>
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
  const { onPressIn, onPressOut, style } = usePressable();

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
  container: { flexGrow: 0, marginVertical: 8 },
  scrollContent: { gap: 16, alignItems: "center", paddingVertical: 6 },
  item: { alignItems: "center", width: 66, gap: 6 },
  myStoryCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  storyRing: {
    padding: 2.5,
    borderRadius: 36,
    borderWidth: 2,
  },
  label: { textAlign: "center", fontSize: 13 },
});
