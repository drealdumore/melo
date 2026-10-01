/**
 * App shell: gesture root, theme-aware system bars, the profile provider, and the
 * stack navigator. Loads the bundled typefaces and owns the native splash screen,
 * which only disappears once both the fonts and the profile are ready.
 *
 * This is also the only place the native window background is set. `useTheme` runs in
 * dozens of components, so the call lives at the shell where it happens once per
 * scheme change instead of once per component mount.
 */
import { useEffect } from "react";
import { StatusBar, StyleSheet } from "react-native";
import { isRunningInExpoGo } from "expo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useFonts } from "expo-font";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { AppPresenceProvider } from "@/components/providers/AppPresenceProvider";
import { ProfileProvider } from "@/components/profile/ProfileProvider";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { barStyleFor } from "@/theme/colors";
import { fontMap } from "@/theme/fonts";

// Keep the native splash up until we know whether to onboard or to show chats.
void SplashScreen.preventAutoHideAsync();

// `setOptions` is a no-op in Expo Go and warns loudly, once per re-evaluation of this
// module. The fade only ever applies to a real build, so skip it there and keep the
// Expo Go console clean.
if (!isRunningInExpoGo()) {
  SplashScreen.setOptions({ duration: 400, fade: true });
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* `initialWindowMetrics` supplies the real insets on the first render instead of
          zeros, so nothing jumps once the native measurements land. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
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
  const { colors } = useTheme();
  const { loading } = useProfile();

  const [fontsLoaded, fontError] = useFonts(fontMap);

  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (loading || !fontsReady) return;
    void SplashScreen.hide();
  }, [loading, fontsReady]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

  // Two separate values, and they are not interchangeable: `barStyle` is the icon
  // colour, `backgroundColor` is the fill behind the bar. React Native's `StatusBar`
  // takes both; expo-status-bar's wrapper only forwards the first and drops the
  // second, which is why this imports from react-native.
  //
  // Icon style is derived from the background's luminance rather than from `isDark`,
  // so the clock and battery stay legible if a palette ever stops lining up with the
  // system mode. The bars stay mounted across the loading gate so the themed splash
  // never shows dark icons on a dark background for a beat.
  const icons = barStyleFor(colors.background);

  return (
    <>
      <StatusBar
        barStyle={icons === 'dark' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
        animated
      />
      <NavigationBar style={icons} />

      {loading || !fontsReady ? null : (
        <AppPresenceProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="connect" />
            <Stack.Screen name="chats/index" />
            <Stack.Screen name="chats/[roomId]" />
          </Stack>
        </AppPresenceProvider>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
