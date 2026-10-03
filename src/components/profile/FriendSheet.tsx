/**
 * The friend summary you get by tapping a name in a chat.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { languageName, nativeLanguageName } from '@/constants/languages';
import type { PresenceState, Profile } from '@/types/models';
import { Sheet, SheetScroll } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui/Avatar';
import { CopyButton } from '@/components/ui/CopyButton';
import { createLogger } from '@/services/logger';

const log = createLogger('profile.friend');

export interface FriendSheetProps {
  visible: boolean;
  friend: Profile | null;
  myLanguage: string;
  presence: PresenceState;
  /** False when we have no live connection and would be guessing. */
  presenceLive: boolean;
  /** They are in the app, but not in this chat. */
  elsewhere?: boolean;
  onClose: () => void;
}

export function FriendSheet({
  visible,
  friend,
  myLanguage,
  presence,
  presenceLive,
  elsewhere = false,
  onClose,
}: FriendSheetProps) {
  useEffect(() => {
    if (visible && friend) {
      log.info('friend sheet opened', {
        name: friend.display_name,
        meloId: friend.melo_id,
        reads: friend.reading_language,
        presence: presenceLive ? presence : 'unknown',
      });
    }
  }, [visible, friend, presence, presenceLive]);

  if (!friend) return null;

  return (
    <FriendSheetBody
      visible={visible}
      friend={friend}
      myLanguage={myLanguage}
      presence={presence}
      presenceLive={presenceLive}
      elsewhere={elsewhere}
      onClose={onClose}
    />
  );
}

function FriendSheetBody({
  visible,
  friend,
  myLanguage,
  presence,
  presenceLive,
  elsewhere,
  onClose,
}: Required<Omit<FriendSheetProps, 'friend'>> & { friend: Profile }) {
  const { colors, typography, radii, screenPadding, fontFamily, isDark } = useTheme();

  const online = presenceLive && presence === 'online';
  const sameLanguage = friend.reading_language === myLanguage;

  const presenceLabel = !presenceLive
    ? 'Status unavailable'
    : online
    ? elsewhere
      ? 'Online · In Melo'
      : 'Online · In this chat'
    : 'Offline';

  return (
    <Sheet visible={visible} title={friend.display_name} onClose={onClose}>
      <SheetScroll>
        <View style={[styles.body, { paddingHorizontal: screenPadding }]}>
          {/* Avatar + name + presence */}
          <View style={styles.hero}>
            <Avatar
              name={friend.display_name}
              avatarKey={friend.avatar_key}
              size={82}
              presence={online ? 'online' : 'offline'}
              idle={elsewhere && online}
              animateRing={visible}
            />
            <Text style={[typography.section, { color: colors.textPrimary, marginTop: 10 }]}>
              {friend.display_name}
            </Text>
            <View style={styles.presenceRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: online ? colors.success : colors.textMuted },
                  !presenceLive ? styles.dimmed : null,
                ]}
              />
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {presenceLabel}
              </Text>
            </View>
          </View>

          {/* Melo ID row */}
          <View
            style={[
              styles.idRow,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : colors.border,
                borderRadius: radii.row,
              },
            ]}
          >
            <View style={styles.idLeft}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>Melo ID</Text>
              <Text
                style={[
                  typography.mono,
                  {
                    color: colors.textPrimary,
                    fontFamily: fontFamily.mono,
                    letterSpacing: 1.5,
                    fontSize: 15,
                  },
                ]}
                numberOfLines={1}
              >
                {friend.melo_id}
              </Text>
            </View>
            <CopyButton meloId={friend.melo_id} compact />
          </View>

          {/* Language card */}
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : colors.border,
                borderRadius: radii.row,
              },
            ]}
          >
            <Text style={[typography.label, { color: colors.textMuted }]}>Reads in</Text>
            <Text style={[typography.section, styles.value, { color: colors.textPrimary }]}>
              {nativeLanguageName(friend.reading_language)}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {languageName(friend.reading_language)}
            </Text>
          </View>

          {/* Translation explainer */}
          <Text style={[typography.body, styles.explainer, { color: colors.textMuted }]}>
            {sameLanguage
              ? `You both read in ${languageName(myLanguage)}, so there's no translation needed in this chat.`
              : `You write in ${languageName(myLanguage)}. ${friend.display_name} reads it in ${languageName(
                  friend.reading_language
                )}.\n${friend.display_name} writes in ${languageName(friend.reading_language)}. You read it in ${languageName(
                  myLanguage
                )}.`}
          </Text>
        </View>
      </SheetScroll>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingBottom: 24, gap: 12 },
  hero: { alignItems: 'center', paddingVertical: 8, gap: 4 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dimmed: { opacity: 0.4 },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  idLeft: { gap: 2, flex: 1 },
  card: { padding: 16, gap: 2, borderWidth: 1, borderCurve: 'continuous' },
  value: { marginTop: 2 },
  explainer: { lineHeight: 22, fontSize: 14 },
});
