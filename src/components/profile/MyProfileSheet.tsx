/**
 * Your own profile: the ID you have been handing out, your name, and the language
 * you read Melo in. Both the name and the language are editable, because
 * "your friend cannot recognise you" and "you have moved country" are the two
 * reasons people come back to this sheet.
 *
 * The body is keyed on the profile so a cancelled edit is discarded the next
 * time it opens, rather than needing its state synced.
 */
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { LANGUAGES, getLanguage } from '@/constants/languages';
import { Sheet, SheetRow, SheetScroll } from '@/components/ui/Sheet';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CopyButton } from '@/components/ui/CopyButton';
import type { Profile } from '@/types/models';

const MAX_NAME_LENGTH = 30;

export interface MyProfileSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function MyProfileSheet({ visible, onClose }: MyProfileSheetProps) {
  const { profile } = useProfile();

  if (!visible || !profile) return null;
  return <MyProfileBody key={profile.id} profile={profile} onClose={onClose} />;
}

function MyProfileBody({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { colors, typography, spacing, radii, screenPadding, fontFamily } = useTheme();
  const { update } = useProfile();

  const [name, setName] = useState(profile.display_name);
  const [languageCode, setLanguageCode] = useState(profile.reading_language);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const nameValid = trimmed.length > 0;
  const changed = trimmed !== profile.display_name || languageCode !== profile.reading_language;

  const language = useMemo(() => getLanguage(languageCode), [languageCode]);

  const save = async () => {
    if (!nameValid || saving) return;
    setSaving(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await update({ displayName: trimmed.slice(0, MAX_NAME_LENGTH), readingLanguage: languageCode });
      onClose();
    } catch (error) {
      console.warn('Could not save profile', error);
      Alert.alert('Could not save', 'Your profile was not changed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible onClose={onClose} title="You" dismissable={!saving}>
      <SheetScroll>
        <View style={[styles.body, { paddingHorizontal: screenPadding }]}>
          <View style={styles.identity}>
            <Avatar name={trimmed || profile.display_name} size={52} />
            <View style={styles.nameColumn}>
              <Text style={[typography.section, { color: colors.textPrimary }]} numberOfLines={1}>
                {trimmed || profile.display_name}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Reading in {language.name}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.idCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.card,
              },
            ]}
          >
            <Text style={[typography.label, { color: colors.textMuted }]}>YOUR MELO ID</Text>
            <Text
              style={[
                typography.mono,
                { color: colors.textPrimary, fontFamily: fontFamily.mono, letterSpacing: 2 },
              ]}
            >
              {profile.melo_id}
            </Text>
            <CopyButton meloId={profile.melo_id} onCopy={() => {}} />
          </View>

          <Text style={[typography.label, styles.label, { color: colors.textMuted }]}>YOUR NAME</Text>
          <TextInput
            value={name}
            onChangeText={(next) => setName(next.slice(0, MAX_NAME_LENGTH))}
            placeholder="Alex"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={MAX_NAME_LENGTH}
            accessibilityLabel="Your name"
            testID="profile-name-input"
            style={[
              styles.input,
              typography.body,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderColor: nameValid ? colors.border : colors.danger,
                borderRadius: radii.input,
              },
            ]}
          />

          <Text style={[typography.label, styles.label, { color: colors.textMuted }]}>
            YOU READ MELO IN
          </Text>
          <View style={{ gap: spacing.xs }}>
            {LANGUAGES.map((item) => (
              <SheetRow
                key={item.code}
                label={`${item.flag}  ${item.nativeName}`}
                detail={item.name}
                selected={item.code === languageCode}
                rtl={item.rtl}
                onPress={() => setLanguageCode(item.code)}
              />
            ))}
          </View>

          <Text style={[typography.caption, styles.footnote, { color: colors.textMuted }]}>
            This is the language your messages are written in, and the language your friends read them
            in.
          </Text>
        </View>

        {changed ? (
          <View style={[styles.footer, { paddingHorizontal: screenPadding }]}>
            <Button
              label="Save"
              onPress={() => void save()}
              disabled={!nameValid}
              loading={saving}
              testID="save-profile"
            />
          </View>
        ) : null}
      </SheetScroll>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 4, paddingBottom: 20, gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  nameColumn: { flex: 1, gap: 2 },
  idCard: { padding: 16, gap: 6, borderWidth: 1, alignItems: 'center' },
  label: { marginTop: 12 },
  input: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, minHeight: 52 },
  footnote: { lineHeight: 18, marginTop: 8 },
  footer: { marginTop: 12 },
});
