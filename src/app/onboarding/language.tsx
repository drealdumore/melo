
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { LANGUAGES, deviceLanguage, type Language } from '@/constants/languages';
import { Button } from '@/components/ui/Button';
import { LanguageRow } from '@/components/onboarding/LanguageRow';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { loadDraft, saveDraft } from '@/services/onboardingDraft';
import { useTheme } from '@/hooks/useTheme';

export default function LanguageScreen() {
  const { spacing } = useTheme();
  const router = useRouter();

  const [selected, setSelected] = useState<Language>(() => deviceLanguage());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadDraft().then((draft) => {
        if (cancelled || !draft?.readingLanguage) return;
        const match = LANGUAGES.find((item) => item.code === draft.readingLanguage);
        if (match) setSelected(match);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onContinue = useCallback(async () => {
    await saveDraft({ readingLanguage: selected.code });
    router.push('/onboarding/name');
  }, [router, selected]);

  return (
    <OnboardingScreen
      step={1}
      eyebrow="Quick setup"
      title="what language do you think in?"
      subtitle="change it anytime in your profile."
      onBack={() => router.back()}
      // mascotMessage="first things first — let's make this feel like home."
      footer={<Button label="Next" onPress={() => void onContinue()} testID="continue" />}
      testID="language-screen"
    >
      <FlatList
        data={LANGUAGES}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <LanguageRow
            language={item}
            selected={item.code === selected.code}
            onPress={() => setSelected(item)}
          />
        )}
        style={styles.list}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, marginTop: 12 },
});
