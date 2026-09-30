/**
 * The friend summary you get by tapping a name in a chat. Read-only on purpose:
 * the one line that matters is "Ana reads this in العربية", because that is the
 * entire promise of the app.
 */
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { languageName, nativeLanguageName } from '@/constants/languages';
import type { PresenceState, Profile } from '@/types/models';
import { Sheet, SheetBody } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui/Avatar';

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
  const { colors, typography, radii, screenPadding } = useTheme();

  if (!visible || !friend) return null;

  const online = presenceLive && presence === 'online';
  const sameLanguage = friend.reading_language === myLanguage;

  return (
    <Sheet visible title={friend.display_name} onClose={onClose}>
      <SheetBody>
        <View style={[styles.body, { paddingHorizontal: screenPadding }]}>
          <View style={styles.avatarRow}>
            <Avatar
              name={friend.display_name}
              size={56}
              presence={online ? 'online' : 'offline'}
              idle={elsewhere && online}
            />
            <View style={styles.nameColumn}>
              <Text style={[typography.section, { color: colors.textPrimary }]}>{friend.display_name}</Text>
              <View style={styles.presenceRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: online ? colors.success : colors.textMuted },
                    presenceLive ? null : styles.dimmed,
                  ]}
                />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {!presenceLive ? 'Away' : online ? (elsewhere ? 'In Melo' : 'Here now') : 'Away'}
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.row },
            ]}
          >
            <Text style={[typography.label, { color: colors.textMuted }]}>READS MELO IN</Text>
            <Text style={[typography.section, styles.value, { color: colors.textPrimary }]}>
              {nativeLanguageName(friend.reading_language)}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {languageName(friend.reading_language)}
            </Text>
          </View>

          <Text style={[typography.body, styles.explainer, { color: colors.textMuted }]}>
            {sameLanguage
              ? `You both read in ${languageName(myLanguage)}, so messages pass through untouched.`
              : `Anything you write in ${languageName(myLanguage)} arrives here in ${languageName(
                  friend.reading_language
                )}.`}
          </Text>
        </View>
      </SheetBody>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingBottom: 8, gap: 16 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nameColumn: { flex: 1, gap: 2 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dimmed: { opacity: 0.4 },
  card: { padding: 16, gap: 2, borderWidth: StyleSheet.hairlineWidth },
  value: { marginTop: 2 },
  explainer: { lineHeight: 22 },
});
