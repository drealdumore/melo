/**
 * App shell: gesture root, theme-aware status bar, the profile provider, and
 * the stack navigator. Loads the bundled typefaces and owns the native splash
 * screen, which only disappears once both the fonts and the profile are ready.
 */
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppPresenceProvider } from '@/components/providers/AppPresenceProvider';
import { ProfileProvider } from '@/components/profile/ProfileProvider';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/hooks/useTheme';
import { fontMap } from '@/theme/fonts';

// Keep the native splash up until we know whether to onboard or to show chats.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 400, fade: true });

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        {/* Above the navigator: sheets portal out of the screen that opened
            them, so the host has to be mounted before any Stack screen exists. */}
        <BottomSheetModalProvider>
          <ProfileProvider>
            <Shell />
          </ProfileProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell() {
  const { colors, isDark } = useTheme();
  const { loading } = useProfile();
  // Rendered with a fallback face if this is not awaited, so the splash has to
  // stay up until it resolves — otherwise every headline visibly swaps glyphs
  // a beat after the first paint.
  const [fontsLoaded, fontError] = useFonts(fontMap);

  // "Ready" is derived rather than mirrored into state. The effect exists only
  // to dismiss the native splash, which is a genuine external-system side
  // effect. A font error must not strand the app on the splash screen forever, so
  // it counts as ready and the UI falls back to the system face.
  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (loading || !fontsReady) return;
    void SplashScreen.hide();
  }, [loading, fontsReady]);

  if (loading || !fontsReady) return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppPresenceProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding/welcome" />
          <Stack.Screen name="onboarding/language" />
          <Stack.Screen name="onboarding/name" />
          <Stack.Screen name="onboarding/id" />
          <Stack.Screen name="connect" />
          <Stack.Screen name="chats/index" />
          <Stack.Screen name="chats/[roomId]" />
        </Stack>
      </AppPresenceProvider>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
