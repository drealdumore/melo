/**
 * Step 2: your name screen.
 * Styled to match reference images with rounded input card, character counter,
 * mascot speech bubble, and continue CTA button.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { loadDraft, saveDraft } from '@/services/onboardingDraft';
import { useTheme } from '@/hooks/useTheme';

const MAX_NAME_LENGTH = 30;

export default function NameScreen() {
  const { colors, typography, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [name, setName] = useState('');
  const [editingDraft, setEditingDraft] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadDraft().then((draft) => {
        if (cancelled || !draft?.displayName) return;
        setName(draft.displayName);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const trimmed = name.trim();
  const isValid = trimmed.length > 0;

  const onContinue = useCallback(async () => {
    if (!isValid) return;
    await saveDraft({ displayName: trimmed.slice(0, MAX_NAME_LENGTH) });
    router.push('/onboarding/id');
  }, [isValid, router, trimmed]);

  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : colors.surface;
  const inputBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : colors.border;

  return (
    <OnboardingScreen
      step={2}
      title="What should we call you?"
      subtitle="Just a first name is plenty."
      onBack={() => router.back()}
      avoidKeyboard
      mascotMessage="no judgment here, everyone starts somewhere."
      footer={
        <Button
          label="Continue"
          onPress={() => void onContinue()}
          disabled={!isValid}
          icon="arrowRight"
          testID="continue"
        />
      }
      testID="name-screen"
    >
      <View style={styles.field}>
        <Text style={[typography.label, styles.fieldLabel, { color: colors.textMuted }]}>
          YOUR NAME
        </Text>

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: inputBg,
              borderColor: inputBorder,
            },
          ]}
        >
          <TextInput
            value={name}
            onChangeText={(next) => {
              setName(next.slice(0, MAX_NAME_LENGTH));
              setEditingDraft(true);
            }}
            placeholder="e.g. Alex"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void onContinue()}
            maxLength={MAX_NAME_LENGTH}
            accessibilityLabel="Your name"
            testID="name-input"
            style={[
              styles.input,
              typography.body,
              {
                color: colors.textPrimary,
              },
            ]}
          />
        </View>

        <Text style={[typography.caption, styles.counter, { color: colors.textMuted }]}>
          {editingDraft || name ? `${trimmed.length}/${MAX_NAME_LENGTH}` : ' '}
        </Text>
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 28, gap: 10 },
  fieldLabel: { fontSize: 12, letterSpacing: 0.8 },
  inputContainer: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 60,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  input: {
    fontSize: 18,
    lineHeight: 24,
    padding: 0,
  },
  counter: { textAlign: 'right', marginTop: 4 },
});
