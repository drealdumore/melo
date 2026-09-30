/**
 * The Chats list, and the app's home once you have a profile.
 *
 * Two rows sit above the list of conversations, and they are the whole
 * navigation story: your own profile, and the one person you can talk to. Both
 * are visible whether or not you have any chats, so "Connect" is never buried
 * under an empty state.
 */
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/hooks/useProfile';
import { useChats } from '@/hooks/useChats';
import { useAppPresence } from '@/components/providers/AppPresenceProvider';
import { useTheme } from '@/hooks/useTheme';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/IconButton';
import { Mascot } from '@/components/ui/Mascot';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { MyProfileSheet } from '@/components/profile/MyProfileSheet';
import { StoriesRow } from '@/components/chat/StoriesRow';
import { ChatRow } from '@/components/chat/ChatRow';
import type { ChatSummary } from '@/types/models';

export default function ChatsScreen() {
  const { colors, typography, spacing, screenPadding, radii } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const { chats, loading, refreshing, error, refresh } = useChats();
  const { presenceOf } = useAppPresence();
  const [myProfileOpen, setMyProfileOpen] = useState(false);

  // Coming back from a conversation should reveal the new last line.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openChat = useCallback((roomId: string) => router.push(`/chats/${roomId}`), [router]);

  const renderItem = useCallback(
    ({ item }: { item: ChatSummary }) =>
      item ? (
        <ChatRow
          chat={item}
          myId={profile?.id ?? ''}
          online={presenceOf(item.friend.id) === 'online'}
          onPress={openChat}
        />
      ) : null,
    [profile?.id, openChat, presenceOf]
  );

  const keyExtractor = useCallback((item: ChatSummary) => item?.room.id ?? '', []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + 8, paddingHorizontal: screenPadding }]}>
        <View style={styles.titleRow}>
          <AnimatedPressable
            onPress={() => setMyProfileOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="My Profile"
            testID="my-profile-avatar"
          >
            <Avatar name={profile?.display_name ?? 'You'} size={40} />
          </AnimatedPressable>

          <Text
            accessibilityRole="header"
            style={[typography.screenTitle, styles.headerTitle, { color: colors.textPrimary }]}
          >
            Chats
          </Text>

          <IconButton
            name="plus"
            onPress={() => router.push('/connect')}
            accessibilityLabel="Connect with a friend"
            size={40}
            iconSize={22}
            testID="connect-friend"
          />
        </View>
      </View>

      <StoriesRow
        myProfileName={profile?.display_name}
        chats={chats}
        presenceOf={presenceOf}
        onOpenMyProfile={() => setMyProfileOpen(true)}
        onOpenChat={openChat}
      />

      {error ? (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.accentTint, borderRadius: radii.row, marginHorizontal: screenPadding },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
            Could not load your chats.
          </Text>
          <Button label="Try again" variant="ghost" size="compact" onPress={() => void refresh()} />
        </View>
      ) : null}

      <FlatList
        data={chats}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.list,
          chats.length === 0 ? styles.listEmpty : null,
          { paddingTop: spacing.xs, paddingBottom: insets.bottom + spacing.xl },
        ]}
        refreshing={refreshing}
        onRefresh={refresh}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Mascot message="No chats yet. Send someone your Melo ID and start one." />
              <Button
                label="Connect with a friend"
                icon="plus"
                onPress={() => router.push('/connect')}
                style={styles.emptyAction}
                testID="empty-connect"
              />
            </View>
          )
        }
        testID="chats-list"
      />

      <MyProfileSheet visible={myProfileOpen} onClose={() => setMyProfileOpen(false)} />
    </View>
  );
}

/** One of the two rows above the list: an initial, a name, a chevron. */
function ShortcutRow({
  label,
  name,
  onPress,
}: {
  label: string;
  name: string;
  onPress: () => void;
}) {
  const { colors, typography, spacing, radii } = useTheme();
  const { onPressIn, onPressOut, style } = usePressable();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${name}`}
      style={[
        styles.shortcut,
        { backgroundColor: colors.surface, borderRadius: radii.row, marginRight: spacing.sm },
        style,
      ]}
    >
      <Avatar name={name} size={36} />
      <View style={styles.shortcutText}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
        <Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.textPrimary }]}>
          {name}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textMuted} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 20 },
  shortcuts: { flexDirection: 'row' },
  shortcut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shortcutText: { flex: 1, gap: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 6,
    marginTop: 12,
  },
  errorText: { flex: 1 },
  list: { paddingHorizontal: 0 },
  listEmpty: { flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 24 },
  emptyAction: { alignSelf: 'center' },
});
