/**
 * The Chats list, and the app's home once you have a profile.
 */
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { useProfile } from '@/hooks/useProfile';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useChats } from '@/hooks/useChats';
import { useAppPresence } from '@/components/providers/AppPresenceProvider';
import { useTheme } from '@/hooks/useTheme';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Mascot } from '@/components/ui/Mascot';
import { AnimatedPressable, usePressable } from '@/hooks/usePressable';
import { MyProfileSheet } from '@/components/profile/MyProfileSheet';
import { StoriesRow } from '@/components/chat/StoriesRow';
import { ChatRow } from '@/components/chat/ChatRow';
import type { ChatSummary } from '@/types/models';

export default function ChatsScreen() {
  const { colors, typography, spacing, screenPadding, radii, isDark } = useTheme();
  const insets = useScreenInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const { chats, loading, refreshing, error, refresh } = useChats();
  const { presenceOf } = useAppPresence();
  const [myProfileOpen, setMyProfileOpen] = useState(false);

  const { onPressIn: avatarPressIn, onPressOut: avatarPressOut, style: avatarPressStyle } = usePressable({ scale: 0.94 });

  // Coming back from a conversation refreshes the list
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

      <View style={[styles.header, { paddingTop: insets.headerTop, paddingHorizontal: screenPadding }]}>
        <View style={styles.titleRow}>
          <AnimatedPressable
            onPress={() => setMyProfileOpen(true)}
            onPressIn={avatarPressIn}
            onPressOut={avatarPressOut}
            accessibilityRole="button"
            accessibilityLabel="My Profile"
            testID="my-profile-avatar"
            hitSlop={8}
            style={avatarPressStyle}
          >
            <Avatar
              name={profile?.display_name ?? 'You'}
              avatarKey={profile?.avatar_key}
              size={40}
            />
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
        myAvatarKey={profile?.avatar_key}
        chats={chats}
        presenceOf={presenceOf}
        onOpenMyProfile={() => setMyProfileOpen(true)}
        onOpenChat={openChat}
        onConnectFriend={() => router.push('/connect')}
      />

      {error ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: colors.accentTint,
              borderRadius: radii.row,
              marginHorizontal: screenPadding,
              borderCurve: 'continuous',
            },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[typography.caption, styles.errorText, { color: colors.danger }]}>
            Couldn’t refresh your chats.
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
          loading ? (
            <View style={styles.empty}>
              <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
                Loading…
              </Text>
            </View>
          ) : null
        }
        testID="chats-list"
      />

      <MyProfileSheet visible={myProfileOpen} onClose={() => setMyProfileOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 12, paddingBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
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
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32 },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 24,
    
  },
  emptyAction: { alignSelf: 'stretch', marginTop: 4 },
});
