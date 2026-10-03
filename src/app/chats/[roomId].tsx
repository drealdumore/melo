/**
 * A conversation. Header, messages, composer.
 *
 * The keyboard lifts the composer with `KeyboardAvoidingView`; the list keeps
 * its inverted anchor so a lifted keyboard never breaks the scroll position. A
 * room that cannot be resolved shows a plain message with a way back, not a
 * spinner that spins forever.
 */
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useIsFocused } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useProfile } from '@/hooks/useProfile';
import { useChat } from '@/hooks/useChat';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useAppPresence } from '@/components/providers/AppPresenceProvider';
import { useTheme } from '@/hooks/useTheme';
import { isRoomId } from '@/services/rooms';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatList, ChatListSkeleton } from '@/components/chat/ChatList';
import { Composer } from '@/components/chat/Composer';
import { FriendSheet } from '@/components/profile/FriendSheet';
import { Button } from '@/components/ui/Button';
import { MeloMark } from '@/components/ui/MeloMark';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ roomId?: string | string[] }>();
  const roomId = Array.isArray(params.roomId) ? (params.roomId[0] ?? '') : (params.roomId ?? '');
  const router = useRouter();

  const { colors, typography, spacing, radii } = useTheme();
  const insets = useScreenInsets();
  const isFocused = useIsFocused();
  const { profile } = useProfile();
  const { presenceOf, isInRoom, live: appPresenceLive, setActiveRoom } = useAppPresence();
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    loading,
    notFound,
    friend,
    messages,
    send,
    retry,
    discard,
    retryTranslation,
    friendIsTyping,
    noteTyping,
    presence,
    presenceLive,
    connection,
  } = useChat(roomId);

  // Tell the rest of the app which room this device is looking at, so a friend
  // in this room gets a solid ring and one elsewhere gets a dashed one.
  useEffect(() => {
    if (!isFocused) return;
    setActiveRoom(roomId);
    return () => setActiveRoom(null);
  }, [isFocused, roomId, setActiveRoom]);

  const openFriend = useCallback(() => {
    console.log('[melo] openFriend tapped, friend:', friend?.display_name ?? 'null', 'sheetOpen:', sheetOpen);
    setSheetOpen(true);
  }, [friend, sheetOpen]);
  const closeFriend = useCallback(() => setSheetOpen(false), []);

  if (!isRoomId(roomId)) return <MissingRoom message="This chat link is incomplete." />;
  if (notFound) return <MissingRoom message="This conversation is no longer available." />;

  const reconnecting = connection === 'reconnecting' || connection === 'connecting';
  // App presence covers friends who are active outside this room; room presence
  // still confirms "here now" if the app-wide channel is catching up.
  const appOnline = friend ? presenceOf(friend.id) === 'online' : false;
  const roomOnline = Boolean(friend && presenceLive && presence === 'online');
  const friendOnline = appOnline || roomOnline;
  // A connected room channel can confirm the friend is here, but can't prove
  // they are offline elsewhere. Only app presence makes an offline answer global.
  const friendPresenceLive = appPresenceLive || roomOnline;
  const displayedPresence = friendOnline ? 'online' : 'offline';
  const elsewhere = appOnline && !isInRoom(friend?.id ?? '', roomId);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Fixed header — outside KAV so keyboard never moves it ── */}
      <View style={[styles.header, { paddingTop: insets.headerTop }]}>
        <ChatHeader
          name={friend?.display_name ?? '…'}
          avatarKey={friend?.avatar_key}
          readingLanguage={friend?.reading_language ?? profile?.reading_language ?? 'en'}
          myLanguage={profile?.reading_language ?? 'en'}
          presence={displayedPresence}
          presenceLive={friendPresenceLive}
          elsewhere={elsewhere}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/chats'))}
          onPressName={friend ? openFriend : () => {}}
        />
      </View>

      {/* ── List + composer, keyboard-aware ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.flex}>
          {loading && messages.length === 0 ? (
            <ChatListSkeleton label="Opening chat…" />
          ) : (
            <ChatList
              messages={messages}
              meId={profile?.id ?? ''}
              friendIsTyping={friendIsTyping}
              onRetry={retry}
              onDelete={discard}
              onRetryTranslation={retryTranslation}
            />
          )}
        </View>

        <View style={[styles.composerWrap, { paddingBottom: insets.footerBottom }]}>
          <Composer onSend={send} onTypingChange={noteTyping} disabled={!isFocused || !friend} />
        </View>
      </KeyboardAvoidingView>

      {/* ── Reconnecting banner — absolute over everything, never in flow ── */}
      {reconnecting ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(140)}
          style={[styles.banner, { top: insets.top + spacing.sm, backgroundColor: colors.surface, borderRadius: radii.pill }]}
          accessibilityLiveRegion="polite"
          testID="reconnecting"
        >
          <Text style={[typography.caption, { color: colors.textMuted }]}>Reconnecting…</Text>
        </Animated.View>
      ) : null}

      <FriendSheet
        visible={sheetOpen}
        friend={friend}
        myLanguage={profile?.reading_language ?? 'en'}
        presence={displayedPresence}
        presenceLive={friendPresenceLive}
        elsewhere={elsewhere}
        onClose={closeFriend}
      />
    </View>
  );
}

function MissingRoom({ message }: { message: string }) {
  const { colors, typography, screenPadding, spacing } = useTheme();
  const insets = useScreenInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.missing,
        { backgroundColor: colors.background, paddingHorizontal: screenPadding, paddingTop: insets.headerTop + spacing.xxxl },
      ]}
    >
      <MeloMark size={40} color={colors.textMuted} />
      <Text style={[typography.section, styles.missingText, { color: colors.textPrimary }]}>{message}</Text>
      <Button
        label="Back to chats"
        variant="surface"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    // Keeps the header above the keyboard and list at all times.
    zIndex: 1,
  },
  flex: { flex: 1 },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  composerWrap: { paddingTop: 4 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  missingText: { textAlign: 'center' },
});
